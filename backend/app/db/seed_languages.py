import asyncio
from sqlalchemy import select
from app.db.session import async_session
from app.models.codetest import LanguageRuntime

LANGUAGES = [
    {
        "language_key": "python",
        "display_name": "Python",
        "docker_image": "python:3.11-slim",
        "execution_mode": "inline",
        "command_template": '["python", "-c"]',
        "compile_command": None,
        "file_extension": ".py",
        "enabled": True,
    },
    {
        "language_key": "java",
        "display_name": "Java",
        "docker_image": "eclipse-temurin:17-jdk",
        "execution_mode": "file",
        "command_template": '["java", "-cp", "/tmp", "{class_name}"]',
        "compile_command": '["javac", "{source}"]',
        "file_extension": ".java",
        "enabled": True,
    },
    {
        "language_key": "javascript",
        "display_name": "JavaScript",
        "docker_image": "node:20-slim",
        "execution_mode": "inline",
        "command_template": '["node", "-e"]',
        "compile_command": None,
        "file_extension": ".js",
        "enabled": True,
    },
    {
        "language_key": "cpp",
        "display_name": "C++",
        "docker_image": "gcc:13",
        "execution_mode": "file",
        "command_template": '["{output}"]',
        "compile_command": '["g++", "-O2", "-pipe", "{source}", "-o", "{output}"]',
        "file_extension": ".cpp",
        "enabled": True,
    },
]


async def seed_languages():
    async with async_session() as db:
        for payload in LANGUAGES:
            query = select(LanguageRuntime).where(
                LanguageRuntime.language_key == payload["language_key"]
            )
            result = await db.execute(query)
            runtime = result.scalar_one_or_none()
            if runtime:
                continue

            runtime = LanguageRuntime(**payload)
            db.add(runtime)
            await db.commit()


if __name__ == "__main__":
    asyncio.run(seed_languages())
