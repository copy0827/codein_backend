import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Image as ImageIcon } from 'lucide-react';
import { galleryApi } from '../../api/gallery';
import { useAuth } from '../../context/AuthContext';
import type { Album } from '../../types/gallery';
import toast from 'react-hot-toast';

const AlbumCover: React.FC<{ photoId?: number; coverThumbnailUrl?: string | null }> = ({ photoId, coverThumbnailUrl }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (coverThumbnailUrl) {
      setImageUrl(coverThumbnailUrl);
      return;
    }
    if (photoId) {
      galleryApi.getPhoto(photoId)
        .then(photo => setImageUrl(photo.thumbnail_url))
        .catch(() => setImageUrl(null));
    }
  }, [photoId]);

  if (!imageUrl) {
    return (
      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
        <ImageIcon className="w-12 h-12 text-gray-400" />
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt="Album cover"
      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
    />
  );
};

const GalleryListPage: React.FC = () => {
  const { user } = useAuth();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumDesc, setNewAlbumDesc] = useState('');
  const [newAlbumVisibility, setNewAlbumVisibility] = useState<'public' | 'members' | 'staff' | 'private'>('public');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [participantCount, setParticipantCount] = useState('');
  const [taggedPeople, setTaggedPeople] = useState('');
  const [taggingConsent, setTaggingConsent] = useState(false);

  const fetchAlbums = useCallback(async () => {
    try {
      const response = await galleryApi.getAlbums();
      setAlbums(response.albums);
    } catch (error) {
      console.error('Failed to fetch albums', error);
      toast.error('앨범 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlbumName.trim()) return;

    try {
      await galleryApi.createAlbum({
        name: newAlbumName,
        description: newAlbumDesc,
        visibility: newAlbumVisibility,
        event_name: eventName || undefined,
        event_date: eventDate || undefined,
        event_location: eventLocation || undefined,
        participant_count: participantCount ? Number(participantCount) : undefined,
        tagged_people: taggedPeople || undefined,
        tagging_consent: taggingConsent
      });
      toast.success('앨범이 생성되었습니다');
      setNewAlbumName('');
      setNewAlbumDesc('');
      setNewAlbumVisibility('public');
      setEventName('');
      setEventDate('');
      setEventLocation('');
      setParticipantCount('');
      setTaggedPeople('');
      setTaggingConsent(false);
      setIsCreating(false);
      fetchAlbums();
    } catch (error) {
      console.error('Failed to create album', error);
      toast.error('앨범 생성에 실패했습니다');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-dark-text">갤러리</h1>
          <p className="mt-1 text-gray-500">사진 모음을 둘러보고 공유하세요</p>
        </div>
        {user && ['staff', 'admin', 'superadmin'].includes(user.role) && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-light transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            앨범 생성
          </button>
        )}
      </div>

      {isCreating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
          <div className="bg-dark-card border border-dark-line rounded-2xl shadow-xl max-w-4xl w-full p-6 animate-in fade-in zoom-in-95 duration-200 text-dark-text">
            <h2 className="text-xl font-bold mb-4">새 앨범</h2>
            <form onSubmit={handleCreateAlbum} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="album-name" className="block text-sm font-medium text-dark-muted mb-1">
                  앨범 이름
                </label>
                <input
                  id="album-name"
                  type="text"
                  value={newAlbumName}
                  onChange={(e) => setNewAlbumName(e.target.value)}
                  className="w-full px-3 py-2 border border-dark-line rounded-lg bg-dark-cardSoft text-dark-text placeholder:text-dark-muted focus:outline-none focus:border-brand"
                  placeholder="2024 여름 여행"
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="album-description" className="block text-sm font-medium text-dark-muted mb-1">
                  설명
                </label>
                <textarea
                  id="album-description"
                  value={newAlbumDesc}
                  onChange={(e) => setNewAlbumDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-dark-line rounded-lg bg-dark-cardSoft text-dark-text placeholder:text-dark-muted focus:outline-none focus:border-brand"
                  placeholder="앨범 설명 (선택사항)..."
                  rows={3}
                />
              </div>
              <div>
                <label htmlFor="album-visibility" className="block text-sm font-medium text-dark-muted mb-1">
                  공개 범위
                </label>
                <select
                  id="album-visibility"
                  value={newAlbumVisibility}
                  onChange={(e) => setNewAlbumVisibility(e.target.value as 'public' | 'members' | 'staff' | 'private')}
                  className="w-full px-3 py-2 border border-dark-line rounded-lg bg-dark-bg text-dark-text focus:outline-none focus:border-brand"
                >
                  <option value="public">전체 공개</option>
                  <option value="members">회원만</option>
                  <option value="staff">운영진 전용</option>
                  <option value="private">비공개(소유자)</option>
                </select>
              </div>
              <div>
                <label htmlFor="album-event-name" className="block text-sm font-medium text-dark-muted mb-1">
                  행사명
                </label>
                <input
                  id="album-event-name"
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full px-3 py-2 border border-dark-line rounded-lg bg-dark-cardSoft text-dark-text placeholder:text-dark-muted focus:outline-none focus:border-brand"
                  placeholder="예: 2024 봄 해커톤"
                />
              </div>
              <div>
                <label htmlFor="album-event-date" className="block text-sm font-medium text-dark-muted mb-1">
                  행사 날짜
                </label>
                <input
                  id="album-event-date"
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-3 py-2 border border-dark-line rounded-lg bg-dark-cardSoft text-dark-text focus:outline-none focus:border-brand"
                />
              </div>
              <div>
                <label htmlFor="album-event-location" className="block text-sm font-medium text-dark-muted mb-1">
                  행사 장소
                </label>
                <input
                  id="album-event-location"
                  type="text"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-dark-line rounded-lg bg-dark-cardSoft text-dark-text placeholder:text-dark-muted focus:outline-none focus:border-brand"
                  placeholder="예: 302호"
                />
              </div>
              <div>
                <label htmlFor="album-participants" className="block text-sm font-medium text-dark-muted mb-1">
                  참여자 수
                </label>
                <input
                  id="album-participants"
                  type="number"
                  min="0"
                  value={participantCount}
                  onChange={(e) => setParticipantCount(e.target.value)}
                  className="w-full px-3 py-2 border border-dark-line rounded-lg bg-dark-cardSoft text-dark-text placeholder:text-dark-muted focus:outline-none focus:border-brand"
                  placeholder="예: 18"
                />
              </div>
              <div>
                <label htmlFor="album-tagged-people" className="block text-sm font-medium text-dark-muted mb-1">
                  인물 태그
                </label>
                <input
                  id="album-tagged-people"
                  type="text"
                  value={taggedPeople}
                  onChange={(e) => setTaggedPeople(e.target.value)}
                  className="w-full px-3 py-2 border border-dark-line rounded-lg bg-dark-cardSoft text-dark-text placeholder:text-dark-muted focus:outline-none focus:border-brand"
                  placeholder="쉼표로 구분 (예: 김코드, 박인턴)"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-dark-text md:col-span-2">
                <input
                  type="checkbox"
                  checked={taggingConsent}
                  onChange={(e) => setTaggingConsent(e.target.checked)}
                  className="h-4 w-4 rounded border-dark-line bg-dark-bg text-brand focus:ring-brand"
                />
                태그 대상 동의 확인
              </label>
              <div className="flex justify-end gap-3 pt-2 md:col-span-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-dark-text border border-dark-line rounded-lg hover:bg-dark-cardSoft transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!newAlbumName.trim()}
                  className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  생성
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : albums.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <ImageIcon className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">아직 앨범이 없습니다</h3>
          <p className="text-gray-500 mt-1">첫 번째 앨범을 만들어보세요!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {albums.map((album) => (
            <Link
              key={album.id}
              to={`/gallery/${album.id}`}
              className="group block bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-gray-100"
            >
              <div className="aspect-square relative overflow-hidden bg-gray-100">
                <AlbumCover photoId={album.cover_photo_id} coverThumbnailUrl={album.cover_photo?.thumbnail_url ?? null} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors truncate">
                  {album.name}
                </h3>
                <div className="mt-1 flex justify-between items-center text-sm text-gray-500">
                  <span>{album.photo_count}장</span>
                  <span>{new Date(album.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '')}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default GalleryListPage;
