'use client';

import dynamic from 'next/dynamic';

const InputClient = dynamic(() => import('./InputClient'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <span className="text-sm" style={{ color: '#C9A84C' }}>Loading…</span>
    </div>
  ),
});

export default function KurasuPage() {
  return <InputClient />;
}
