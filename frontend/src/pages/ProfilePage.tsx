import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { getNotificationSettings, updateNotificationSettings } from '../api/notifications';
import { getMyPointsSummary } from '../api/activity';
import { getRankColor, getRankIcon } from '../components/activity/ActivitySummaryCard';
import type { NotificationSettings } from '../types/notification';
import type { PointsSummary } from '../types/activity';
import {
  Camera,
  Save,
  Bell,
  TrendingUp,
  TrendingDown,
  User,
  Smartphone,
  Trash2,
  Upload,
  Trophy,
  Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';

const ROLE_LABELS: Record<string, string> = {
  guest: '게스트',
  member: '회원',
  staff: '운영진',
  admin: '관리자',
  superadmin: '슈퍼관리자'
};

const RANK_LABELS: Record<string, string> = {
  unranked: '언랭크',
  bronze: '브론즈',
  silver: '실버',
  gold: '골드',
  platinum: '플래티넘',
  diamond: '다이아'
};

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  // We'll reload the user from context or fetch fresh if needed.
  // Ideally, AuthContext should expose a reloadUser function, but for now we might just rely on window.location.reload() or internal state if we want to see immediate updates without context refresh limitations.
  // Actually, let's just fetch the profile again to get fresh data including settings if they are there.

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showImageMenu, setShowImageMenu] = useState(false);
  const imageMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<NotificationSettings>({
    email_enabled: true,
    web_push_enabled: true,
    reminder_24h: true,
    reminder_1h: true,
    notify_new_post: true,
    notify_comment_reply: true,
    notify_event_reminder: true,
    notify_event_update: true,
    notify_mention: true,
    notify_system: true,
  });
  
  // Custom Profile Data State
  const [profileData, setProfileData] = useState({
    student_id: user?.student_id || '',
    major: user?.major || '',
    generation: user?.generation || '',
  });

  const [summary, setSummary] = useState<PointsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const fetchNotificationSettings = React.useCallback(async () => {
    try {
      const data = await getNotificationSettings();
      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch settings', error);
    }
  }, []);

  const fetchSummary = React.useCallback(async () => {
    try {
      const data = await getMyPointsSummary();
      setSummary(data);
    } catch (error) {
      console.error('Failed to fetch points summary', error);
      toast.error('포인트 정보를 불러오는데 실패했습니다.');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotificationSettings();
  }, [fetchNotificationSettings]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('이미지 크기는 5MB 이하여야 합니다.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      await api.post('/profile/me/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('프로필 이미지가 업데이트되었습니다!');
      // Refresh page to show new image since AuthContext might not update immediately
      window.location.reload();
    } catch (error) {
      console.error(error);
      toast.error('이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleImageDelete = async () => {
    if (!user?.profile_image) return;

    setShowImageMenu(false);
    if (!window.confirm('프로필 사진을 삭제하시겠습니까?')) return;

    setUploading(true);
    try {
      await api.delete('/profile/me/image');
      toast.success('프로필 이미지가 삭제되었습니다!');
      window.location.reload();
    } catch (error) {
      console.error(error);
      toast.error('이미지 삭제에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadClick = () => {
    setShowImageMenu(false);
    fileInputRef.current?.click();
  };

  const handleSettingChange = (key: keyof NotificationSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      // Update both settings and profile details concurrently
      await Promise.all([
        updateNotificationSettings({ ...settings }),
        api.put('/profile/me', profileData)
      ]);
      toast.success('프로필 및 설정이 저장되었습니다!');
      // Update local storage user proxy if needed or let refresh handle it natively
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error(error);
      toast.error('설정 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const rankStyles = summary ? getRankColor(summary.rank) : null;

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 text-dark-text">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">프로필 설정</h1>
          <p className="text-dark-muted">계정 설정 및 기본 설정을 관리합니다.</p>
        </div>
        <button 
          type="button"
          onClick={saveSettings}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 bg-brand !text-white rounded-xl hover:bg-brand-light transition-colors disabled:opacity-50 font-medium shadow-lg shadow-brand/20"
        >
          <Save className="w-4 h-4" />
          {loading ? '저장 중...' : '변경사항 저장'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
        {/* Left Column: Profile Card */}
        <div className="md:col-span-3 space-y-6">
          <div className="bg-dark-card rounded-2xl shadow-sm border border-dark-line p-8 text-center overflow-hidden relative group">
            <div className="absolute top-0 left-0 w-full h-28 bg-gradient-to-r from-brand to-purple-600"></div>
            <div className="relative mt-10 mb-4">
              <div className="w-28 h-28 mx-auto rounded-full bg-dark-card p-1 shadow-lg relative">
                <div className="w-full h-full rounded-full bg-dark-cardSoft overflow-hidden relative border border-dark-line">
                  {user.profile_image ? (
                    <img src={user.profile_image} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-dark-muted">
                      <User className="w-10 h-10" />
                    </div>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                <div className="absolute bottom-0 right-0" ref={imageMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowImageMenu(!showImageMenu)}
                    disabled={uploading}
                    className="p-2 bg-dark-cardSoft rounded-full shadow-md border border-dark-line cursor-pointer hover:bg-dark-nav transition-colors text-dark-text disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                  />
                  {showImageMenu && (
                    <div className="absolute bottom-full left-0 mb-2 w-36 bg-dark-card rounded-lg shadow-lg border border-dark-line py-1 z-10">
                      <button
                        type="button"
                        onClick={handleUploadClick}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-dark-muted hover:bg-dark-cardSoft hover:text-dark-text transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                        사진 업로드
                      </button>
                      {user.profile_image && (
                        <button
                          type="button"
                          onClick={handleImageDelete}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          사진 삭제
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-dark-text">{user.name}</h2>
            <p className="text-dark-muted text-base mb-4">{user.email}</p>
            
            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-400 text-xs font-semibold uppercase tracking-wider border border-indigo-500/20">
                {ROLE_LABELS[user.role] || user.role}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 text-xs font-semibold uppercase tracking-wider border border-amber-500/20">
                {RANK_LABELS[user.rank] || user.rank}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-dark-line pt-4 text-left mt-6">
              <div>
                <p className="text-xs text-dark-muted uppercase tracking-wider font-medium mb-1">학번</p>
                <input
                  type="text"
                  name="student_id"
                  value={profileData.student_id}
                  onChange={handleProfileChange}
                  className="w-full bg-dark-bg border border-dark-line rounded-lg px-3 py-2 text-dark-text font-medium focus:ring-1 focus:ring-brand focus:border-brand transition-all"
                  placeholder="예: 20211111"
                />
              </div>
              <div>
                <p className="text-xs text-dark-muted uppercase tracking-wider font-medium mb-1">전공</p>
                <input
                  type="text"
                  name="major"
                  value={profileData.major}
                  onChange={handleProfileChange}
                  className="w-full bg-dark-bg border border-dark-line rounded-lg px-3 py-2 text-dark-text font-medium focus:ring-1 focus:ring-brand focus:border-brand transition-all"
                  placeholder="예: 컴퓨터공학과"
                />
              </div>
              <div className="col-span-2">
                <p className="text-xs text-dark-muted uppercase tracking-wider font-medium mb-1">기수</p>
                <input
                  type="text"
                  name="generation"
                  value={profileData.generation}
                  onChange={handleProfileChange}
                  className="w-full bg-dark-bg border border-dark-line rounded-lg px-3 py-2 text-dark-text font-medium focus:ring-1 focus:ring-brand focus:border-brand transition-all"
                  placeholder="예: 1기"
                />
              </div>
            </div>
          </div>

          <div className="bg-dark-card rounded-2xl shadow-sm border border-dark-line p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-dark-text flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  활동 포인트
                </h3>
                <p className="text-dark-muted text-sm">현재 포인트와 랭크 현황을 확인하세요.</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/activity')}
                className="text-xs bg-dark-cardSoft text-dark-text px-3 py-1.5 rounded-lg font-semibold border border-dark-line hover:bg-dark-nav transition-colors"
              >
                활동 내역 보기
              </button>
            </div>

            {summaryLoading ? (
              <div className="mt-6 text-sm text-dark-muted">포인트 정보를 불러오는 중...</div>
            ) : summary ? (
              <div className="mt-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                  <div>
                    <p className="text-sm text-dark-muted">현재 포인트</p>
                    <p className="text-3xl font-bold text-dark-text">
                      {summary.current_points.toLocaleString()}
                      <span className="text-sm text-dark-muted ml-1">pts</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 bg-dark-cardSoft border border-dark-line px-4 py-3 rounded-xl">
                    <span className={rankStyles?.icon ?? 'text-amber-400'}>
                      {getRankIcon(summary.rank, 'w-5 h-5')}
                    </span>
                    <div>
                      <p className="text-sm text-dark-muted uppercase">현재 랭크</p>
                      <p className="text-base font-semibold text-dark-text">{RANK_LABELS[summary.rank] || summary.rank}</p>
                    </div>
                  </div>
                </div>

                {summary.next_rank && summary.points_to_next_rank !== null && (
                  <p className="text-xs text-dark-muted">
                    다음 랭크까지 {summary.points_to_next_rank.toLocaleString()} pts 남았습니다.
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-dark-cardSoft border border-dark-line rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-300">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs text-dark-muted">총 적립</p>
                        <p className="text-lg font-semibold text-dark-text">+{summary.total_earned.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-dark-cardSoft border border-dark-line rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-rose-500/10 text-rose-300">
                        <TrendingDown className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs text-dark-muted">총 사용</p>
                        <p className="text-lg font-semibold text-dark-text">-{summary.total_spent.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-dark-cardSoft border border-dark-line rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-sky-500/10 text-sky-300">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs text-dark-muted">이번 달</p>
                        <p className="text-lg font-semibold text-dark-text">+{summary.this_month_earned.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 text-sm text-dark-muted">포인트 정보를 불러올 수 없습니다.</div>
            )}
          </div>
        </div>

        {/* Right Column: Settings */}
        <div className="md:col-span-2 space-y-6">
          {/* Notification Preferences */}
          <div className="bg-dark-card rounded-2xl shadow-sm border border-dark-line overflow-hidden">
            <div className="p-4 border-b border-dark-line">
              <h3 className="text-lg font-bold text-dark-text flex items-center gap-2">
                <Bell className="w-5 h-5 text-brand" />
                알림 설정
              </h3>
              <p className="text-dark-muted text-sm mt-1">알림 수신 방법과 시기를 선택하세요.</p>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-dark-text uppercase tracking-wider">수신 채널</h4>
                
                {/* 이메일 수신 채널은 임시로 비활성화합니다. */}
                {/* <label className={`flex items-center justify-between p-5 rounded-xl border transition-all cursor-pointer group ${settings.email_enabled ? 'border-brand/60 bg-brand/10' : 'border-dark-line hover:border-brand hover:bg-brand/5'}`}>
                  <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                    <div className={`p-2 rounded-lg transition-colors ${settings.email_enabled ? 'bg-brand/20 text-brand-light' : 'bg-dark-cardSoft text-dark-muted'}`}>
                      <Mail className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-dark-text group-hover:text-brand-light transition-colors">이메일 알림</p>
                      <p className="text-sm text-dark-muted leading-5 min-h-[2.5rem]">일일 요약 및 중요 업데이트를 받습니다.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-semibold uppercase inline-flex items-center justify-center w-10 text-center ${settings.email_enabled ? 'text-brand-light' : 'text-dark-muted'}`}>
                      {settings.email_enabled ? 'ON' : 'OFF'}
                    </span>
                    <div className={`w-12 h-7 rounded-full border border-dark-line transition-colors relative shadow-inner ${settings.email_enabled ? 'bg-brand shadow-brand/40' : 'bg-dark-line'}`}>
                      <input type="checkbox" className="hidden" checked={settings.email_enabled} onChange={() => handleSettingChange('email_enabled')} />
                      <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${settings.email_enabled ? 'left-6' : 'left-1'}`} />
                    </div>
                  </div>
                </label> */}

                <label className={`flex items-center justify-between p-5 rounded-xl border transition-all cursor-pointer group ${settings.web_push_enabled ? 'border-brand/60 bg-brand/10' : 'border-dark-line hover:border-brand hover:bg-brand/5'}`}>
                  <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                    <div className={`p-2 rounded-lg transition-colors ${settings.web_push_enabled ? 'bg-brand/20 text-brand-light' : 'bg-dark-cardSoft text-dark-muted'}`}>
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-dark-text group-hover:text-brand-light transition-colors">웹 푸시</p>
                      <p className="text-xs text-dark-muted leading-5 min-h-[2.5rem]">브라우저에서 실시간 알림을 받습니다.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-xs font-semibold uppercase inline-flex items-center justify-center w-10 text-center ${settings.web_push_enabled ? 'text-brand-light' : 'text-dark-muted'}`}
                    >
                      {settings.web_push_enabled ? 'ON' : 'OFF'}
                    </span>
                    <div className={`w-12 h-7 rounded-full transition-colors relative shadow-inner ${settings.web_push_enabled ? 'bg-brand shadow-brand/40 border border-brand' : 'bg-gray-300 dark:bg-dark-line border border-gray-400 dark:border-dark-line'}`}>
                      <input type="checkbox" className="hidden" checked={settings.web_push_enabled} onChange={() => handleSettingChange('web_push_enabled')} />
                      <div className={`absolute top-[3px] w-5 h-5 rounded-full bg-white shadow-md border border-gray-200 transition-transform ${settings.web_push_enabled ? 'left-[22px]' : 'left-[3px]'}`} />
                    </div>
                  </div>
                </label>
              </div>

              <div className="space-y-4 pt-2">
                <h4 className="text-sm font-semibold text-dark-text uppercase tracking-wider">일정 미리 알림</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-dark-cardSoft cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-brand rounded border-dark-line bg-dark-bg focus:ring-brand focus:ring-offset-0"
                      checked={settings.reminder_24h}
                      onChange={() => handleSettingChange('reminder_24h')}
                    />
                    <span className="text-sm text-dark-muted group-hover:text-dark-text">24시간 전</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-dark-cardSoft cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-brand rounded border-dark-line bg-dark-bg focus:ring-brand focus:ring-offset-0"
                      checked={settings.reminder_1h}
                      onChange={() => handleSettingChange('reminder_1h')}
                    />
                    <span className="text-sm text-dark-muted group-hover:text-dark-text">1시간 전</span>
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center justify-between py-2 group hover:bg-dark-cardSoft/50 px-2 rounded-lg transition-colors cursor-pointer">
                    <span className="text-sm text-dark-muted group-hover:text-dark-text">일정 알림</span>
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-brand rounded border-dark-line bg-dark-bg focus:ring-brand focus:ring-offset-0"
                      checked={settings.notify_event_reminder}
                      onChange={() => handleSettingChange('notify_event_reminder')}
                    />
                  </label>
                  <label className="flex items-center justify-between py-2 group hover:bg-dark-cardSoft/50 px-2 rounded-lg transition-colors cursor-pointer">
                    <span className="text-sm text-dark-muted group-hover:text-dark-text">일정 업데이트</span>
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-brand rounded border-dark-line bg-dark-bg focus:ring-brand focus:ring-offset-0"
                      checked={settings.notify_event_update}
                      onChange={() => handleSettingChange('notify_event_update')}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <h4 className="text-sm font-semibold text-dark-text uppercase tracking-wider">활동 알림</h4>
                
                <div className="space-y-2">
                  <label className="flex items-center justify-between py-2 group hover:bg-dark-cardSoft/50 px-2 rounded-lg transition-colors cursor-pointer">
                    <span className="text-sm text-dark-muted group-hover:text-dark-text">내 글/댓글에 대한 답글</span>
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-brand rounded border-dark-line bg-dark-bg focus:ring-brand focus:ring-offset-0"
                      checked={settings.notify_comment_reply}
                      onChange={() => handleSettingChange('notify_comment_reply')}
                    />
                  </label>
                  <label className="flex items-center justify-between py-2 group hover:bg-dark-cardSoft/50 px-2 rounded-lg transition-colors cursor-pointer">
                    <span className="text-sm text-dark-muted group-hover:text-dark-text">멘션</span>
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-brand rounded border-dark-line bg-dark-bg focus:ring-brand focus:ring-offset-0"
                      checked={settings.notify_mention}
                      onChange={() => handleSettingChange('notify_mention')}
                    />
                  </label>
                  <label className="flex items-center justify-between py-2 group hover:bg-dark-cardSoft/50 px-2 rounded-lg transition-colors cursor-pointer">
                    <span className="text-sm text-dark-muted group-hover:text-dark-text">시스템 공지</span>
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-brand rounded border-dark-line bg-dark-bg focus:ring-brand focus:ring-offset-0"
                      checked={settings.notify_system}
                      onChange={() => handleSettingChange('notify_system')}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
