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
import type { Params, YearRow } from '../simulation';

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
  iDeCoFund:     NAVY,
};

// ── Formatters ────────────────────────────────
const man = (v: number) => {
  if (v === 0) return '—';
  if (Math.abs(v) >= 10_000) return `${Math.round(v / 10_000).toLocaleString()}万`;
  return `${Math.round(v).toLocaleString()}円`;
};
const manAxis = (v: number) => `${Math.round(v / 10_000).toLocaleString()}万`;
// Table cell formatters — unit-free (万円 shown in header only)
const tbl = (v: number) => {
  if (v === 0) return '—';
  const m = Math.round(v / 10_000);
  return m === 0 ? '—' : m.toLocaleString();
};
const tblSigned = (v: number) => {
  const m = Math.round(v / 10_000);
  if (m === 0) return '—';
  return (v > 0 ? '+' : '') + m.toLocaleString();
};

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

// ── Total-assets breakdown cell ───────────────
function TotalAssetsCell({ r, yoyDiff }: { r: YearRow; yoyDiff: number | null }) {
  const [show, setShow] = useState(false);

  const items: Array<{ label: string; value: number }> = [];
  if (r.assetAppreciation > 0)  items.push({ label: '株式・金評価増',  value:  r.assetAppreciation });
  if (r.dividendReinvest > 0)   items.push({ label: '配当再投資',       value:  r.dividendReinvest });
  if (r.retirementReinvest > 0) items.push({ label: '退職金再投資',     value:  r.retirementReinvest });
  if (r.iDeCoReinvest > 0)      items.push({ label: 'iDeCo再投資',      value:  r.iDeCoReinvest });
  if (r.surplusReinvest > 0)    items.push({ label: '余剰再投資',        value:  r.surplusReinvest });
  if (r.cashDrawdown > 0)       items.push({ label: '生活費補填',        value: -r.cashDrawdown });
  if (r.stockDrawdown > 0)      items.push({ label: '取り崩し',          value: -r.stockDrawdown });

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <div style={{ cursor: 'default', borderBottom: `1px dashed ${BORDER}`, paddingBottom: 1, color: NAVY }}>
        {tbl(r.totalAssets)}
      </div>
      {show && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 6px)',
          right: 0,
          background: BG,
          border: `1px solid ${BORDER}`,
          borderRadius: 10,
          padding: '10px 14px',
          boxShadow: '0 4px 16px rgba(0,0,0,.10)',
          zIndex: 50,
          minWidth: 230,
          whiteSpace: 'nowrap',
          textAlign: 'left',
        }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: NAVY, marginBottom: 3 }}>
            総資産 {man(r.totalAssets)}
          </div>
          {yoyDiff !== null && (
            <div style={{ fontSize: '0.65rem', marginBottom: 8, color: yoyDiff >= 0 ? GREEN : RED }}>
              前年比 {yoyDiff >= 0 ? '+' : ''}{man(yoyDiff)}
            </div>
          )}
          {items.length > 0 && (
            <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 6 }}>
              <div style={{ fontSize: '0.6rem', color: SUB, marginBottom: 4 }}>内訳</div>
              {items.map(({ label, value }) => (
                <div key={label} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 20,
                  fontSize: '0.65rem',
                  marginBottom: 3,
                }}>
                  <span style={{ color: SUB }}>{label}</span>
                  <span style={{ fontFamily: 'monospace', color: value >= 0 ? GREEN : RED }}>
                    {value >= 0 ? '+' : ''}{man(value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Other-income breakdown cell ───────────────
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
      { age: params.iDeCoStartReceiveAge, label: 'iDeCo 一時金受取', sub: `加入${params.iDeCoYearsOfMembership}年・退職所得控除適用` },
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
                <Area type="monotone" dataKey="現金"  stackId="1" stroke={CHART.cash}      fill={CHART.cash}      fillOpacity={0.4} />
                <Area type="monotone" dataKey="iDeCo" stackId="1" stroke={CHART.iDeCoFund} fill={CHART.iDeCoFund} fillOpacity={0.4} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Table */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: BG, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
            <div className="px-5 pt-5 pb-3">
              <h2 className="text-sm font-bold" style={{ color: NAVY }}>年間別推移<span className="font-normal text-xs ml-1" style={{ color: SUB }}>（万円）</span></h2>
            </div>
            {/* scroll container — both axes, sticky header works inside a single overflow:auto */}
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '520px', WebkitOverflowScrolling: 'touch' }}>
              <table className="border-collapse" style={{ minWidth: '320px', width: '100%', fontSize: '10px', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '36px' }} />  {/* 年 */}
                  <col style={{ width: '24px' }} />  {/* 齢 */}
                  <col />  {/* 総資産 */}
                  <col />  {/* 配当 */}
                  <col />  {/* 年金 */}
                  <col />  {/* 支出 */}
                  <col />  {/* ± */}
                </colgroup>
                <thead>
                  <tr style={{
                    position: 'sticky', top: 0, zIndex: 1,
                    background: CARD,
                    boxShadow: `0 1px 0 ${BORDER}`,
                  }}>
                    {[
                      { label: '年',   align: 'left'  },
                      { label: '齢',   align: 'right' },
                      { label: '総資産', align: 'right' },
                      { label: '配当', align: 'right' },
                      { label: '年金', align: 'right' },
                      { label: '支出', align: 'right' },
                      { label: '±',   align: 'right' },
                    ].map(({ label, align }) => (
                      <th key={label}
                        className="py-1 px-2 font-semibold whitespace-nowrap"
                        style={{ color: SUB, textAlign: align as React.CSSProperties['textAlign'] }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const preRetirement = r.age < params.retirementAge;
                    const otherIncome = (params.reinvestRetirement ? 0 : r.retirementIncome + r.iDeCoIncome) + r.pensionPublic + r.pensionBenefit;
                    const yoyDiff = i > 0 ? r.totalAssets - rows[i - 1].totalAssets : null;
                    return (
                      <tr key={r.age} style={{ borderBottom: `1px solid ${BORDER}` }}>
                        {/* 1. 年 */}
                        <td className="py-1 px-2 font-mono" style={{ color: SUB }}>
                          {r.year}
                        </td>
                        {/* 2. 齢 */}
                        <td className="py-1 px-2 text-right font-mono" style={{ color: NAVY }}>
                          {r.age}
                        </td>
                        {/* 3. 総資産 + ホバー内訳 */}
                        <td className="py-1 px-2 text-right">
                          <TotalAssetsCell r={r} yoyDiff={yoyDiff} />
                        </td>
                        {/* 4. 配当 */}
                        <td className="py-1 px-2 text-right font-mono"
                          style={{ color: preRetirement ? SUB : NAVY }}>
                          {preRetirement ? '—' : tbl(r.dividendIncome)}
                        </td>
                        {/* 5. 年金 */}
                        <td className="py-1 px-2 text-right font-mono" style={{ color: SUB }}>
                          {preRetirement ? '—' : tbl(otherIncome)}
                        </td>
                        {/* 6. 支出 */}
                        <td className="py-1 px-2 text-right font-mono" style={{ color: SUB }}>
                          {tbl(r.livingExpense)}
                        </td>
                        {/* 7. ± */}
                        <td className="py-1 px-2 text-right font-mono font-semibold"
                          style={{ color: preRetirement ? SUB : r.balance >= 0 ? GREEN : RED }}>
                          {preRetirement ? '—' : tblSigned(r.balance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary stats — subtle, bottom */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: '配当自立年齢',   value: fireAge       ? `${fireAge}歳`              : '—',      note: '配当収入が生活費を超える年齢' },
              { label: '収支黒字化年齢', value: surplusAge    ? `${surplusAge}歳`            : '—',      note: '総収入が生活費を上回る年齢'   },
              { label: '資産寿命',       value: assetLifetime ? `${assetLifetime}歳まで`     : '100歳超', note: assetBad ? '要確認' : '安心水準' },
            ].map(({ label, value, note }) => (
              <div key={label}
                className="flex flex-col gap-0.5 px-4 py-3 rounded-xl"
                style={{ border: `1px solid ${BORDER}`, background: BG }}>
                <span className="text-xs" style={{ color: SUB }}>{label}</span>
                <span className="text-lg font-semibold tabular-nums" style={{ color: NAVY }}>{value}</span>
                <span className="text-xs" style={{ color: '#9ca3af' }}>{note}</span>
              </div>
            ))}
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
