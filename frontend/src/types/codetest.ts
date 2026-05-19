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
