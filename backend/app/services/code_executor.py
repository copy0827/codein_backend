import logging
import io
import shlex
import socket
import tarfile
import time
import uuid
from dataclasses import dataclass
from typing import Any, Dict, Optional, cast

import docker
import requests

logger = logging.getLogger(__name__)

from app.services.language_registry import RuntimeConfig


@dataclass
class ExecutionResult:
    stdout: str
    stderr: str
    exit_code: int
    execution_time: float
    memory_used: int
    timeout: bool
    memory_exceeded: bool


class CodeExecutor:
    def __init__(self):
        self.client = docker.from_env()
        self.cpu_limit = 0.5
        self.pids_limit = 128
        self.tmpfs_inline = {
            "/run": "rw,nosuid,nodev,noexec,size=16m",
            "/tmp": "rw,nosuid,nodev,noexec,size=64m",
        }
        self.tmpfs_shared = {
            "/run": "rw,nosuid,nodev,noexec,size=16m",
        }
        self.environment = {
            "HOME": "/run",
            "TMPDIR": "/run",
            "JAVA_TOOL_OPTIONS": "-Djava.io.tmpdir=/run -XX:-UsePerfData",
        }
        self.exec_time_marker = "__CODEIN_EXEC_TIME__"

    def _instrument_inline_code(self, code: str, language_key: str) -> str:
        if language_key == "python":
            return self._instrument_python_code(code)
        if language_key == "javascript":
            return self._instrument_js_code(code)
        return code

    def _instrument_python_code(self, code: str) -> str:
        instrumentation_lines = [
            "import atexit",
            "import time",
            "import sys",
            "import builtins",
            "__codein_start = time.perf_counter()",
            "__codein_buf = []",
            "def input(prompt=None):",
            "    global __codein_buf",
            "    while not __codein_buf:",
            "        line = sys.stdin.readline()",
            "        if line == '':",
            "            raise EOFError",
            "        __codein_buf = line.strip().split()",
            "    return __codein_buf.pop(0)",
            "builtins.input = input",
            "def __codein_report():",
            "    duration = time.perf_counter() - __codein_start",
            f'    sys.stderr.write("{self.exec_time_marker}:" + str(duration) + "\\n")',
            "atexit.register(__codein_report)",
            "",
        ]

        return "\n".join(instrumentation_lines) + code

    def _instrument_js_code(self, code: str) -> str:
        instrumentation_lines = [
            "const __codeinStart = process.hrtime.bigint();",
            "process.stdin.on('end', () => { process.exit(0); });",
            'process.on("exit", () => {',
            "  const __codeinDuration = Number(process.hrtime.bigint() - __codeinStart) / 1e9;",
            f"  process.stderr.write(`{self.exec_time_marker}:${{__codeinDuration}}\\n`);",
            "});",
            "",
        ]
        return "\n".join(instrumentation_lines) + code

    def _normalize_stdin(self, stdin_data: str) -> str:
        if stdin_data and not stdin_data.endswith("\n"):
            return f"{stdin_data}\n"
        return stdin_data

    def _build_source_archive(self, filename: str, code: str) -> bytes:
        buffer = io.BytesIO()
        with tarfile.open(fileobj=buffer, mode="w") as archive:
            data = code.encode("utf-8")
            info = tarfile.TarInfo(name=filename)
            info.size = len(data)
            archive.addfile(info, io.BytesIO(data))
        buffer.seek(0)
        return buffer.read()

    def _build_timed_shell(self, command: list[str]) -> str:
        joined = " ".join(shlex.quote(part) for part in command)
        marker = self.exec_time_marker
        return (
            "start=$(date +%s%3N); "
            f"{joined}; status=$?; "
            "end=$(date +%s%3N); "
            "duration=$(awk -v end=$end -v start=$start 'BEGIN {printf \"%.6f\", (end-start)/1000}'); "
            f'echo "{marker}:$duration" 1>&2; '
            "exit $status"
        )

    def _extract_execution_time(
        self, stderr: str, mode: str
    ) -> tuple[Optional[float], str]:
        if mode == "marker":
            lines = stderr.splitlines()
            cleaned_lines = []
            parsed_time: Optional[float] = None
            marker_prefix = f"{self.exec_time_marker}:"
            for line in lines:
                if line.startswith(marker_prefix):
                    value = line[len(marker_prefix) :].strip()
                    try:
                        parsed_time = float(value)
                    except ValueError:
                        parsed_time = None
                    continue
                cleaned_lines.append(line)
            cleaned = "\n".join(cleaned_lines)
            if stderr.endswith("\n"):
                cleaned += "\n"
            return parsed_time, cleaned

        if mode == "posix":
            lines = stderr.splitlines()
            cleaned_lines = []
            parsed_time = None
            for line in lines:
                if line.startswith("real "):
                    try:
                        parsed_time = float(line.split(" ", 1)[1].strip())
                    except (IndexError, ValueError):
                        parsed_time = None
                    continue
                if line.startswith("user ") or line.startswith("sys "):
                    continue
                cleaned_lines.append(line)
            cleaned = "\n".join(cleaned_lines)
            if stderr.endswith("\n"):
                cleaned += "\n"
            return parsed_time, cleaned

        return None, stderr

    def execute_code(
        self,
        code: str,
        runtime: RuntimeConfig,
        stdin_data: str = "",
        time_limit: int = 5,
        memory_limit: int = 256,
    ) -> ExecutionResult:
        exec_id = uuid.uuid4().hex
        # Debug-only audit log to avoid noisy production logs.
        logger.debug(
            "Code execution started exec_id=%s language=%s mode=%s time_limit=%s memory_limit=%s",
            exec_id,
            runtime.language_key,
            runtime.execution_mode,
            time_limit,
            memory_limit,
        )

        if runtime.execution_mode == "inline":
            instrumented_code = self._instrument_inline_code(code, runtime.language_key)
            command = runtime.command_template + [instrumented_code]
            normalized_stdin = self._normalize_stdin(stdin_data)
            return self._run_container(
                image=runtime.docker_image,
                command=command,
                stdin_data=normalized_stdin,
                time_limit=time_limit,
                memory_limit=memory_limit,
                exec_id=exec_id,
                phase="run",
                read_only=True,
                tmpfs=self.tmpfs_inline,
                language_key=runtime.language_key,
                time_mode="marker",
            )

        return self._execute_file_mode(
            code=code,
            runtime=runtime,
            stdin_data=stdin_data,
            time_limit=time_limit,
            memory_limit=memory_limit,
            exec_id=exec_id,
        )

    def _execute_file_mode(
        self,
        code: str,
        runtime: RuntimeConfig,
        stdin_data: str,
        time_limit: int,
        memory_limit: int,
        exec_id: str,
    ) -> ExecutionResult:
        base_name = "Main" if runtime.file_extension == ".java" else "main"
        source_filename = f"{base_name}{runtime.file_extension}"
        source_path = f"/tmp/{source_filename}"
        output_path = "/tmp/main"
        format_values = {
            "source": source_path,
            "output": output_path,
            "class_name": base_name,
        }
        prepared_code = (
            self._instrument_python_code(code)
            if runtime.language_key == "python"
            else code
        )
        source_archive = self._build_source_archive(source_filename, prepared_code)

        run_command = [
            part.format(**format_values) for part in runtime.command_template
        ]
        timed_run_shell = self._build_timed_shell(run_command)

        compile_memory_limit = memory_limit
        if runtime.compile_command:
            compile_command = [
                part.format(**format_values) for part in runtime.compile_command
            ]
            compile_shell = " ".join(shlex.quote(part) for part in compile_command)
            combined_command = ["sh", "-c", f"{compile_shell} && {timed_run_shell}"]
            compile_memory_limit = max(memory_limit, 512)
        else:
            combined_command = ["sh", "-c", timed_run_shell]

        normalized_stdin = self._normalize_stdin(stdin_data)
        return self._run_container(
            image=runtime.docker_image,
            command=combined_command,
            stdin_data=normalized_stdin,
            time_limit=time_limit,
            memory_limit=compile_memory_limit,
            exec_id=exec_id,
            phase="run",
            read_only=False,
            tmpfs=self.tmpfs_shared,
            language_key=runtime.language_key,
            time_mode="marker",
            archive=source_archive,
            workdir="/tmp",
        )

    def _run_container(
        self,
        image: str,
        command: list[str],
        stdin_data: str,
        time_limit: int,
        memory_limit: int,
        exec_id: str,
        phase: str,
        read_only: bool,
        tmpfs: Dict[str, str],
        language_key: str,
        time_mode: str,
        volumes: Optional[Dict[str, Dict[str, str]]] = None,
        archive: Optional[bytes] = None,
        workdir: Optional[str] = None,
    ) -> ExecutionResult:
        start_time = time.monotonic()
        container: Any = None
        logger.debug(
            "Container start exec_id=%s phase=%s language=%s image=%s time_limit=%s memory_limit=%s",
            exec_id,
            phase,
            language_key,
            image,
            time_limit,
            memory_limit,
        )
        try:
            stdin_open = bool(stdin_data)

            if archive:
                containers = cast(Any, self.client.containers)
                container = cast(
                    Any,
                    containers.create(
                        image=image,
                        command=command,
                        mem_limit=f"{memory_limit}m",
                        memswap_limit=f"{memory_limit}m",
                        nano_cpus=int(self.cpu_limit * 1e9),
                        network_mode="none",
                        volumes=volumes,
                        stdin_open=stdin_open,
                        cap_drop=["ALL"],
                        security_opt=["no-new-privileges:true"],
                        pids_limit=self.pids_limit,
                        read_only=read_only,
                        tmpfs=tmpfs,
                        environment=self.environment,
                        working_dir=workdir,
                    ),
                )
                if container is None:
                    raise RuntimeError("Container creation failed")
                container.put_archive(workdir or "/", archive)
                container.start()
            else:
                container = cast(
                    Any,
                    self.client.containers.run(
                        image=image,
                        command=command,
                        mem_limit=f"{memory_limit}m",
                        memswap_limit=f"{memory_limit}m",
                        nano_cpus=int(self.cpu_limit * 1e9),
                        network_mode="none",
                        volumes=volumes,
                        detach=True,
                        stdin_open=stdin_open,
                        cap_drop=["ALL"],
                        security_opt=["no-new-privileges:true"],
                        pids_limit=self.pids_limit,
                        read_only=read_only,
                        tmpfs=tmpfs,
                        environment=self.environment,
                    ),
                )

            if container is None:
                raise RuntimeError("Container creation failed")

            if stdin_data:
                try:
                    socket_stream = container.attach_socket(
                        params={"stdin": 1, "stream": 1}
                    )
                    socket_stream._sock.sendall(stdin_data.encode())
                    socket_stream._sock.shutdown(socket.SHUT_WR)
                    socket_stream._sock.close()
                except Exception:
                    pass

            try:
                wait_timeout = max(1, time_limit + 15)
                result = container.wait(timeout=wait_timeout)
                exit_code = result.get("StatusCode", 0)
                timeout = False
            except (
                requests.exceptions.ReadTimeout,
                requests.exceptions.ConnectionError,
            ):
                try:
                    container.kill()
                except Exception:
                    pass
                exit_code = 124
                timeout = True

            execution_time = time.monotonic() - start_time
            stdout = container.logs(stdout=True, stderr=False).decode(
                "utf-8", errors="replace"
            )
            stderr = container.logs(stdout=False, stderr=True).decode(
                "utf-8", errors="replace"
            )

            parsed_time, cleaned_stderr = self._extract_execution_time(
                stderr, time_mode
            )
            time_exceeded = False
            if parsed_time is not None and (
                parsed_time < 0 or parsed_time > time_limit + 5
            ):
                parsed_time = None

            if parsed_time is not None:
                execution_time = parsed_time
                time_exceeded = parsed_time > time_limit
            stderr = cleaned_stderr

            memory_exceeded = exit_code == 137
            timeout = timeout or (time_exceeded and not memory_exceeded)
            container_id = getattr(container, "short_id", "unknown")

            logger.debug(
                "Container finished exec_id=%s phase=%s container=%s exit_code=%s timeout=%s memory_exceeded=%s duration=%.3fs",
                exec_id,
                phase,
                container_id,
                exit_code,
                timeout,
                memory_exceeded,
                execution_time,
            )

            return ExecutionResult(
                stdout=stdout,
                stderr=stderr,
                exit_code=exit_code,
                execution_time=execution_time,
                memory_used=0,
                timeout=timeout,
                memory_exceeded=memory_exceeded,
            )
        except Exception as e:
            logger.exception(
                "Container execution error exec_id=%s phase=%s",
                exec_id,
                phase,
            )
            return ExecutionResult(
                stdout="",
                stderr=str(e),
                exit_code=1,
                execution_time=0.0,
                memory_used=0,
                timeout=False,
                memory_exceeded=False,
            )
        finally:
            if container:
                try:
                    container.remove(force=True)
                except Exception:
                    logger.warning(
                        "Failed to remove container exec_id=%s phase=%s",
                        exec_id,
                        phase,
                    )
