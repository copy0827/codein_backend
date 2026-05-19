export interface User {
  id: number;
  email: string;
  name: string;
  student_id: string;
  major: string;
  generation: string;
  role: string;
  rank: string;
  profile_image?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  student_id: string;
  major: string;
  generation: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}
