import api from './axios';
import type { Album, AlbumCreate, AlbumListResponse, AlbumDetail, Photo, PhotoUploadResponse, ShareLink } from '../types/gallery';

export const galleryApi = {
  getAlbums: async (skip = 0, limit = 20, visibility?: string) => {
    const params = new URLSearchParams();
    params.append('skip', skip.toString());
    params.append('limit', limit.toString());
    if (visibility) params.append('visibility', visibility);
    
    const response = await api.get<AlbumListResponse>(`/gallery/albums?${params.toString()}`);
    return response.data;
  },

  createAlbum: async (data: AlbumCreate) => {
    const response = await api.post<Album>('/gallery/albums', data);
    return response.data;
  },

  updateAlbum: async (id: number, data: Partial<AlbumCreate>) => {
    const response = await api.put<Album>(`/gallery/albums/${id}`, data);
    return response.data;
  },

  getAlbum: async (id: number) => {
    const response = await api.get<AlbumDetail>(`/gallery/albums/${id}`);
    return response.data;
  },

  deleteAlbum: async (id: number) => {
    const response = await api.delete(`/gallery/albums/${id}`);
    return response.data;
  },

  uploadPhotos: async (albumId: number, files: FileList | File[]) => {
    const formData = new FormData();
    const fileArray = Array.from(files);
    
    fileArray.forEach((file) => {
      formData.append('files', file);
    });

    const response = await api.post<{ uploaded_count: number; photos: PhotoUploadResponse[] }>(
      `/gallery/albums/${albumId}/photos`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  deletePhoto: async (photoId: number) => {
    const response = await api.delete(`/gallery/photos/${photoId}`);
    return response.data;
  },
  
  getPhoto: async (photoId: number) => {
    const response = await api.get<Photo>(`/gallery/photos/${photoId}`);
    return response.data;
  },

  createShareLink: async (albumId: number, expiresInDays?: number) => {
    const response = await api.post<ShareLink>(`/gallery/albums/${albumId}/share`, {
      expires_in_days: expiresInDays,
    });
    return response.data;
  },

  getSharedAlbum: async (token: string) => {
    const response = await api.get<AlbumDetail>(`/gallery/share/${token}`);
    return response.data;
  }
};
