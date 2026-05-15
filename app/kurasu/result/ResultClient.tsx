'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ReferenceLine,
} from 'recharts';
import {
  simulate, DEFAULT_PARAMS, getFireAge,
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
const tblAsset = (v: number) => {
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

// ── Total-assets breakdown cell ───────────────
const TOOLTIP_W = 220;

function TotalAssetsCell({ r, yoyDiff }: { r: YearRow; yoyDiff: number | null }) {
  const [show, setShow] = useState(false);
  const [tipPos, setTipPos] = useState({ top: 0, left: 0, above: true });
  const triggerRef = useRef<HTMLDivElement>(null);

  const items: Array<{ label: string; value: number }> = [];
  if (r.assetAppreciation > 0)       items.push({ label: '株式・金評価増', value:  r.assetAppreciation });
  if (r.dividendReinvest > 0)        items.push({ label: '配当再投資',     value:  r.dividendReinvest });
  if (r.retirementReinvest > 0)      items.push({ label: '退職金再投資',   value:  r.retirementReinvest });
  else if (r.retirementIncome > 0)   items.push({ label: '退職金受取',     value:  r.retirementIncome });
  if (r.iDeCoReinvest > 0)           items.push({ label: 'iDeCo再投資',    value:  r.iDeCoReinvest });
  else if (r.iDeCoIncome > 0)        items.push({ label: 'iDeCo受取',      value:  r.iDeCoIncome });
  if (r.surplusReinvest > 0)         items.push({ label: '余剰再投資',     value:  r.surplusReinvest });
  if (r.cashDrawdown > 0)            items.push({ label: '生活費補填',     value: -r.cashDrawdown });
  if (r.stockDrawdown > 0)           items.push({ label: '取り崩し',       value: -r.stockDrawdown });

  const openTooltip = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Decide above/below based on available space (estimate tooltip height ~180px)
    const above = rect.top > 200 || rect.top > vh - rect.bottom;
    const top = above ? rect.top - 6 : rect.bottom + 6;
    // Horizontal: right-align to trigger, clamp to viewport edges
    let left = rect.right - TOOLTIP_W;
    if (left < 8) left = 8;
    if (left + TOOLTIP_W > vw - 8) left = vw - TOOLTIP_W - 8;
    setTipPos({ top, left, above });
    setShow(true);
  };

  return (
    <div
      ref={triggerRef}
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={openTooltip}
      onMouseLeave={() => setShow(false)}
      onTouchStart={(e) => { e.stopPropagation(); show ? setShow(false) : openTooltip(); }}
    >
      <div style={{ cursor: 'default', borderBottom: `1px dashed ${BORDER}`, paddingBottom: 1, color: NAVY }}>
        {tblAsset(r.totalAssets)}
      </div>
      {show && (
        <div style={{
          position: 'fixed',
          top: tipPos.top,
          left: tipPos.left,
          transform: tipPos.above ? 'translateY(-100%)' : 'none',
          width: TOOLTIP_W,
          background: BG,
          border: `1px solid ${BORDER}`,
          borderRadius: 10,
          padding: '10px 14px',
          boxShadow: '0 4px 20px rgba(0,0,0,.15)',
          zIndex: 9999,
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
                  gap: 12,
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
          className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl transition-colors hover:bg-gray-50"
          style={{ color: NAVY, border: `1px solid ${BORDER}` }}
        >
          <ArrowLeft size={15} /> 設定に戻る
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6">

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
              <h2 className="text-sm font-bold" style={{ color: NAVY }}>年間別推移<span className="font-normal text-xs ml-1" style={{ color: SUB }}>（万円・1月1日時点、初年度は現在値）</span></h2>
            </div>
            {/* scroll container — both axes, sticky header works inside a single overflow:auto */}
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '520px', WebkitOverflowScrolling: 'touch', scrollbarGutter: 'stable' }}>
              <table className="border-collapse" style={{ minWidth: '320px', width: '100%', fontSize: '14px', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '11%' }} />  {/* 西暦      */}
                  <col style={{ width:  '6%' }} />  {/* 齢        */}
                  <col style={{ width: '23%' }} />  {/* 総資産    */}
                  <col style={{ width: '15%' }} />  {/* 配当      */}
                  <col style={{ width: '12%' }} />  {/* 年金      */}
                  <col style={{ width: '12%' }} />  {/* 支出      */}
                  <col style={{ width: '21%' }} />  {/* 収支      */}
                </colgroup>
                <thead>
                  <tr style={{
                    position: 'sticky', top: 0, zIndex: 1,
                    background: CARD,
                    boxShadow: `0 1px 0 ${BORDER}`,
                  }}>
                    {([
                      { label: '西暦',   align: 'left',  pl: '4px', pr: '4px', bold: false, divider: false },
                      { label: '齢',     align: 'right', pl: '2px', pr: '4px', bold: false, divider: true  },
                      { label: '総資産', align: 'right', pl: '4px', pr: '4px', bold: true,  divider: false },
                      { label: '配当',   align: 'right', pl: '4px', pr: '4px', bold: true,  divider: false },
                      { label: '年金',   align: 'right', pl: '4px', pr: '4px', bold: true,  divider: false },
                      { label: '支出',   align: 'right', pl: '4px', pr: '4px', bold: true,  divider: false },
                      { label: '収支',   align: 'right', pl: '4px', pr: '14px', bold: true, divider: false },
                    ] as const).map(({ label, align, pl, pr, bold, divider }) => (
                      <th key={label}
                        className={`py-1 whitespace-nowrap ${bold ? 'font-semibold' : 'font-normal'}`}
                        style={{ color: SUB, textAlign: align, paddingLeft: pl, paddingRight: pr,
                          borderRight: divider ? `1px solid ${BORDER}` : undefined }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const preRetirement = r.age < params.retirementAge;
                    // 年金列: 公的年金+年金払い退職給付のみ（退職金・iDeCoは含めない）
                    const pensionIncome = r.pensionPublic + r.pensionBenefit;
                    const yoyDiff = i > 0 ? r.totalAssets - rows[i - 1].totalAssets : null;
                    // 収支 = 配当 + 年金 - 支出（表示値ベース）
                    const mDiv     = Math.round(r.dividendIncome / 10_000);
                    const mPension = Math.round(pensionIncome    / 10_000);
                    const mExp     = Math.round(r.livingExpense  / 10_000);
                    const mBal     = mDiv + mPension - mExp;
                    return (
                      <tr key={r.age} style={{ borderBottom: `1px solid ${BORDER}` }}>
                        {/* 1. 西暦 */}
                        <td className="py-1 font-normal tabular-nums" style={{ color: SUB, paddingLeft: '4px', paddingRight: '4px' }}>
                          {r.year}
                        </td>
                        {/* 2. 齢 */}
                        <td className="py-1 text-right font-normal tabular-nums"
                          style={{ color: NAVY, paddingLeft: '2px', paddingRight: '4px', borderRight: `1px solid ${BORDER}` }}>
                          {r.age}
                        </td>
                        {/* 3. 総資産 + ホバー内訳 */}
                        <td className="py-1 text-right tabular-nums" style={{ paddingLeft: '4px', paddingRight: '4px' }}>
                          <TotalAssetsCell r={r} yoyDiff={yoyDiff} />
                        </td>
                        {/* 4. 配当 */}
                        <td className="py-1 text-right tabular-nums"
                          style={{ color: preRetirement ? SUB : NAVY, paddingLeft: '4px', paddingRight: '4px' }}>
                          {preRetirement ? '—' : tbl(r.dividendIncome)}
                        </td>
                        {/* 5. 年金（公的年金+年金払い退職給付のみ） */}
                        <td className="py-1 text-right tabular-nums" style={{ color: SUB, paddingLeft: '4px', paddingRight: '4px' }}>
                          {tbl(pensionIncome)}
                        </td>
                        {/* 6. 支出 */}
                        <td className="py-1 text-right tabular-nums" style={{ color: SUB, paddingLeft: '4px', paddingRight: '4px' }}>
                          {tbl(r.livingExpense)}
                        </td>
                        {/* 7. 収支（配当+年金−支出） */}
                        <td className="py-1 text-right tabular-nums font-semibold"
                          style={{ color: preRetirement ? SUB : mBal >= 0 ? GREEN : RED, paddingLeft: '4px', paddingRight: '14px' }}>
                          {preRetirement ? '—' : mBal === 0 ? '—' : (mBal > 0 ? '+' : '') + mBal.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom back button */}
          <div className="flex justify-center pb-4">
            <button
              onClick={() => router.push('/kurasu')}
              className="flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl transition-colors hover:bg-gray-100"
              style={{ color: NAVY, border: `1px solid ${BORDER}`, background: BG }}
            >
              設定に戻る
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}
