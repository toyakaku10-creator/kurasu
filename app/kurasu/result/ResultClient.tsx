'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ReferenceLine,
} from 'recharts';
import {
  simulate, DEFAULT_PARAMS, getFireAge, getSurplusAge, getAssetLifetime,
} from '../simulation';
import type { Params } from '../simulation';

// ── Design tokens ─────────────────────────────
const GOLD   = '#C9A84C';
const NAVY   = '#0F2340';
const BG     = '#FFFFFF';
const CARD   = '#F8F9FA';
const BORDER = '#E9ECEF';
const SUB    = '#6B7280';
const RED    = '#dc2626';
const GREEN  = '#16a34a';

const CHART = {
  dividend:      GOLD,
  ideco:         NAVY,
  retirement:    '#d97706',
  pension:       '#2563eb',
  pensionBenefit:'#0d9488',
  expense:       RED,
  stocks:        GOLD,
  gold:          '#d97706',
  cash:          '#9ca3af',
  crypto:        '#f97316',
  iDeCoFund:     NAVY,
};

// ── Formatters ────────────────────────────────
const man = (v: number) => {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}億`;
  if (v >= 10_000) return `${Math.round(v / 10_000)}万`;
  return `${Math.round(v).toLocaleString()}円`;
};
const manAxis = (v: number) => `${Math.round(v / 10_000)}万`;

// ── localStorage ──────────────────────────────
const LS_KEY = 'kurasu-params-v1';

function loadParams(): Params {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULT_PARAMS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_PARAMS;
}

// ── Custom tooltip ─────────────────────────────
interface TipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
}

function CustomTooltip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl p-3 text-xs shadow-lg"
      style={{ background: BG, border: `1px solid ${BORDER}` }}>
      <p className="font-bold mb-2" style={{ color: NAVY }}>{label}歳</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono" style={{ color: NAVY }}>{man(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Badge ─────────────────────────────────────
function Badge({ label, value, sub, variant = 'default' }: {
  label: string; value: string; sub?: string;
  variant?: 'gold' | 'navy' | 'default';
}) {
  const styles: Record<string, React.CSSProperties> = {
    gold:    { background: GOLD,  color: NAVY,  border: 'none' },
    navy:    { background: NAVY,  color: '#fff', border: 'none' },
    default: { background: CARD,  color: NAVY,  border: `1px solid ${BORDER}` },
  };
  const st = styles[variant];
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-1"
      style={{ ...st, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
      <span className="text-xs font-medium"
        style={{ color: variant === 'default' ? SUB : variant === 'gold' ? `${NAVY}aa` : '#ffffffaa' }}>
        {label}
      </span>
      <span className="text-3xl font-bold">{value}</span>
      {sub && (
        <span className="text-xs"
          style={{ color: variant === 'default' ? SUB : variant === 'gold' ? `${NAVY}99` : '#ffffff88' }}>
          {sub}
        </span>
      )}
    </div>
  );
}

// ── Milestone card ────────────────────────────
function MilestoneCard({ age, label, sub }: { age: number; label: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-3"
      style={{ background: BG, border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <div className="rounded-full w-12 h-12 flex-shrink-0 flex items-center justify-center text-sm font-bold"
        style={{ background: GOLD, color: NAVY }}>
        {age}
      </div>
      <div>
        <div className="text-sm font-semibold" style={{ color: NAVY }}>{label}</div>
        <div className="text-xs" style={{ color: SUB }}>{sub}</div>
      </div>
    </div>
  );
}

// ── Chart card ────────────────────────────────
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5"
      style={{ background: BG, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
      <h2 className="text-sm font-bold mb-4" style={{ color: NAVY }}>{title}</h2>
      {children}
    </div>
  );
}

// ── Main ──────────────────────────────────────
export default function ResultClient() {
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const router = useRouter();

  useEffect(() => { setParams(loadParams()); }, []);

  const rows        = useMemo(() => simulate(params), [params]);
  const fireAge     = useMemo(() => getFireAge(rows), [rows]);
  const surplusAge  = useMemo(() => getSurplusAge(rows), [rows]);
  const assetLifetime = useMemo(() => getAssetLifetime(rows), [rows]);

  const milestones = useMemo(() => {
    const ms: Array<{ age: number; label: string; sub: string }> = [
      { age: params.retirementAge, label: '退職', sub: `退職金 ${man(params.retirementPayment)}` },
      { age: params.iDeCoStartReceiveAge, label: 'iDeCo 受取開始', sub: '20年均等払い' },
      { age: params.pensionStartAge, label: '年金 受取開始', sub: `月 ${man(params.pensionMonthly)}` },
    ];
    if (fireAge) ms.push({ age: fireAge, label: '自立達成', sub: '配当が生活費を超える' });
    return ms.sort((a, b) => a.age - b.age);
  }, [params, fireAge]);

  const incomeData = useMemo(() =>
    rows.map((r) => ({
      age: r.age,
      配当: Math.round(r.dividendIncome),
      iDeCo: Math.round(r.iDeCoIncome),
      退職金: Math.round(r.retirementIncome),
      公的年金: Math.round(r.pensionPublic),
      年金払退職給付: Math.round(r.pensionBenefit),
      生活費: Math.round(r.livingExpense),
    })), [rows]);

  const assetData = useMemo(() =>
    rows.map((r) => ({
      age: r.age,
      株式: Math.round(r.stocks),
      金: Math.round(r.gold),
      現金: Math.round(r.cash),
      暗号資産: Math.round(r.crypto),
      iDeCo: Math.round(r.iDeCoFund),
    })), [rows]);

  const axisProps  = { fill: SUB, fontSize: 11 };
  const gridProps  = { strokeDasharray: '3 3', stroke: BORDER };
  const legendStyle = { fontSize: 11, color: SUB };

  const refLine = (x: number, lbl: string, color: string) => (
    <ReferenceLine x={x} stroke={color} strokeDasharray="4 4"
      label={{ value: lbl, fill: color, fontSize: 10, position: 'top' as const }} />
  );

  const assetBad = assetLifetime !== null && assetLifetime < 90;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F1F5F9', color: NAVY }}>

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        style={{ background: BG, borderBottom: `1px solid ${BORDER}` }}>
        <div>
          <h1 className="text-xl font-bold tracking-wider" style={{ color: NAVY }}>kurasu</h1>
          <p className="text-xs mt-0.5" style={{ color: SUB }}>シミュレーション結果</p>
        </div>
        <button
          onClick={() => router.push('/kurasu')}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl transition-colors hover:bg-gray-50"
          style={{ color: NAVY, border: `1px solid ${BORDER}` }}
        >
          ← 設定に戻る
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6">

          {/* Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Badge label="配当自立年齢"
              value={fireAge ? `${fireAge}歳` : '—'}
              sub="配当自立の達成年齢" variant="gold" />
            <Badge label="収支黒字化年齢"
              value={surplusAge ? `${surplusAge}歳` : '—'}
              sub="総収入 ≥ 生活費" variant="navy" />
            <Badge label="資産寿命"
              value={assetLifetime ? `${assetLifetime}歳まで` : '100歳超'}
              sub={assetBad ? '⚠ 要確認' : '✓ 安心水準'}
              variant={assetBad ? 'default' : 'navy'} />
          </div>

          {/* Milestones */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: SUB }}>
              マイルストーン
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {milestones.map((m) => (
                <MilestoneCard key={m.label} age={m.age} label={m.label} sub={m.sub} />
              ))}
            </div>
          </div>

          {/* Income chart */}
          <ChartCard title="収入 vs 支出">
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={incomeData} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="age" tick={axisProps} tickFormatter={(v) => `${v}歳`} />
                <YAxis tickFormatter={manAxis} tick={axisProps} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={legendStyle} />
                {fireAge && refLine(fireAge, '自立', GOLD)}
                {refLine(params.retirementAge, '退職', CHART.retirement)}
                {refLine(params.pensionStartAge, '年金', CHART.pension)}
                <Bar dataKey="配当"        stackId="i" fill={CHART.dividend} />
                <Bar dataKey="iDeCo"       stackId="i" fill={CHART.ideco} />
                <Bar dataKey="退職金"      stackId="i" fill={CHART.retirement} />
                <Bar dataKey="公的年金"    stackId="i" fill={CHART.pension} />
                <Bar dataKey="年金払退職給付" stackId="i" fill={CHART.pensionBenefit} />
                <Line dataKey="生活費" stroke={CHART.expense} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Asset chart */}
          <ChartCard title="総資産推移">
            <ResponsiveContainer width="100%" height={340}>
              <AreaChart data={assetData} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="age" tick={axisProps} tickFormatter={(v) => `${v}歳`} />
                <YAxis tickFormatter={manAxis} tick={axisProps} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={legendStyle} />
                {fireAge && refLine(fireAge, '自立', GOLD)}
                <Area type="monotone" dataKey="株式"   stackId="1" stroke={CHART.stocks}    fill={CHART.stocks}    fillOpacity={0.4} />
                <Area type="monotone" dataKey="金"     stackId="1" stroke={CHART.gold}      fill={CHART.gold}      fillOpacity={0.4} />
                <Area type="monotone" dataKey="現金"   stackId="1" stroke={CHART.cash}      fill={CHART.cash}      fillOpacity={0.4} />
                <Area type="monotone" dataKey="暗号資産" stackId="1" stroke={CHART.crypto}  fill={CHART.crypto}    fillOpacity={0.4} />
                <Area type="monotone" dataKey="iDeCo" stackId="1" stroke={CHART.iDeCoFund} fill={CHART.iDeCoFund} fillOpacity={0.4} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Table */}
          <div className="rounded-2xl p-5 overflow-x-auto"
            style={{ background: BG, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
            <h2 className="text-sm font-bold mb-4" style={{ color: NAVY }}>年齢別推移テーブル</h2>
            <table className="w-full text-xs border-collapse min-w-[640px]">
              <thead>
                <tr style={{ borderBottom: `2px solid ${BORDER}` }}>
                  {['年齢', '総資産', '配当（税後）', '年金等', '生活費', '収支'].map((h, i) => (
                    <th key={h}
                      className={`py-2 font-semibold ${i === 0 ? 'text-left pr-4' : 'text-right pr-4'}`}
                      style={{ color: SUB }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.age}
                    style={{
                      borderBottom: `1px solid ${BORDER}`,
                      background: r.isFIREYear ? `${GOLD}15` : undefined,
                    }}>
                    <td className="py-1.5 pr-4 font-mono font-medium" style={{ color: NAVY }}>
                      {r.age}歳
                      {r.isFIREYear && (
                        <span className="ml-1 text-xs font-bold" style={{ color: GOLD }}>★</span>
                      )}
                    </td>
                    <td className="text-right pr-4 font-mono font-medium" style={{ color: NAVY }}>
                      {man(r.totalAssets)}
                    </td>
                    <td className="text-right pr-4 font-mono font-semibold" style={{ color: GOLD }}>
                      {man(r.dividendIncome)}
                    </td>
                    <td className="text-right pr-4 font-mono" style={{ color: CHART.pension }}>
                      {man(r.pensionPublic + r.pensionBenefit + r.iDeCoIncome)}
                    </td>
                    <td className="text-right pr-4 font-mono" style={{ color: SUB }}>
                      {man(r.livingExpense)}
                    </td>
                    <td className="text-right font-mono font-bold"
                      style={{ color: r.balance >= 0 ? GREEN : RED }}>
                      {r.balance >= 0 ? '+' : ''}{man(r.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom back button */}
          <div className="flex justify-center pb-4">
            <button
              onClick={() => router.push('/kurasu')}
              className="flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl transition-colors hover:bg-gray-100"
              style={{ color: NAVY, border: `1px solid ${BORDER}`, background: BG }}
            >
              ← 設定に戻る
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}
