import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { format, parseISO, isWithinInterval, isBefore } from 'date-fns';
import { Clock, Calendar, ArrowLeft, PlayCircle, Lock, AlertCircle, CheckCircle, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import { getTest, bragTest } from '../../api/codetest';
import type { TestDetail } from '../../types/codetest';

const ContestDetailPage: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const [test, setTest] = useState<TestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTest = async () => {
      if (!testId) return;
      setLoading(true);
      try {
        const data = await getTest(parseInt(testId));
        setTest(data);
      } catch (err) {
        setError('테스트 정보를 불러오는데 실패했습니다');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTest();
  }, [testId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !test) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">오류</h2>
        <p className="text-gray-600 mb-6">{error || '테스트를 찾을 수 없습니다'}</p>
        <button 
          type="button"
          onClick={() => navigate('/contest')}
          className="text-indigo-600 hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> 목록으로
        </button>
      </div>
    );
  }

  const now = new Date();
  const start = parseISO(test.start_time);
  const end = parseISO(test.end_time);
  const isOngoing = isWithinInterval(now, { start, end });
  const isUpcoming = isBefore(now, start);
  const isEnded = isBefore(end, now);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleBoastClick = async () => {
    if (!test.all_problems_attempted) {
      toast.error('모든 문제를 한 번 이상 제출해야 자랑할 수 있습니다!');
      return;
    }
    
    try {
      const { post_id } = await bragTest(test.id);
      toast.success('게시글이 성공적으로 작성되었습니다!');
      navigate(`/board/2/post/${post_id}`);
    } catch (error) {
      console.error('Failed to brag', error);
      toast.error('자랑하기에 실패했습니다. 다시 시도해 주세요.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <button 
        type="button"
        onClick={() => navigate('/contest')}
        className="flex items-center text-gray-600 hover:text-gray-900 dark:text-dark-muted dark:hover:text-dark-text mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        목록으로
      </button>

      <div className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-line overflow-hidden mb-8">
        <div className="p-8 border-b border-gray-200 dark:border-dark-line bg-gray-50/50 dark:bg-dark-bg/50">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-dark-text">{test.title}</h1>
                {isOngoing && <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 animate-pulse">진행중</span>}
                {isUpcoming && <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">예정</span>}
                {isEnded && <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-dark-pill dark:text-dark-muted">종료</span>}
              </div>
              <div className="flex flex-wrap gap-6 text-gray-600 dark:text-dark-muted mt-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-500" />
                  <span>{format(start, 'yyyy.MM.dd')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-500" />
                  <span>{format(start, 'HH:mm')} - {format(end, 'HH:mm')}</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-4">
               <div className="text-right">
                 <div className="text-sm text-gray-500 dark:text-dark-muted mb-1">총 문제 수</div>
                 <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{test.problems.length}</div>
               </div>
               <button
                 type="button"
                 onClick={handleBoastClick}
                 className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                   test.all_problems_attempted 
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50' 
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-dark-pill dark:text-gray-600'
                  }`}
                 title={test.all_problems_attempted ? "자랑하기 작성" : "모든 문제를 제출해야 자랑할 수 있습니다."}
               >
                 <Trophy className="w-4 h-4" />
                 자랑하기
               </button>
            </div>
          </div>
        </div>

        <div className="p-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-dark-text mb-6">문제 목록</h2>
          
          {isUpcoming ? (
            <div className="text-center py-16 bg-gray-50 dark:bg-dark-bg/30 rounded-lg border border-dashed border-gray-300 dark:border-dark-line">
              <Lock className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text">테스트가 아직 시작되지 않았습니다</h3>
              <p className="text-gray-500 dark:text-dark-muted mt-1">테스트가 시작되면 문제를 확인할 수 있습니다.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {test.problems.map((problem, index) => (
                <Link
                  key={problem.id}
                  to={`/contest/${test.id}/problem/${problem.id}`}
                  className="group block bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-line rounded-lg p-5 hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-md transition-all"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-dark-bg flex items-center justify-center text-gray-500 dark:text-dark-muted font-bold group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-dark-text group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-2">
                          {problem.title}
                          {problem.is_solved && (
                            <span title="해결 완료">
                              <CheckCircle className="w-5 h-5 text-emerald-500" />
                            </span>
                          )}
                        </h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${getDifficultyColor(problem.difficulty)}`}>
                            {problem.difficulty}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-dark-muted">{problem.points} pts</span>
                          <span className="w-1 h-1 bg-gray-300 dark:bg-dark-line rounded-full"></span>
                          <span className="text-sm text-gray-500 dark:text-dark-muted">응시인원: {problem.participant_count || 0}명</span>
                          <span className="w-1 h-1 bg-gray-300 dark:bg-dark-line rounded-full"></span>
                          <span className="text-sm text-gray-500 dark:text-dark-muted">정답률: {problem.success_rate || 0}%</span>
                        </div>
                      </div>
                    </div>
                    
                    <button type="button" className="p-2 text-gray-400 group-hover:text-indigo-600 transition-colors">
                      <PlayCircle className="w-6 h-6" />
                    </button>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContestDetailPage;
