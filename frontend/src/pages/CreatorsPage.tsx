import React from 'react';

type Creator = {
  name: string;
  image?: string;
  role: string;
  bio: string;
  contributions: string[];
};

const creators: Creator[] = [
  {
    name: '윤재훈',
    image: '/assets/creators/yoonjaehoon.png',
    role: '기획 총괄',
    bio: '’23 운영기획부 부원, ’24,’26 회장, ’25 총괄전담부 부원',
    contributions: ['홈페이지 기획 총괄']
  },
  {
    name: '이동준',
    image: '/assets/creators/leedongjun.png',
    role: '개발',
    bio: '’25 대외협력부 부원, 운영기획부 부장, ’26 부회장',
    contributions: ['데이터베이스 제작 및 디버깅']
  },
  {
    name: '김지민',
    image: '/assets/creators/kimjimin.jpg',
    role: '개발',
    bio: '’23 인사복지부 부원, ’26 운영기획부 부장',
    contributions: ['디버깅']
  },
  {
    name: '황재모',
    image: '/assets/creators/hwangjaemo.jpg',
    role: '개발',
    bio: '’24,’25 부원',
    contributions: ['api 개발']
  },
  {
    name: '이수아',
    image: '/assets/creators/isua.jpg',
    role: '개발',
    bio: "'24 운영기획부 부원, '25 회장, '26 총괄전담부 부원",
    contributions: ['백엔드 총괄']
  },
  {
    name: '송영빈',
    image: '/assets/creators/songyoungbin.jpg',
    role: '개발',
    bio: '’25,’26 부원',
    contributions: ['프론트엔드 개발']
  }
];

const CreatorsPage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <section className="rounded-3xl border border-dark-line bg-dark-card p-6 md:p-8">
        <h1 className="text-3xl md:text-4xl font-extrabold text-dark-text">만든 사람들</h1>
        <p className="mt-3 text-dark-muted leading-relaxed">
          made by 윤재훈, 이동준, 김지민, 황재모, 송영빈, 이수아
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {creators.map((creator) => (
          <article key={creator.name} className="rounded-3xl border border-dark-line bg-dark-card p-6">
            <div className="flex items-center gap-4 mb-5">
              {creator.image ? (
                <img
                  src={creator.image}
                  alt={creator.name}
                  className="w-20 h-20 rounded-2xl object-cover border border-dark-line bg-dark-cardSoft"
                  loading="lazy"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl border border-dark-line bg-dark-cardSoft flex items-center justify-center text-dark-text font-bold text-xl">
                  {creator.name.slice(0, 1)}
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold text-dark-text">{creator.name}</h2>
                <p className="text-sm text-brand-light mt-1">{creator.role}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-dark-text mb-1">약력</h3>
                <p className="text-sm text-dark-muted leading-relaxed">{creator.bio}</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-dark-text mb-2">개발사항</h3>
                <ul className="space-y-1.5 list-disc pl-5 text-sm text-dark-muted">
                  {creator.contributions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
};

export default CreatorsPage;
