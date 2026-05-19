from typing import Any, Dict, Optional

class Container:
    def attach_socket(self, params: Dict[str, Any]) -> Any: ...
    def wait(self, timeout: int) -> Dict[str, Any]: ...
    def logs(self, stdout: bool = ..., stderr: bool = ...) -> bytes: ...
    def stats(self, stream: bool = ...) -> Dict[str, Any]: ...
    def remove(self, force: bool = ...) -> None: ...

class ContainerCollection:
    def run(
        self,
        image: str,
        command: Any = ...,
        stdout: bool = ...,
        stderr: bool = ...,
        remove: bool = ...,
        **kwargs: Any,
    ) -> Container: ...

class DockerClient:
    containers: ContainerCollection

def from_env(**kwargs: Any) -> DockerClient: ...
