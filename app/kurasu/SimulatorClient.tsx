'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine,
} from 'recharts';
import {
  simulate,
  DEFAULT_PARAMS,
  getFireAge,
  getSurplusAge,
  getAssetLifetime,
} from './simulation';
import type { Params } from './simulation';

// ──────────────────────────────────────────────
// Design tokens
// ──────────────────────────────────────────────
const GOLD = '#C9A84C';
const GOLD_LIGHT = '#e5c275';
const CYAN = '#06b6d4';
const CYAN_LIGHT = '#38bdf8';
const BG = '#0F2340';
const CARD = '#1a2e4a';
const CARD_DARK = '#12263d';
const BORDER = '#1e3a57';
const SUB = '#94a3b8';
const RED = '#ef4444';

// Chart palette
const CHART = {
  dividend: GOLD,
  ideco: CYAN,
  retirement: GOLD_LIGHT,
  pension: CYAN_LIGHT,
  pensionBenefit: '#7dd3fc',
  expense: RED,
  stocks: GOLD,
  gold: GOLD_LIGHT,
  cash: '#64748b',
  iDeCoFund: CYAN,
};

// ──────────────────────────────────────────────
// Formatters
// ──────────────────────────────────────────────
const man = (v: number) =>
  v >= 1_000_000
    ? `${(v / 10_000).toFixed(0)}万`
    : `${Math.round(v).toLocaleString()}円`;

const manAxis = (v: number) => `${(v / 10_000).toFixed(0)}万`;

// ──────────────────────────────────────────────
// LocalStorage
// ──────────────────────────────────────────────
const LS_KEY = 'kurasu-params-v1';

function loadParams(): Params {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULT_PARAMS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_PARAMS;
}

function saveParams(p: Params) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p));
  } catch {}
}

// ──────────────────────────────────────────────
// UI helpers
// ──────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs leading-none" style={{ color: SUB }}>
      {children}
    </span>
  );
}

function NumInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = '',
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full text-sm rounded px-2 py-1.5 outline-none transition-colors"
          style={{
            background: CARD_DARK,
            color: '#fff',
            border: `1px solid ${BORDER}`,
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = GOLD)}
          onBlur={(e) => (e.currentTarget.style.borderColor = BORDER)}
        />
        {unit && (
          <span className="text-xs whitespace-nowrap" style={{ color: SUB }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label>{label}</Label>
      <button
        onClick={() => onChange(!value)}
        className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
        style={{ background: value ? GOLD : '#2a4a6a' }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform"
          style={{ transform: value ? 'translateX(20px)' : 'translateX(0)' }}
        />
      </button>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
        style={{ background: CARD_DARK, color: GOLD }}
      >
        <span>{title}</span>
        <span style={{ color: SUB }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div
          className="p-3 grid grid-cols-2 gap-3"
          style={{ background: CARD }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function Badge({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-1"
      style={{
        background: CARD,
        border: `1px solid ${highlight ? GOLD : BORDER}`,
        boxShadow: highlight ? `0 0 16px ${GOLD}33` : undefined,
      }}
    >
      <span className="text-xs font-medium" style={{ color: SUB }}>
        {label}
      </span>
      <span
        className="text-2xl font-bold"
        style={{ color: highlight ? GOLD : '#fff' }}
      >
        {value}
      </span>
      {sub && <span className="text-xs" style={{ color: SUB }}>{sub}</span>}
    </div>
  );
}

function MilestoneCard({
  age,
  label,
  sub,
}: {
  age: number;
  label: string;
  sub: string;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2"
      style={{ background: CARD, border: `1px solid ${BORDER}` }}
    >
      <div
        className="rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center text-sm font-bold"
        style={{ background: CARD_DARK, color: GOLD, border: `1px solid ${GOLD}55` }}
      >
        {age}
      </div>
      <div>
        <div className="text-sm font-semibold text-white">{label}</div>
        <div className="text-xs" style={{ color: SUB }}>
          {sub}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Custom tooltip
// ──────────────────────────────────────────────
interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg p-3 text-xs shadow-2xl"
      style={{
        background: CARD_DARK,
        border: `1px solid ${GOLD}55`,
      }}
    >
      <p className="font-bold mb-2" style={{ color: GOLD }}>
        {label}歳
      </p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono text-white">{man(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────
export default function SimulatorClient() {
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);

  useEffect(() => {
    setParams(loadParams());
  }, []);

  useEffect(() => {
    saveParams(params);
  }, [params]);

  const set = useCallback(
    <K extends keyof Params>(key: K, value: Params[K]) =>
      setParams((p) => ({ ...p, [key]: value })),
    []
  );

  const rows = useMemo(() => simulate(params), [params]);
  const fireAge = useMemo(() => getFireAge(rows), [rows]);
  const surplusAge = useMemo(() => getSurplusAge(rows), [rows]);
  const assetLifetime = useMemo(() => getAssetLifetime(rows), [rows]);

  const milestones = useMemo(() => {
    const ms: Array<{ age: number; label: string; sub: string }> = [];
    ms.push({
      age: params.retirementAge,
      label: '退職',
      sub: `退職金 ${man(params.retirementPayment)}`,
    });
    if (fireAge)
      ms.push({ age: fireAge, label: 'FIRE 達成', sub: '配当が生活費を超える' });
    ms.push({
      age: params.iDeCoStartReceiveAge,
      label: 'iDeCo 受取開始',
      sub: '20年均等払い',
    });
    ms.push({
      age: params.pensionStartAge,
      label: '年金 受取開始',
      sub: `月 ${man(params.pensionMonthly)}`,
    });
    return ms.sort((a, b) => a.age - b.age);
  }, [params, fireAge]);

  const incomeChartData = useMemo(
    () =>
      rows.map((r) => ({
        age: r.age,
        配当: Math.round(r.dividendIncome),
        iDeCo: Math.round(r.iDeCoIncome),
        退職金: Math.round(r.retirementIncome),
        公的年金: Math.round(r.pensionPublic),
        年金払退職給付: Math.round(r.pensionBenefit),
        生活費: Math.round(r.livingExpense),
      })),
    [rows]
  );

  const assetChartData = useMemo(
    () =>
      rows.map((r) => ({
        age: r.age,
        株式: Math.round(r.stocks),
        金: Math.round(r.gold),
        現金: Math.round(r.cash),
        iDeCo: Math.round(r.iDeCoFund),
      })),
    [rows]
  );

  const chartAxisProps = { fill: SUB, fontSize: 11 };
  const gridProps = { strokeDasharray: '3 3', stroke: '#1e3a57' };
  const legendStyle = { fontSize: 11, color: SUB };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG, color: '#fff' }}>
      {/* ── Header ── */}
      <header
        className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        style={{
          background: CARD_DARK,
          borderBottom: `1px solid ${GOLD}44`,
        }}
      >
        <div>
          <h1
            className="text-2xl font-bold tracking-widest"
            style={{ color: GOLD, fontFamily: 'Georgia, serif' }}
          >
            kurasu
          </h1>
          <p className="text-xs mt-0.5" style={{ color: SUB }}>
            配当で暮らすライフプランシミュレーター
          </p>
        </div>
        <div
          className="hidden sm:flex items-center gap-1 text-xs px-3 py-1 rounded-full"
          style={{ background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}55` }}
        >
          <span>◆</span>
          <span>Dividend FIRE</span>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* ── Left sidebar ── */}
        <aside
          className="w-full lg:w-80 xl:w-96 flex-shrink-0 p-4 overflow-y-auto lg:max-h-screen lg:sticky lg:top-0"
          style={{ background: CARD_DARK, borderRight: `1px solid ${BORDER}` }}
        >
          <div className="flex flex-col gap-3">
            <Section title="基本情報">
              <NumInput label="現在年齢" value={params.currentAge} onChange={(v) => set('currentAge', v)} min={20} max={90} step={1} unit="歳" />
              <NumInput label="現在年（西暦）" value={params.currentYear} onChange={(v) => set('currentYear', v)} min={2020} max={2050} step={1} unit="年" />
            </Section>

            <Section title="資産">
              <NumInput label="株式 保有額" value={params.stockAmount} onChange={(v) => set('stockAmount', v)} step={100_000} unit="円" />
              <NumInput label="株式 成長率" value={params.stockGrowthRate * 100} onChange={(v) => set('stockGrowthRate', v / 100)} min={0} max={30} step={0.1} unit="%" />
              <NumInput label="配当率" value={params.stockDividendRate * 100} onChange={(v) => set('stockDividendRate', v / 100)} min={0} max={20} step={0.1} unit="%" />
              <NumInput label="NISA保有額" value={params.nisaCurrentAmount} onChange={(v) => set('nisaCurrentAmount', v)} step={240_000} min={0} max={12_000_000} unit="円" />
              <NumInput label="金 保有額" value={params.goldAmount} onChange={(v) => set('goldAmount', v)} step={100_000} unit="円" />
              <NumInput label="金 成長率" value={params.goldGrowthRate * 100} onChange={(v) => set('goldGrowthRate', v / 100)} min={0} max={20} step={0.1} unit="%" />
              <NumInput label="現金・預金" value={params.cashAmount} onChange={(v) => set('cashAmount', v)} step={100_000} unit="円" />
            </Section>

            <Section title="生活費">
              <NumInput label="年間生活費" value={params.annualLivingExpense} onChange={(v) => set('annualLivingExpense', v)} step={100_000} unit="円" />
              <NumInput label="インフレ率" value={params.inflationRate * 100} onChange={(v) => set('inflationRate', v / 100)} min={0} max={10} step={0.1} unit="%" />
              <div className="col-span-2">
                <Toggle label="生活費逓減（統計カーブ）" value={params.livingExpenseDecline} onChange={(v) => set('livingExpenseDecline', v)} />
              </div>
              {params.livingExpenseDecline && (
                <>
                  <NumInput label="逓減開始年齢" value={params.livingExpenseDeclineAge} onChange={(v) => set('livingExpenseDeclineAge', v)} min={60} max={90} step={1} unit="歳" />
                  <NumInput label="削減率" value={params.livingExpenseDeclineRate * 100} onChange={(v) => set('livingExpenseDeclineRate', v / 100)} min={0} max={50} step={1} unit="%" />
                </>
              )}
            </Section>

            <Section title="iDeCo">
              <NumInput label="月額掛金" value={params.iDeCoMonthly} onChange={(v) => set('iDeCoMonthly', v)} step={1_000} unit="円" />
              <NumInput label="2027年以降 月額" value={params.iDeCoMonthly2027} onChange={(v) => set('iDeCoMonthly2027', v)} step={1_000} unit="円" />
              <NumInput label="利回り" value={params.iDeCoReturn * 100} onChange={(v) => set('iDeCoReturn', v / 100)} min={0} max={20} step={0.1} unit="%" />
              <NumInput label="拠出終了年齢" value={params.iDeCoEndAge} onChange={(v) => set('iDeCoEndAge', v)} min={50} max={75} step={1} unit="歳" />
              <NumInput label="受取開始年齢" value={params.iDeCoStartReceiveAge} onChange={(v) => set('iDeCoStartReceiveAge', v)} min={60} max={75} step={1} unit="歳" />
            </Section>

            <Section title="退職">
              <NumInput label="退職年齢" value={params.retirementAge} onChange={(v) => set('retirementAge', Math.max(60, v))} min={60} max={75} step={1} unit="歳" />
              <NumInput label="退職金" value={params.retirementPayment} onChange={(v) => set('retirementPayment', v)} step={100_000} unit="円" />
              <NumInput label="勤続年数" value={params.yearsOfService} onChange={(v) => set('yearsOfService', v)} min={1} max={50} step={1} unit="年" />
            </Section>

            <Section title="年金">
              <NumInput label="厚生+基礎年金（月額）" value={params.pensionMonthly} onChange={(v) => set('pensionMonthly', v)} step={5_000} unit="円" />
              <NumInput label="受取開始年齢" value={params.pensionStartAge} onChange={(v) => set('pensionStartAge', v)} min={60} max={75} step={1} unit="歳" />
              <NumInput label="年金払退職給付（月額）" value={params.pensionRetirementBenefitMonthly} onChange={(v) => set('pensionRetirementBenefitMonthly', v)} step={1_000} unit="円" />
            </Section>

            <Section title="再投資オプション">
              <div className="col-span-2">
                <Toggle label="退職金・iDeCoを株式に再投資" value={params.reinvestRetirement} onChange={(v) => set('reinvestRetirement', v)} />
              </div>
            </Section>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 p-4 lg:p-6 flex flex-col gap-6 overflow-y-auto">

          {/* Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Badge
              label="配当で暮らせる年齢"
              value={fireAge ? `${fireAge}歳` : '—'}
              sub="FIRE達成年齢"
              highlight
            />
            <Badge
              label="収支黒字化年齢"
              value={surplusAge ? `${surplusAge}歳` : '—'}
              sub="総収入 ≥ 生活費"
            />
            <Badge
              label="資産寿命"
              value={assetLifetime ? `${assetLifetime}歳まで` : '100歳超'}
              sub={assetLifetime && assetLifetime < 90 ? '要注意' : '安心水準'}
            />
          </div>

          {/* Milestones */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: GOLD }}>
              マイルストーン
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
              {milestones.map((m) => (
                <MilestoneCard key={m.label} age={m.age} label={m.label} sub={m.sub} />
              ))}
            </div>
          </div>

          {/* Income vs Expense Chart */}
          <div
            className="rounded-xl p-4"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: GOLD }}>
              収入 vs 支出
            </h2>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={incomeChartData} margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="age" tick={chartAxisProps} tickFormatter={(v) => `${v}歳`} />
                <YAxis tickFormatter={manAxis} tick={chartAxisProps} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={legendStyle} />
                {fireAge && (
                  <ReferenceLine
                    x={fireAge}
                    stroke={GOLD}
                    strokeDasharray="4 4"
                    label={{ value: 'FIRE', fill: GOLD, fontSize: 10, position: 'top' }}
                  />
                )}
                <ReferenceLine
                  x={params.retirementAge}
                  stroke={GOLD_LIGHT}
                  strokeDasharray="4 4"
                  label={{ value: '退職', fill: GOLD_LIGHT, fontSize: 10, position: 'top' }}
                />
                <Bar dataKey="配当" stackId="income" fill={CHART.dividend} />
                <Bar dataKey="iDeCo" stackId="income" fill={CHART.ideco} />
                <Bar dataKey="退職金" stackId="income" fill={CHART.retirement} />
                <Bar dataKey="公的年金" stackId="income" fill={CHART.pension} />
                <Bar dataKey="年金払退職給付" stackId="income" fill={CHART.pensionBenefit} />
                <Line dataKey="生活費" stroke={CHART.expense} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Total Assets Chart */}
          <div
            className="rounded-xl p-4"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: GOLD }}>
              総資産推移
            </h2>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={assetChartData} margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="age" tick={chartAxisProps} tickFormatter={(v) => `${v}歳`} />
                <YAxis tickFormatter={manAxis} tick={chartAxisProps} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={legendStyle} />
                {fireAge && (
                  <ReferenceLine x={fireAge} stroke={GOLD} strokeDasharray="4 4" label={{ value: 'FIRE', fill: GOLD, fontSize: 10, position: 'top' }} />
                )}
                <Area type="monotone" dataKey="株式" stackId="1" stroke={CHART.stocks} fill={CHART.stocks} fillOpacity={0.55} />
                <Area type="monotone" dataKey="金" stackId="1" stroke={CHART.gold} fill={CHART.gold} fillOpacity={0.55} />
                <Area type="monotone" dataKey="現金" stackId="1" stroke={CHART.cash} fill={CHART.cash} fillOpacity={0.55} />
                <Area type="monotone" dataKey="iDeCo" stackId="1" stroke={CHART.iDeCoFund} fill={CHART.iDeCoFund} fillOpacity={0.55} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div
            className="rounded-xl p-4 overflow-x-auto"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}
          >
            <h2 className="text-sm font-semibold mb-3" style={{ color: GOLD }}>
              年齢別推移テーブル
            </h2>
            <table className="w-full text-xs border-collapse min-w-[640px]" style={{ color: SUB }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {['年齢', '総資産', '配当(税後)', '年金等', '生活費', '収支'].map(
                    (h, i) => (
                      <th
                        key={h}
                        className={`py-1.5 ${i === 0 ? 'text-left pr-3' : 'text-right pr-3'}`}
                        style={{ color: GOLD, fontWeight: 600 }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.age}
                    className="transition-colors"
                    style={{
                      borderBottom: `1px solid ${BORDER}`,
                      background: r.isFIREYear ? `${GOLD}18` : undefined,
                    }}
                  >
                    <td className="py-1 pr-3 font-mono text-white">
                      {r.age}歳
                      {r.isFIREYear && (
                        <span className="ml-1 text-xs font-bold" style={{ color: GOLD }}>
                          ★FIRE
                        </span>
                      )}
                    </td>
                    <td className="text-right pr-3 font-mono text-white">{man(r.totalAssets)}</td>
                    <td className="text-right pr-3 font-mono" style={{ color: GOLD }}>
                      {man(r.dividendIncome)}
                    </td>
                    <td className="text-right pr-3 font-mono" style={{ color: CYAN }}>
                      {man(r.pensionPublic + r.pensionBenefit + r.iDeCoIncome)}
                    </td>
                    <td className="text-right pr-3 font-mono text-white">{man(r.livingExpense)}</td>
                    <td
                      className="text-right font-mono"
                      style={{ color: r.balance >= 0 ? GOLD : RED }}
                    >
                      {r.balance >= 0 ? '+' : ''}
                      {man(r.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
