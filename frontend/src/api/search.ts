import api from './axios';
import type { SearchParams, SearchResponse } from '../types/search';

export const search = async (params: SearchParams): Promise<SearchResponse> => {
  const response = await api.get<SearchResponse>('/search', { params });
  return response.data;
};
