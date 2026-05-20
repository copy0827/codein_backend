"""GitHub REST API 연동 (httpx 비동기)."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
import httpx
from fastapi import HTTPException, status

from app.schemas.boards import (
    BoardGitHubResponse,
    GitHubAuthorCommitStats,
    GitHubCommitItem,
)

_GITHUB_REPO_RE = re.compile(
    r"^https?://(?:www\.)?github\.com/(?P<owner>[^/]+)/(?P<repo>[^/]+?)(?:\.git)?/?$"
)
_API_BASE = "https://api.github.com"
_TIMEOUT = httpx.Timeout(15.0)


def parse_github_repo_url(url: str) -> tuple[str, str]:
    url = (url or "").strip()
    if not url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub 저장소 URL이 등록되어 있지 않습니다.",
        )
    match = _GITHUB_REPO_RE.match(url)
    if not match:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="올바른 GitHub 저장소 URL이 아닙니다. (예: https://github.com/owner/repo)",
        )
    owner = match.group("owner")
    repo = match.group("repo").removesuffix(".git")
    return owner, repo


def _headers(token: Optional[str] = None) -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _parse_github_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


async def fetch_repository_insights(
    github_url: str,
    *,
    token: Optional[str] = None,
) -> BoardGitHubResponse:
    owner, repo = parse_github_repo_url(github_url)
    headers = _headers(token)
    since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        try:
            repo_resp = await client.get(
                f"{_API_BASE}/repos/{owner}/{repo}",
                headers=headers,
            )
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="GitHub API에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.",
            ) from exc

        if repo_resp.status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="저장소를 찾을 수 없거나 비공개 저장소입니다.",
            )
        if repo_resp.status_code == 403:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="GitHub API 호출 한도를 초과했거나 접근이 거부되었습니다.",
            )
        if repo_resp.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="GitHub 저장소 정보를 불러오지 못했습니다.",
            )

        repo_data = repo_resp.json()
        recent_commits = await _fetch_recent_commits(
            client, owner, repo, since=since, headers=headers
        )
        author_stats, total_commits = await _fetch_contributor_stats(
            client, owner, repo, headers=headers
        )

    last_updated = _parse_github_datetime(
        repo_data.get("pushed_at") or repo_data.get("updated_at")
    )
    full_name = repo_data.get("full_name") or f"{owner}/{repo}"

    return BoardGitHubResponse(
        repository_name=full_name,
        description=repo_data.get("description"),
        last_updated=last_updated,
        total_commits=total_commits,
        recent_commits=recent_commits,
        author_commit_counts=author_stats,
    )


async def _fetch_recent_commits(
    client: httpx.AsyncClient,
    owner: str,
    repo: str,
    *,
    since: str,
    headers: dict[str, str],
) -> list[GitHubCommitItem]:
    try:
        resp = await client.get(
            f"{_API_BASE}/repos/{owner}/{repo}/commits",
            params={"since": since, "per_page": 30},
            headers=headers,
        )
    except httpx.RequestError:
        return []

    if resp.status_code >= 400:
        return []

    items: list[GitHubCommitItem] = []
    for row in resp.json():
        commit = row.get("commit") or {}
        author = commit.get("author") or {}
        items.append(
            GitHubCommitItem(
                sha=str(row.get("sha", ""))[:12],
                message=(commit.get("message") or "").split("\n", 1)[0],
                author_name=author.get("name")
                or (row.get("author") or {}).get("login"),
                committed_at=_parse_github_datetime(author.get("date"))
                or datetime.now(timezone.utc),
            )
        )
    return items


async def _fetch_contributor_stats(
    client: httpx.AsyncClient,
    owner: str,
    repo: str,
    *,
    headers: dict[str, str],
) -> tuple[list[GitHubAuthorCommitStats], int]:
    try:
        resp = await client.get(
            f"{_API_BASE}/repos/{owner}/{repo}/stats/contributors",
            headers=headers,
        )
    except httpx.RequestError:
        return [], 0

    if resp.status_code == 202:
        return [], 0
    if resp.status_code >= 400:
        return [], 0

    stats: list[GitHubAuthorCommitStats] = []
    total = 0
    for contributor in resp.json():
        author_info = contributor.get("author") or {}
        login = author_info.get("login") or "unknown"
        weeks = contributor.get("weeks") or []
        commit_count = sum(int(week.get("c", 0)) for week in weeks)
        total += commit_count
        stats.append(GitHubAuthorCommitStats(author=login, commit_count=commit_count))

    stats.sort(key=lambda item: item.commit_count, reverse=True)
    return stats, total
