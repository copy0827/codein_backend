import json
from dataclasses import dataclass
from typing import List, Optional

from app.models.codetest import LanguageRuntime


@dataclass
class RuntimeConfig:
    language_key: str
    display_name: str
    docker_image: str
    execution_mode: str
    command_template: List[str]
    file_extension: str
    compile_command: Optional[List[str]]


def _parse_command(value: Optional[str]) -> Optional[List[str]]:
    if not value:
        return None
    parsed = json.loads(value)
    if not isinstance(parsed, list) or not all(
        isinstance(item, str) for item in parsed
    ):
        raise ValueError("Command template must be a JSON array of strings")
    return parsed


def runtime_from_model(runtime: LanguageRuntime) -> RuntimeConfig:
    command_template = _parse_command(runtime.command_template) or []
    compile_command = _parse_command(runtime.compile_command)
    return RuntimeConfig(
        language_key=runtime.language_key,
        display_name=runtime.display_name,
        docker_image=runtime.docker_image,
        execution_mode=runtime.execution_mode,
        command_template=command_template,
        file_extension=runtime.file_extension,
        compile_command=compile_command,
    )
