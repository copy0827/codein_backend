import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, isBefore, isWithinInterval } from 'date-fns';
import { Calendar, Clock, FileCode, ChevronRight, Terminal } from 'lucide-react';
import { getTests } from '../../api/codetest';
import type { Test } from '../../types/codetest';

const toKstDate = (isoString: string) => {
  return new Date(isoString);
};

const getNowKst = () => new Date();

const ContestListPage: React.FC = () => {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('python');
  const [activeTab, setActiveTab] = useState<'all' | 'ongoing' | 'upcoming' | 'ended'>('all');

  useEffect(() => {
    const fetchTests = async () => {
      setLoading(true);
      try {
        const data = await getTests(selectedLanguage);
        setTests(data);
      } catch (error) {
        console.error('Failed to fetch tests', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTests();
  }, [selectedLanguage]);

  const getTestStatus = (test: Test) => {
    const now = getNowKst();
    const start = toKstDate(test.start_time);
    const end = toKstDate(test.end_time);

    if (isWithinInterval(now, { start, end })) return 'ongoing';
    if (isBefore(now, start)) return 'upcoming';
    return 'ended';
  };

  const filteredTests = tests.filter((test) => {
    if (activeTab === 'all') return true;
    return getTestStatus(test) === activeTab;
  });

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'ongoing':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 animate-pulse">진행중</span>;
      case 'upcoming':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">예정</span>;
      case 'ended':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">종료</span>;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-dark-text flex items-center gap-2">
            <Terminal className="w-8 h-8 text-indigo-600" />
            코딩테스트
          </h1>
          <p className="text-gray-600 mt-1">코딩 테스트에 참여하여 알고리즘 실력을 향상시키세요.</p>
        </div>
        <Link 
          to="/practice" 
          className="px-5 py-2.5 bg-white border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 font-medium transition-colors shadow-sm"
        >
          연습 문제
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {['python', 'javascript', 'java', 'cpp'].map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => setSelectedLanguage(lang)}
            className={`rounded-lg border px-3 py-1.5 text-xs ${selectedLanguage === lang ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {lang}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="flex overflow-x-auto border-b border-gray-200">
          {['all', 'ongoing', 'upcoming', 'ended'].map((tab) => (
            <button
              type="button"
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-6 py-4 text-sm font-medium capitalize whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50/30'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab === 'all' ? '전체' : tab === 'ongoing' ? '진행중' : tab === 'upcoming' ? '예정' : '종료'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {loading ? (
            <div className="grid gap-4 animate-pulse">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="rounded-lg border border-gray-200 p-5">
                  <div className="h-5 w-1/3 bg-gray-200 rounded mb-3" />
                  <div className="h-4 w-2/3 bg-gray-100 rounded mb-2" />
                  <div className="h-4 w-1/2 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          ) : filteredTests.length > 0 ? (
            <div className="grid gap-4">
              {filteredTests.map((test) => (
                <Link
                  key={test.id}
                  to={`/contest/${test.id}`}
                  className="group block bg-white border border-gray-200 rounded-lg p-5 hover:border-indigo-300 hover:shadow-md transition-all"
                >
                  <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                          {test.title}
                        </h3>
                        {renderStatusBadge(getTestStatus(test))}
                      </div>
                      <div className="mb-2 flex flex-wrap gap-1">
                        {(test.languages || []).map((lang) => (
                          <span key={lang} className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">
                            {lang}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>{format(toKstDate(test.start_time), 'yyyy.MM.dd HH:mm')}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span>
                            {format(toKstDate(test.start_time), 'yyyy.MM.dd HH:mm')} - {format(toKstDate(test.end_time), 'yyyy.MM.dd HH:mm')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <FileCode className="w-4 h-4 text-gray-400" />
                          <span>{test.problem_count}문제</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center text-indigo-600 font-medium text-sm group-hover:translate-x-1 transition-transform">
                      상세보기 <ChevronRight className="w-4 h-4 ml-1" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <p className="text-gray-500">{activeTab === 'all' ? '' : activeTab === 'ongoing' ? '진행중인 ' : activeTab === 'upcoming' ? '예정된 ' : '종료된 '}코딩테스트가 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContestListPage;
