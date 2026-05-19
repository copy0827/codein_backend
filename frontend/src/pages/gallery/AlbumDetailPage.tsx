import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, X, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { galleryApi } from '../../api/gallery';
import { useAuth } from '../../context/AuthContext';
import type { AlbumDetail, ShareLink } from '../../types/gallery';
import toast from 'react-hot-toast';

const AlbumDetailPage: React.FC = () => {
  const { albumId } = useParams<{ albumId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
  const [shareDays, setShareDays] = useState(7);
  
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const fetchAlbum = async () => {
    if (!albumId) return;
    try {
      setLoading(true);
      const data = await galleryApi.getAlbum(parseInt(albumId));
      setAlbum(data);
    } catch (error) {
      console.error('Failed to fetch album', error);
      toast.error('앨범을 불러오는데 실패했습니다');
      navigate('/gallery');
    } finally {
      setLoading(false);
    }
  };

  const handleShareLink = async () => {
    if (!album) return;
    try {
      const data = await galleryApi.createShareLink(album.id, shareDays);
      setShareLink(data);
      const shareUrl = `${window.location.origin}${data.share_url}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success('공유 링크가 복사되었습니다');
    } catch (error) {
      console.error('Failed to create share link', error);
      toast.error('공유 링크 생성에 실패했습니다');
    }
  };

  useEffect(() => {
    fetchAlbum();
  }, [albumId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
      
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...selectedFiles];
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);

    const newPreviews = [...previews];
    URL.revokeObjectURL(newPreviews[index]);
    newPreviews.splice(index, 1);
    setPreviews(newPreviews);
  };

  const handleUpload = async () => {
    if (!albumId || selectedFiles.length === 0) return;

    try {
      setUploading(true);
      await galleryApi.uploadPhotos(parseInt(albumId), selectedFiles);
      toast.success('사진이 업로드되었습니다');
      
      previews.forEach(url => URL.revokeObjectURL(url));
      setSelectedFiles([]);
      setPreviews([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      await fetchAlbum();
    } catch (error) {
      console.error('Failed to upload photos', error);
      toast.error('사진 업로드에 실패했습니다');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photoId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('이 사진을 삭제하시겠습니까?')) return;

    try {
      await galleryApi.deletePhoto(photoId);
      toast.success('사진이 삭제되었습니다');
      setAlbum(prev => prev ? {
        ...prev,
        photos: prev.photos.filter(p => p.id !== photoId),
        photo_count: prev.photo_count - 1
      } : null);
    } catch (error) {
      console.error('Failed to delete photo', error);
      toast.error('사진 삭제에 실패했습니다');
    }
  };

  const handleSetCover = async (photoId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!album) return;

    try {
      const updated = await galleryApi.updateAlbum(album.id, { cover_photo_id: photoId });
      setAlbum(prev => prev ? { ...prev, cover_photo_id: updated.cover_photo_id } : prev);
      toast.success('대표 이미지가 업데이트되었습니다');
    } catch (error) {
      console.error('Failed to update cover photo', error);
      toast.error('대표 이미지 변경에 실패했습니다');
    }
  };

  const openLightbox = (index: number) => {
    setCurrentPhotoIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const nextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (album && currentPhotoIndex < album.photos.length - 1) {
      setCurrentPhotoIndex(currentPhotoIndex + 1);
    }
  };

  const prevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentPhotoIndex > 0) {
      setCurrentPhotoIndex(currentPhotoIndex - 1);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!album) return null;

  const canUpload = user && (album.visibility === 'public' || album.owner_id === user.id) && user.role !== 'member';
  const canShare = user && (album.owner_id === user.id || ['staff', 'admin', 'superadmin'].includes(user.role));

  return (
    <>
      <div className="space-y-8">
        <div className="border-b border-gray-200 pb-6">
          <div className="flex items-center gap-4 mb-4">
            <button 
              onClick={() => navigate('/gallery')}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ChevronLeft className="w-6 h-6 text-gray-500" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-dark-text">{album.name}</h1>
              {album.description && (
                <p className="mt-2 text-gray-600">{album.description}</p>
              )}
              {(album.event_name || album.event_date || album.event_location || album.participant_count || album.tagged_people) && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                  {album.event_name && (
                    <span className="rounded-full bg-gray-100 px-3 py-1">행사명: {album.event_name}</span>
                  )}
                  {album.event_date && (
                    <span className="rounded-full bg-gray-100 px-3 py-1">
                      날짜: {new Date(album.event_date).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '')}
                    </span>
                  )}
                  {album.event_location && (
                    <span className="rounded-full bg-gray-100 px-3 py-1">장소: {album.event_location}</span>
                  )}
                  {album.participant_count !== undefined && album.participant_count !== null && (
                    <span className="rounded-full bg-gray-100 px-3 py-1">참여자: {album.participant_count}명</span>
                  )}
                  {album.tagged_people && (
                    <span className="rounded-full bg-gray-100 px-3 py-1">태그: {album.tagged_people}</span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center text-sm text-gray-500 ml-12">
            <span>{album.photo_count}장</span>
            <span className="mx-2">•</span>
            <span>생성일: {new Date(album.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '')}</span>
          </div>
          {canShare && (
            <div className="ml-12 mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">공유 링크</p>
                  <p className="text-xs text-gray-500">기본 만료 7일, 필요 시 변경하세요.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={shareDays}
                    onChange={(event) => setShareDays(Number(event.target.value))}
                    className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-700"
                  />
                  <span className="text-xs text-gray-500">일</span>
                  <button
                    type="button"
                    onClick={handleShareLink}
                    className="rounded-lg bg-indigo-600 px-3 py-1 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    링크 생성
                  </button>
                </div>
              </div>
              {shareLink && (
                <div className="mt-3 text-xs text-gray-600 break-all">
                  {`${window.location.origin}${shareLink.share_url}`} (만료: {shareLink.expires_at ? new Date(shareLink.expires_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '') : '없음'})
                </div>
              )}
            </div>
          )}
        </div>

        {canUpload && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">사진 추가</h3>
            
            <div className="space-y-4">
              <div 
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  uploading ? 'bg-gray-50 border-gray-300' : 'border-gray-300 hover:border-indigo-500 hover:bg-indigo-50'
                }`}
              >
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="photo-upload"
                  ref={fileInputRef}
                  disabled={uploading}
                />
                <label 
                  htmlFor="photo-upload" 
                  className={`cursor-pointer flex flex-col items-center gap-2 ${uploading ? 'cursor-not-allowed' : ''}`}
                >
                  <Upload className={`w-10 h-10 ${uploading ? 'text-gray-400' : 'text-indigo-500'}`} />
                  <span className="text-sm font-medium text-gray-700">
                    {uploading ? '업로드 중...' : '클릭하여 사진 선택'}
                  </span>
                  <span className="text-xs text-gray-500">
                    JPG, PNG, GIF 최대 5MB
                  </span>
                </label>
              </div>

              {previews.length > 0 && (
                <div className="space-y-4">
                  <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                    {previews.map((url, idx) => (
                      <div key={idx} className="relative flex-shrink-0 w-24 h-24 group">
                        <img 
                          src={url} 
                          alt="Preview" 
                          className="w-full h-full object-cover rounded-lg" 
                        />
                        <button
                          onClick={() => removeFile(idx)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={uploading}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex justify-end">
                    <button
                      onClick={handleUpload}
                      disabled={uploading}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                    >
                      {uploading ? '업로드 중...' : `${selectedFiles.length}장 업로드`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {album.photos.map((photo, idx) => (
            <div 
              key={photo.id}
              onClick={() => openLightbox(idx)}
              className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-zoom-in"
            >
              <img
                src={photo.thumbnail_url}
                alt={photo.filename || 'Photo'}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
              
              {album.cover_photo_id === photo.id && (
                <span className="absolute top-2 left-2 rounded-full bg-indigo-600 px-2 py-1 text-xs font-semibold text-white">
                  대표
                </span>
              )}
              {user?.id === album.owner_id && (
                <button
                  type="button"
                  onClick={(e) => handleSetCover(photo.id, e)}
                  className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-1 text-xs font-semibold text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  대표 설정
                </button>
              )}
              {(user && (user.id === photo.uploader_id || user.id === album.owner_id || ['staff', 'admin', 'superadmin'].includes(user.role))) && (
                <button
                  type="button"
                  onClick={(e) => handleDeletePhoto(photo.id, e)}
                  className="absolute top-2 right-2 p-2 bg-white/90 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                  title="사진 삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {album.photos.length === 0 && !canUpload && (
          <div className="text-center py-12 text-gray-500">
            이 앨범은 비어있습니다.
          </div>
        )}
      </div>

      {lightboxOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center backdrop-blur-sm"
          onClick={closeLightbox}
        >
          <button 
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors p-2"
          >
            <X className="w-8 h-8" />
          </button>

          <button
            onClick={prevPhoto}
            className={`absolute left-4 text-white/70 hover:text-white transition-colors p-2 ${currentPhotoIndex === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
            disabled={currentPhotoIndex === 0}
          >
            <ChevronLeft className="w-10 h-10" />
          </button>

          <img
            src={album.photos[currentPhotoIndex].url}
            alt="Full size"
            className="max-h-[90vh] max-w-[90vw] object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          <button
            onClick={nextPhoto}
            className={`absolute right-4 text-white/70 hover:text-white transition-colors p-2 ${currentPhotoIndex === album.photos.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
            disabled={currentPhotoIndex === album.photos.length - 1}
          >
            <ChevronRight className="w-10 h-10" />
          </button>
          
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
            {currentPhotoIndex + 1} / {album.photos.length}
          </div>
        </div>
      )}
    </>
  );
};

export default AlbumDetailPage;
