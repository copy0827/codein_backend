export interface Photo {
  id: number;
  album_id: number;
  url: string;
  thumbnail_url: string;
  filename?: string;
  file_size?: number;
  width?: number;
  height?: number;
  uploader_id?: number;
  display_order: number;
  caption?: string;
  uploaded_at: string;
}

export interface PhotoUploadResponse {
  id: number;
  url: string;
  thumbnail_url: string;
  filename: string;
  file_size: number;
  width?: number;
  height?: number;
}

export interface Album {
  id: number;
  name: string;
  description?: string;
  visibility: 'public' | 'members' | 'staff' | 'private';
  owner_id: number;
  cover_photo_id?: number;
  cover_photo?: Photo;
  photo_count: number;
  event_name?: string;
  event_date?: string;
  event_location?: string;
  participant_count?: number;
  tagged_people?: string;
  tagging_consent?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface AlbumDetail extends Album {
  photos: Photo[];
}

export interface AlbumCreate {
  name: string;
  description?: string;
  visibility?: 'public' | 'members' | 'staff' | 'private';
  cover_photo_id?: number;
  event_name?: string;
  event_date?: string;
  event_location?: string;
  participant_count?: number;
  tagged_people?: string;
  tagging_consent?: boolean;
}

export interface AlbumListResponse {
  total: number;
  albums: Album[];
}

export interface ShareLink {
  token: string;
  share_url: string;
  expires_at?: string;
}
