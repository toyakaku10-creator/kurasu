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
import type { Params, YearRow } from './simulation';

// ──────────────────────────────────────────────
// Formatters
// ──────────────────────────────────────────────
const man = (v: number) =>
  v >= 1_000_000
    ? `${(v / 10_000).toFixed(0)}万`
    : `${Math.round(v).toLocaleString()}円`;

const manAxis = (v: number) => `${(v / 10_000).toFixed(0)}万`;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

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
// Small UI helpers
// ──────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-slate-400 leading-none">{children}</span>;
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
          className="w-full bg-slate-700 text-slate-100 text-sm rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-emerald-500"
        />
        {unit && <span className="text-xs text-slate-400 whitespace-nowrap">{unit}</span>}
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
        className={`relative w-10 h-5 rounded-full transition-colors ${
          value ? 'bg-emerald-500' : 'bg-slate-600'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
            value ? 'translate-x-5' : 'translate-x-0'
          }`}
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
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-800 text-slate-200 text-sm font-semibold hover:bg-slate-750"
      >
        <span>{title}</span>
        <span className="text-slate-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="p-3 grid grid-cols-2 gap-3 bg-slate-900">{children}</div>}
    </div>
  );
}

function Badge({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className={`rounded-xl p-4 flex flex-col gap-1 ${color}`}>
      <span className="text-xs text-white/70 font-medium">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
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
    <div className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2">
      <div className="bg-slate-700 rounded-full w-10 h-10 flex items-center justify-center text-sm font-bold text-emerald-400">
        {age}
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-100">{label}</div>
        <div className="text-xs text-slate-400">{sub}</div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Custom recharts tooltip
// ──────────────────────────────────────────────
interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs shadow-xl">
      <p className="font-bold text-slate-100 mb-2">{label}歳</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="text-slate-200 font-mono">{man(p.value)}</span>
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

  // Load from localStorage on mount
  useEffect(() => {
    setParams(loadParams());
  }, []);

  // Save on change
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

  // Milestone data for cards
  const milestones = useMemo(() => {
    const ms: Array<{ age: number; label: string; sub: string }> = [];
    ms.push({
      age: params.retirementAge,
      label: '退職',
      sub: `退職金 ${man(params.retirementPayment)}`,
    });
    if (fireAge)
      ms.push({
        age: fireAge,
        label: 'FIRE達成',
        sub: '配当が生活費を超える',
      });
    ms.push({
      age: params.iDeCoStartReceiveAge,
      label: 'iDeCo受取開始',
      sub: '20年均等払い',
    });
    ms.push({
      age: params.pensionStartAge,
      label: '年金受取開始',
      sub: `月${man(params.pensionMonthly)}`,
    });
    return ms.sort((a, b) => a.age - b.age);
  }, [params, fireAge]);

  // Chart data: income vs expense
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

  // Chart data: total assets
  const assetChartData = useMemo(
    () =>
      rows.map((r) => ({
        age: r.age,
        株式: Math.round(r.stocks),
        金: Math.round(r.gold),
        現金: Math.round(r.cash),
        暗号資産: Math.round(r.crypto),
        iDeCo: Math.round(r.iDeCoFund),
        総資産: Math.round(r.totalAssets),
      })),
    [rows]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <h1 className="text-xl font-bold text-emerald-400">配当で暮らす ライフプランシミュレーター</h1>
        <p className="text-xs text-slate-400 mt-0.5">配当収入で生活費をカバーするFIREプランを試算</p>
      </header>

      <div className="flex flex-col lg:flex-row flex-1 gap-0">
        {/* ── Left sidebar: params ── */}
        <aside className="w-full lg:w-80 xl:w-96 flex-shrink-0 bg-slate-900 border-r border-slate-800 p-4 overflow-y-auto lg:max-h-screen lg:sticky lg:top-0">
          <div className="flex flex-col gap-3">

            <Section title="資産">
              <NumInput label="株式 保有額 (円)" value={params.stockAmount} onChange={(v) => set('stockAmount', v)} step={100_000} unit="円" />
              <NumInput label="株式 成長率" value={params.stockGrowthRate * 100} onChange={(v) => set('stockGrowthRate', v / 100)} min={0} max={30} step={0.1} unit="%" />
              <NumInput label="配当率" value={params.stockDividendRate * 100} onChange={(v) => set('stockDividendRate', v / 100)} min={0} max={20} step={0.1} unit="%" />
              <NumInput label="NISA比率" value={params.stockNisaRatio * 100} onChange={(v) => set('stockNisaRatio', v / 100)} min={0} max={100} step={1} unit="%" />
              <NumInput label="金 保有額 (円)" value={params.goldAmount} onChange={(v) => set('goldAmount', v)} step={100_000} unit="円" />
              <NumInput label="金 成長率" value={params.goldGrowthRate * 100} onChange={(v) => set('goldGrowthRate', v / 100)} min={0} max={20} step={0.1} unit="%" />
              <NumInput label="現金・預金 (円)" value={params.cashAmount} onChange={(v) => set('cashAmount', v)} step={100_000} unit="円" />
              <NumInput label="暗号資産 (円)" value={params.cryptoAmount} onChange={(v) => set('cryptoAmount', v)} step={10_000} unit="円" />
              <NumInput label="暗号資産 成長率" value={params.cryptoGrowthRate * 100} onChange={(v) => set('cryptoGrowthRate', v / 100)} min={0} max={100} step={1} unit="%" />
            </Section>

            <Section title="生活費">
              <NumInput label="年間生活費 (円)" value={params.annualLivingExpense} onChange={(v) => set('annualLivingExpense', v)} step={100_000} unit="円" />
              <NumInput label="インフレ率" value={params.inflationRate * 100} onChange={(v) => set('inflationRate', v / 100)} min={0} max={10} step={0.1} unit="%" />
              <div className="col-span-2">
                <Toggle label="生活費逓減 (70歳以降)" value={params.livingExpenseDecline} onChange={(v) => set('livingExpenseDecline', v)} />
              </div>
              {params.livingExpenseDecline && (
                <>
                  <NumInput label="逓減開始年齢" value={params.livingExpenseDeclineAge} onChange={(v) => set('livingExpenseDeclineAge', v)} min={60} max={90} step={1} unit="歳" />
                  <NumInput label="削減率" value={params.livingExpenseDeclineRate * 100} onChange={(v) => set('livingExpenseDeclineRate', v / 100)} min={0} max={50} step={1} unit="%" />
                </>
              )}
            </Section>

            <Section title="iDeCo">
              <NumInput label="月額掛金 (円)" value={params.iDeCoMonthly} onChange={(v) => set('iDeCoMonthly', v)} step={1_000} unit="円" />
              <NumInput label="2027年以降 月額 (円)" value={params.iDeCoMonthly2027} onChange={(v) => set('iDeCoMonthly2027', v)} step={1_000} unit="円" />
              <NumInput label="利回り" value={params.iDeCoReturn * 100} onChange={(v) => set('iDeCoReturn', v / 100)} min={0} max={20} step={0.1} unit="%" />
              <NumInput label="拠出終了年齢" value={params.iDeCoEndAge} onChange={(v) => set('iDeCoEndAge', v)} min={50} max={75} step={1} unit="歳" />
              <NumInput label="受取開始年齢" value={params.iDeCoStartReceiveAge} onChange={(v) => set('iDeCoStartReceiveAge', v)} min={60} max={75} step={1} unit="歳" />
            </Section>

            <Section title="退職">
              <NumInput label="退職年齢" value={params.retirementAge} onChange={(v) => set('retirementAge', Math.max(60, v))} min={60} max={75} step={1} unit="歳" />
              <NumInput label="退職金 (円)" value={params.retirementPayment} onChange={(v) => set('retirementPayment', v)} step={100_000} unit="円" />
              <NumInput label="勤続年数" value={params.yearsOfService} onChange={(v) => set('yearsOfService', v)} min={1} max={50} step={1} unit="年" />
            </Section>

            <Section title="年金">
              <NumInput label="厚生年金+基礎年金 (月額)" value={params.pensionMonthly} onChange={(v) => set('pensionMonthly', v)} step={5_000} unit="円" />
              <NumInput label="受取開始年齢" value={params.pensionStartAge} onChange={(v) => set('pensionStartAge', v)} min={60} max={75} step={1} unit="歳" />
              <NumInput label="年金払退職給付 (月額)" value={params.pensionRetirementBenefitMonthly} onChange={(v) => set('pensionRetirementBenefitMonthly', v)} step={1_000} unit="円" />
            </Section>

            <Section title="再投資オプション">
              <div className="col-span-2">
                <Toggle label="退職金・iDeCoを株式に再投資" value={params.reinvestRetirement} onChange={(v) => set('reinvestRetirement', v)} />
              </div>
            </Section>

            <Section title="基本情報">
              <NumInput label="現在年齢" value={params.currentAge} onChange={(v) => set('currentAge', v)} min={20} max={90} step={1} unit="歳" />
              <NumInput label="現在年（西暦）" value={params.currentYear} onChange={(v) => set('currentYear', v)} min={2020} max={2050} step={1} unit="年" />
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
              color="bg-emerald-700"
            />
            <Badge
              label="収支黒字化年齢"
              value={surplusAge ? `${surplusAge}歳` : '—'}
              color="bg-blue-700"
            />
            <Badge
              label="資産寿命"
              value={assetLifetime ? `${assetLifetime}歳まで` : '100歳超'}
              color={
                assetLifetime && assetLifetime < 90
                  ? 'bg-rose-700'
                  : 'bg-violet-700'
              }
            />
          </div>

          {/* Milestones */}
          <div>
            <h2 className="text-sm font-semibold text-slate-400 mb-2">マイルストーン</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
              {milestones.map((m) => (
                <MilestoneCard key={m.label} age={m.age} label={m.label} sub={m.sub} />
              ))}
            </div>
          </div>

          {/* Income vs Expense Chart */}
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">収入 vs 支出</h2>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={incomeChartData} margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="age" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `${v}歳`} />
                <YAxis tickFormatter={manAxis} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                {fireAge && (
                  <ReferenceLine x={fireAge} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'FIRE', fill: '#10b981', fontSize: 10, position: 'top' }} />
                )}
                {params.retirementAge && (
                  <ReferenceLine x={params.retirementAge} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '退職', fill: '#f59e0b', fontSize: 10, position: 'top' }} />
                )}
                <Bar dataKey="配当" stackId="income" fill="#10b981" />
                <Bar dataKey="iDeCo" stackId="income" fill="#3b82f6" />
                <Bar dataKey="退職金" stackId="income" fill="#f59e0b" />
                <Bar dataKey="公的年金" stackId="income" fill="#8b5cf6" />
                <Bar dataKey="年金払退職給付" stackId="income" fill="#ec4899" />
                <Line dataKey="生活費" stroke="#ef4444" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Total Assets Chart */}
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">総資産推移</h2>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={assetChartData} margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="age" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `${v}歳`} />
                <YAxis tickFormatter={manAxis} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                {fireAge && (
                  <ReferenceLine x={fireAge} stroke="#10b981" strokeDasharray="4 4" />
                )}
                <Area type="monotone" dataKey="株式" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                <Area type="monotone" dataKey="金" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} />
                <Area type="monotone" dataKey="現金" stackId="1" stroke="#6b7280" fill="#6b7280" fillOpacity={0.6} />
                <Area type="monotone" dataKey="暗号資産" stackId="1" stroke="#f97316" fill="#f97316" fillOpacity={0.6} />
                <Area type="monotone" dataKey="iDeCo" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Data table (condensed) */}
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 overflow-x-auto">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">年齢別推移テーブル</h2>
            <table className="w-full text-xs text-slate-300 border-collapse min-w-[640px]">
              <thead>
                <tr className="text-slate-500 border-b border-slate-700">
                  <th className="text-left py-1 pr-3">年齢</th>
                  <th className="text-right pr-3">総資産</th>
                  <th className="text-right pr-3">配当(税後)</th>
                  <th className="text-right pr-3">年金等</th>
                  <th className="text-right pr-3">生活費</th>
                  <th className="text-right">収支</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((_, i) => i % 1 === 0)
                  .map((r) => (
                    <tr
                      key={r.age}
                      className={`border-b border-slate-800 ${
                        r.isFIREYear ? 'bg-emerald-900/30' : ''
                      }`}
                    >
                      <td className="py-1 pr-3 font-mono">
                        {r.age}歳
                        {r.isFIREYear && (
                          <span className="ml-1 text-emerald-400 font-bold">★FIRE</span>
                        )}
                      </td>
                      <td className="text-right pr-3 font-mono">{man(r.totalAssets)}</td>
                      <td className="text-right pr-3 font-mono">{man(r.dividendIncome)}</td>
                      <td className="text-right pr-3 font-mono">
                        {man(r.pensionPublic + r.pensionBenefit + r.iDeCoIncome)}
                      </td>
                      <td className="text-right pr-3 font-mono">{man(r.livingExpense)}</td>
                      <td
                        className={`text-right font-mono ${
                          r.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
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
