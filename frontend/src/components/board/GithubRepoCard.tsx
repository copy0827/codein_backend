import React, { useMemo } from 'react';
import {
  AlertCircle,
  Calendar,
  FolderGit2,
  GitCommit,
  Github,
  Loader2,
  Users,
} from 'lucide-react';
import { getApiErrorMessage, useShowcaseGitHubQuery } from '../../hooks/useShowcaseBoard';
import type { GitHubAuthorCommitStats } from '../../types/board';

interface GithubRepoCardProps {
  postId: number;
  githubUrl?: string | null;
  enabled?: boolean;
}

const formatDate = (value: string) => {
  const date = new Date(value.includes('Z') || value.includes('+') ? value : `${value}Z`);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

const ContributorBars: React.FC<{ stats: GitHubAuthorCommitStats[] }> = ({ stats }) => {
  const top = stats.slice(0, 8);
  const max = Math.max(...top.map((s) => s.commit_count), 1);

  if (top.length === 0) {
    return <p className="text-sm text-gray-500">기여자 데이터가 없습니다.</p>;
  }

  return (
    <div className="space-y-2">
      {top.map((row) => (
        <div key={row.author} className="flex items-center gap-3 text-sm">
          <span className="w-24 truncate text-gray-600 shrink-0" title={row.author}>
            {row.author}
          </span>
          <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-gray-800 to-gray-600 rounded-full transition-all"
              style={{ width: `${Math.round((row.commit_count / max) * 100)}%` }}
            />
          </div>
          <span className="w-8 text-right font-mono text-xs text-gray-700 shrink-0">
            {row.commit_count}
          </span>
        </div>
      ))}
    </div>
  );
};

const GithubRepoCard: React.FC<GithubRepoCardProps> = ({
  postId,
  githubUrl,
  enabled = true,
}) => {
  const shouldFetch = enabled && !!githubUrl?.trim();

  const { data, isLoading, isError, error, refetch, isFetching } =
    useShowcaseGitHubQuery(postId, { enabled: shouldFetch });

  const recentCommits = useMemo(
    () => (data?.recent_commits ?? []).slice(0, 5),
    [data?.recent_commits],
  );

  if (!shouldFetch) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-slate-100 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <FolderGit2 className="w-5 h-5" />
          GitHub 개발 대시보드
        </h3>
        {githubUrl && (
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-lg"
          >
            <Github className="w-4 h-4" />
            저장소 열기
          </a>
        )}
      </div>

      {isLoading || isFetching ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-gray-400" />
          <p className="text-sm">GitHub 저장소 정보를 불러오는 중...</p>
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <p className="font-semibold text-amber-900 mb-1">
            GitHub 저장소 정보를 불러올 수 없습니다
          </p>
          <p className="text-sm text-amber-800/80 mb-4">
            {getApiErrorMessage(
              error,
              '저장소가 비공개이거나 URL이 올바르지 않을 수 있습니다.',
            )}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-sm font-medium text-amber-900 underline hover:no-underline"
          >
            다시 시도
          </button>
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
              Repository
            </p>
            <p className="text-lg font-bold text-gray-900 break-all">{data.repository_name}</p>
            <p className="text-sm text-gray-600 mt-2 line-clamp-3">
              {data.description || '설명이 없습니다.'}
            </p>
            {data.last_updated && (
              <p className="flex items-center gap-1.5 text-xs text-gray-400 mt-3">
                <Calendar className="w-3.5 h-3.5" />
                최근 업데이트: {formatDate(data.last_updated)}
              </p>
            )}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-3xl font-bold text-gray-900">{data.total_commits}</p>
              <p className="text-xs text-gray-500">총 커밋 수 (기여자 합산)</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 shadow-sm">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
              <Users className="w-4 h-4" />
              작성자별 커밋
            </p>
            <ContributorBars stats={data.author_commit_counts} />
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-4 sm:p-5 shadow-sm">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
              <GitCommit className="w-4 h-4" />
              최근 30일 커밋 (최대 5건)
            </p>
            {recentCommits.length === 0 ? (
              <p className="text-sm text-gray-500">최근 커밋이 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {recentCommits.map((commit) => (
                  <li
                    key={commit.sha}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 rounded-lg bg-gray-50 px-3 py-2.5 border border-gray-100"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[10px] text-gray-400">{commit.sha}</p>
                      <p className="text-sm text-gray-800 truncate">{commit.message}</p>
                    </div>
                    <div className="text-xs text-gray-500 shrink-0 sm:text-right">
                      <p>{commit.author_name || 'unknown'}</p>
                      <p>{formatDate(commit.committed_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default GithubRepoCard;
