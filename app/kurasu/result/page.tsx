'use client';

import dynamic from 'next/dynamic';

const ResultClient = dynamic(() => import('./ResultClient'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <span className="text-sm" style={{ color: '#C9A84C' }}>計算中…</span>
    </div>
  ),
});

export default function ResultPage() {
  return <ResultClient />;
}
