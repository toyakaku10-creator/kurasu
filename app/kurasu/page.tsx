'use client';

import dynamic from 'next/dynamic';

const SimulatorClient = dynamic(() => import('./SimulatorClient'), { ssr: false });

export default function KurasuPage() {
  return <SimulatorClient />;
}
