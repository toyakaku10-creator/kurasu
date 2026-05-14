'use client';

import dynamic from 'next/dynamic';

const ResultClient = dynamic(() => import('./ResultClient'), {
  ssr: false,
  loading: () => (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#0F2340', color: '#C9A84C' }}
    >
      計算中…
    </div>
  ),
});

export default function ResultPage() {
  return <ResultClient />;
}
