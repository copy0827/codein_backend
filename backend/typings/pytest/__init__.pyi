from typing import Any, Callable

class _Mark:
    def asyncio(self, func: Callable[..., Any]) -> Callable[..., Any]: ...

mark: _Mark
