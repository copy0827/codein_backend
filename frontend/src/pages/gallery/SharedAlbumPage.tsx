import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { galleryApi } from '../../api/gallery';
import type { AlbumDetail } from '../../types/gallery';
import toast from 'react-hot-toast';

const SharedAlbumPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSharedAlbum = async () => {
      if (!token) return;
      try {
        setLoading(true);
        const data = await galleryApi.getSharedAlbum(token);
        setAlbum(data);
      } catch (error) {
        console.error('Failed to fetch shared album', error);
        toast.error('공유 앨범을 불러오지 못했습니다');
        navigate('/gallery');
      } finally {
        setLoading(false);
      }
    };

    fetchSharedAlbum();
  }, [token, navigate]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!album) return null;

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-200 pb-6">
        <div className="flex items-center gap-4 mb-4">
          <button
            type="button"
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
                    날짜: {new Date(album.event_date).toLocaleDateString()}
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
          <span>{album.photo_count} photos</span>
          <span className="mx-2">•</span>
          <span>Created {new Date(album.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      {album.photos.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-medium text-gray-900">No photos yet</h3>
          <p className="text-gray-500 mt-1">This album does not have any photos.</p>
          <Link to="/gallery" className="text-indigo-600 text-sm font-semibold mt-3 inline-block">
            Back to gallery
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {album.photos.map((photo) => (
            <div key={photo.id} className="aspect-square overflow-hidden rounded-lg bg-gray-100">
              <img src={photo.thumbnail_url} alt={photo.caption || album.name} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SharedAlbumPage;
