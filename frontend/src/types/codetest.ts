export interface TestCase {
  id: number;
  input_data: string;
  expected_output: string;
  is_sample: boolean;
  order: number;
}

export interface Problem {
  id: number;
  test_id: number;
  title: string;
  description: string;
  language: string;
  time_limit: number;
  memory_limit: number;
  difficulty: string;
  points: number;
  is_solved?: boolean;
  participant_count?: number;
  success_rate?: number;
  sample_test_cases: TestCase[];
}

export interface Test {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  problem_count: number;
  languages?: string[];
}

export interface TestDetail extends Test {
  problems: Problem[];
  all_problems_attempted?: boolean;
}

export interface Submission {
  id: number;
  problem_id: number;
  user_id: number;
  code: string;
  language: string;
  result: string;
  execution_time: number;
  memory_used: number;
  test_cases_passed: number;
  test_cases_total: number;
  error_message: string | null;
  submitted_at: string;
}

export interface SubmitResult {
  id: number;
  result: string;
  test_cases_passed: number;
  test_cases_total: number;
  execution_time: number;
  memory_used: number;
  error_message: string | null;
}

export interface PracticeProblem {
  id: number;
  title: string;
  description: string;
  level: number;
  language: string;
  time_limit: number;
  memory_limit: number;
  difficulty: string;
  points: number;
  sample_test_cases: TestCase[];
}

export interface ProblemBankTestCasePublic {
  id: number;
  input_data: string;
  expected_output: string | null;
  is_sample: boolean;
  order: number;
}

export interface ProblemBankTestCase {
  id: number;
  problem_id: number;
  input_data: string;
  expected_output: string;
  is_sample: boolean;
  order: number;
}

export interface ProblemBank {
  id: number;
  title: string;
  description: string;
  level: number;
  language: string;
  time_limit: number;
  memory_limit: number;
  difficulty: string;
  points: number;
  is_public: boolean;
  sample_test_cases: ProblemBankTestCasePublic[];
}

export interface ProblemBankDetail extends ProblemBank {
  test_cases: ProblemBankTestCase[];
}

export interface ProblemDetail extends Problem {
  test_cases: TestCase[];
}

export interface Language {
  language_key: string;
  display_name: string;
  version: string;
  enabled: boolean;
}

// ——— Case 2: 코딩테스트 랭킹 및 통계 ———

export type CodetestStatPeriod = 'ALL' | 'SEMESTER' | 'MONTH';

export interface DifficultyTierStats {
  total: number;
  correct: number;
}

/** 난이도 키(tier_1 등) → 제출·정답 집계 */
export type DifficultyDistribution = Record<string, DifficultyTierStats>;

export interface PeriodTrendPoint {
  period_label: string;
  period_start?: string | null;
  period_end?: string | null;
  total_submissions: number;
  correct_submissions: number;
  correct_rate: number;
}

export interface RankingItem {
  rank: number;
  user_id: number;
  nickname: string;
  total_submissions: number;
  correct_submissions: number;
  correct_rate: number;
  total_score: number;
  last_activity_date: string | null;
  is_top_three: boolean;
  is_self: boolean;
  rank_tier?: string | null;
}

export interface RankingListResponse {
  total: number;
  page: number;
  size: number;
  total_pages: number;
  period_type: CodetestStatPeriod;
  items: RankingItem[];
  my_rank: number | null;
  my_item: RankingItem | null;
}

export interface UserStatDetailResponse {
  user_id: number;
  nickname: string;
  period_type: CodetestStatPeriod;
  total_submissions: number;
  correct_submissions: number;
  correct_rate: number;
  total_score: number;
  difficulty_distribution: DifficultyDistribution;
  submission_trend: PeriodTrendPoint[];
  last_activity_date: string | null;
  rank: number | null;
  rank_tier?: string | null;
}

export interface MyPageWidgetResponse {
  my_rank: number | null;
  correct_rate: number;
  month_total_submissions: number;
  month_correct_submissions: number;
  last_activity_date: string | null;
  total_score_month: number;
  period_type: CodetestStatPeriod;
}

export interface RankingListParams {
  period?: CodetestStatPeriod;
  page?: number;
  size?: number;
}
