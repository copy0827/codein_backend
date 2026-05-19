import api from './axios';
import type { 
  Test, 
  TestDetail, 
  Submission, 
  Language, 
  SubmitResult,
  PracticeProblem,
  ProblemBank,
  ProblemBankDetail,
  ProblemDetail
} from '../types/codetest';

export const getTests = async (language?: string): Promise<Test[]> => {
  const response = await api.get('/codetest/tests', {
    params: language ? { language } : undefined,
  });
  return response.data;
};

export const getTest = async (id: number): Promise<TestDetail> => {
  const response = await api.get(`/codetest/tests/${id}`);
  return response.data;
};

export interface TestParticipantStats {
  user_id: number;
  user_name?: string;
  student_id?: string;
  total_submissions: number;
  correct_count: number;
  wrong_count: number;
}

export const getTestParticipants = async (testId: number): Promise<TestParticipantStats[]> => {
  const response = await api.get(`/codetest/tests/${testId}/participants`);
  return response.data;
};

export const getLanguages = async (): Promise<Language[]> => {
  const response = await api.get('/codetest/languages');
  return response.data;
};

export const submitCode = async (
  problemId: number, 
  code: string, 
  language: string
): Promise<SubmitResult> => {
  const response = await api.post(`/codetest/problems/${problemId}/submit`, {
    code,
    language
  });
  return response.data;
};

export const getSubmissions = async (): Promise<Submission[]> => {
  const response = await api.get('/codetest/submissions');
  return response.data;
};

export const getProblemSubmissions = async (problemId: number): Promise<Submission[]> => {
  const response = await api.get(`/codetest/problems/${problemId}/submissions`);
  return response.data;
};

export const getPracticeProblems = async (
  level?: number, 
  count: number = 5,
  language?: string
): Promise<PracticeProblem[]> => {
  const params = { level, count, ...(language ? { language } : {}) };
  const response = await api.get('/codetest/practice/problems', { params });
  return response.data;
};

export const submitPractice = async (
  problemId: number, 
  code: string, 
  language: string
): Promise<SubmitResult> => {
  const response = await api.post('/codetest/practice/submit', {
    problem_id: problemId,
    code,
    language
  });
  return response.data;
};

export interface TestCreatePayload {
  title: string;
  start_time: string;
  end_time: string;
}

export interface TestUpdatePayload {
  title?: string;
  start_time?: string;
  end_time?: string;
}

export interface ProblemCreatePayload {
  title: string;
  description: string;
  language: string;
  time_limit: number;
  memory_limit: number;
  difficulty: string;
  points: number;
}

export interface ProblemFromBankPayload {
  problem_bank_id: number;
  title?: string;
  description?: string;
  language?: string;
  time_limit?: number;
  memory_limit?: number;
  difficulty?: string;
  points?: number;
}

export interface TestCaseCreatePayload {
  input_data: string;
  expected_output: string;
  is_sample: boolean;
  order: number;
}

export interface ProblemBankCreatePayload {
  title: string;
  description: string;
  level: number;
  language: string;
  time_limit: number;
  memory_limit: number;
  difficulty: string;
  points: number;
  is_public: boolean;
}

export interface ProblemBankUpdatePayload {
  title?: string;
  description?: string;
  level?: number;
  language?: string;
  time_limit?: number;
  memory_limit?: number;
  difficulty?: string;
  points?: number;
  is_public?: boolean;
}

export interface ProblemUpdatePayload {
  title?: string;
  description?: string;
  language?: string;
  time_limit?: number;
  memory_limit?: number;
  difficulty?: string;
  points?: number;
}

export interface ProblemBankTestCaseCreatePayload {
  input_data: string;
  expected_output: string;
  is_sample: boolean;
  order: number;
}

export const createTest = async (payload: TestCreatePayload): Promise<void> => {
  await api.post('/codetest/tests', payload);
};

export const updateTest = async (
  testId: number,
  payload: TestUpdatePayload
): Promise<void> => {
  await api.put(`/codetest/tests/${testId}`, payload);
};

export const deleteTest = async (testId: number): Promise<void> => {
  await api.delete(`/codetest/tests/${testId}`);
};

export const addProblemToTest = async (
  testId: number,
  payload: ProblemCreatePayload
): Promise<void> => {
  await api.post(`/codetest/tests/${testId}/problems`, payload);
};

export const addProblemFromBank = async (
  testId: number,
  payload: ProblemFromBankPayload
): Promise<void> => {
  await api.post(`/codetest/tests/${testId}/problems/from-bank`, payload);
};

export const updateProblem = async (
  problemId: number,
  payload: ProblemUpdatePayload
): Promise<void> => {
  await api.put(`/codetest/problems/${problemId}`, payload);
};

export const deleteProblem = async (problemId: number): Promise<void> => {
  await api.delete(`/codetest/problems/${problemId}`);
};

export const getProblemDetail = async (problemId: number): Promise<ProblemDetail> => {
  const response = await api.get(`/codetest/problems/${problemId}`);
  return response.data;
};

export const addTestCase = async (
  problemId: number,
  payload: TestCaseCreatePayload
): Promise<void> => {
  await api.post(`/codetest/problems/${problemId}/testcases`, payload);
};

export const getProblemBankList = async (params?: { skip?: number; limit?: number; level?: number }): Promise<ProblemBank[]> => {
  const response = await api.get('/codetest/problem-bank', { params });
  return response.data;
};

export const getProblemBankDetail = async (problemId: number): Promise<ProblemBankDetail> => {
  const response = await api.get(`/codetest/problem-bank/${problemId}`);
  return response.data;
};

export const createProblemBank = async (payload: ProblemBankCreatePayload): Promise<ProblemBankDetail> => {
  const response = await api.post('/codetest/problem-bank', payload);
  return response.data;
};

export const updateProblemBank = async (
  problemId: number,
  payload: ProblemBankUpdatePayload
): Promise<ProblemBankDetail> => {
  const response = await api.put(`/codetest/problem-bank/${problemId}`, payload);
  return response.data;
};

export const addProblemBankTestCase = async (
  problemId: number,
  payload: ProblemBankTestCaseCreatePayload
): Promise<void> => {
  await api.post(`/codetest/problem-bank/${problemId}/testcases`, payload);
};

export const updateProblemBankTestCase = async (
  testcaseId: number,
  payload: ProblemBankTestCaseCreatePayload
): Promise<void> => {
  await api.put(`/codetest/problem-bank/testcases/${testcaseId}`, payload);
};

export const deleteProblemBankTestCase = async (testcaseId: number): Promise<void> => {
  await api.delete(`/codetest/problem-bank/testcases/${testcaseId}`);
};

export const deleteProblemBank = async (problemId: number): Promise<void> => {
  await api.delete(`/codetest/problem-bank/${problemId}`);
};

export const updateTestCase = async (
  testcaseId: number,
  payload: TestCaseCreatePayload
): Promise<void> => {
  await api.put(`/codetest/testcases/${testcaseId}`, payload);
};

export const deleteTestCase = async (testcaseId: number): Promise<void> => {
  await api.delete(`/codetest/testcases/${testcaseId}`);
};

export const bragTest = async (testId: number): Promise<{ post_id: number }> => {
  const response = await api.post(`/codetest/tests/${testId}/brag`);
  return response.data;
};
