'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { SlidersHorizontal } from 'lucide-react';
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
// Table cell formatter — unit-free (万円 shown in header only)
const tblAsset = (v: number) => {
  if (v === 0) return '—';
  const m = Math.round(v / 10_000);
  return m === 0 ? '—' : m.toLocaleString();
};

// ── localStorage ──────────────────────────────
const LS_KEY        = 'kurasu-params-v1';
const LS_ACTUAL_KEY = 'kurasu-actual-v1';

function loadParams(): Params {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULT_PARAMS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_PARAMS;
}

// ── Actual data ────────────────────────────────
interface ActualEntry { totalAsset?: number; dividend?: number; expense?: number; } // 万円
type ActualData = Record<string, ActualEntry>; // keyed by year string

function loadActual(): ActualData {
  try { const r = localStorage.getItem(LS_ACTUAL_KEY); if (r) return JSON.parse(r); } catch {}
  return {};
}
function saveActual(d: ActualData) {
  try { localStorage.setItem(LS_ACTUAL_KEY, JSON.stringify(d)); } catch {}
}

// ── Actual input modal ─────────────────────────
function ActualModal({ year, entry, planRow, onSave, onDelete, onClose }: {
  year: number;
  entry?: ActualEntry;
  planRow?: YearRow;
  onSave: (e: ActualEntry) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [asset, setAsset] = useState(entry?.totalAsset?.toString() ?? '');
  const [div,   setDiv]   = useState(entry?.dividend?.toString()   ?? '');
  const [exp,   setExp]   = useState(entry?.expense?.toString()    ?? '');

  const planM = (v?: number) =>
    v != null && v > 0 ? `${Math.round(v / 10_000).toLocaleString()}万` : '—';

  const fields = [
    { label: '総資産（万円）', value: asset, set: setAsset, plan: planM(planRow?.totalAssets)    },
    { label: '配当金（万円）', value: div,   set: setDiv,   plan: planM(planRow?.dividendIncome) },
    { label: '生活費（万円）', value: exp,   set: setExp,   plan: planM(planRow?.livingExpense)  },
  ];

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: BG, borderRadius: 16, padding: '24px 20px', width: '88%', maxWidth: 320, boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: NAVY, marginBottom: 16 }}>{year}年 実績入力</div>
        {fields.map(({ label, value, set, plan }) => (
          <div key={label} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <label style={{ fontSize: '0.7rem', color: SUB }}>{label}</label>
              <span style={{ fontSize: '0.65rem', color: SUB }}>計画：{plan}</span>
            </div>
            <input
              type="number" inputMode="numeric" value={value}
              onChange={e => set(e.target.value)} placeholder="未入力"
              style={{ width: '100%', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', fontSize: '0.9rem', color: NAVY, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            onClick={() => onSave({
              totalAsset: asset ? Number(asset) : undefined,
              dividend:   div   ? Number(div)   : undefined,
              expense:    exp   ? Number(exp)    : undefined,
            })}
            style={{ flex: 1, background: GOLD, color: NAVY, border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
          >保存</button>
          {entry && (
            <button onClick={onDelete}
              style={{ background: '#fee2e2', color: RED, border: 'none', borderRadius: 8, padding: '10px 12px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
            >削除</button>
          )}
          <button onClick={onClose}
            style={{ background: CARD, color: SUB, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 12px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
          >キャンセル</button>
        </div>
      </div>
    </div>
  );
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
  if (r.cashDrawdown > 0)            items.push({ label: '現金取り崩し',   value: -r.cashDrawdown });
  if (r.stockDrawdown > 0)           items.push({ label: '株式取り崩し',   value: -r.stockDrawdown });
  if (r.goldDrawdown > 0)            items.push({ label: '金取り崩し',     value: -r.goldDrawdown });

  // 前年比 = sum of breakdown items (guarantees display matches breakdown total)
  const itemsDiff = items.reduce((s, { value }) => s + value, 0);

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
          {yoyDiff !== null && items.length > 0 && (
            <div style={{ fontSize: '0.65rem', marginBottom: 8, color: itemsDiff >= 0 ? GREEN : RED }}>
              前年比 {itemsDiff >= 0 ? '+' : ''}{man(itemsDiff)}
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
  const [actuals, setActuals] = useState<ActualData>({});
  const [modalYear, setModalYear] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => { setParams(loadParams()); }, []);
  useEffect(() => { setActuals(loadActual()); }, []);

  const handleSaveActual = (year: number, entry: ActualEntry) => {
    const next = { ...actuals, [String(year)]: entry };
    setActuals(next);
    saveActual(next);
    setModalYear(null);
  };
  const handleDeleteActual = (year: number) => {
    const next = { ...actuals };
    delete next[String(year)];
    setActuals(next);
    saveActual(next);
    setModalYear(null);
  };

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
              <h2 className="text-sm font-bold" style={{ color: NAVY }}>
                年間別推移
                <span className="font-normal text-xs ml-1" style={{ color: SUB }}>（万円・12月31日時点・行をタップして実績を入力）</span>
              </h2>
            </div>
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '520px', WebkitOverflowScrolling: 'touch', scrollbarGutter: 'stable' }}>
              <table className="border-collapse" style={{ minWidth: '360px', width: '100%', fontSize: '13px', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '10%' }} />  {/* 西暦   */}
                  <col style={{ width: '6%'  }} />  {/* 齢     */}
                  <col style={{ width: '18%' }} />  {/* 総資産 */}
                  <col style={{ width: '12%' }} />  {/* 配当   */}
                  <col style={{ width: '11%' }} />  {/* 年金   */}
                  <col style={{ width: '14%' }} />  {/* 支出   */}
                  <col style={{ width: '16%' }} />  {/* 収支   */}
                </colgroup>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, zIndex: 1, background: CARD, boxShadow: `0 1px 0 ${BORDER}` }}>
                    {([
                      { label: '西暦',    align: 'left',  pl: '10px', pr: '2px',  bold: false, divider: false },
                      { label: '齢',      align: 'right', pl: '2px',  pr: '4px',  bold: false, divider: true  },
                      { label: '総資産',  align: 'right', pl: '4px',  pr: '4px',  bold: true,  divider: false },
                      { label: '配当',    align: 'right', pl: '4px',  pr: '4px',  bold: true,  divider: false },
                      { label: '年金',    align: 'right', pl: '4px',  pr: '4px',  bold: true,  divider: false },
                      { label: '支出',    align: 'right', pl: '4px',  pr: '4px',  bold: true,  divider: false },
                      { label: '収支',    align: 'right', pl: '4px',  pr: '14px', bold: true,  divider: false },
                    ] as const).map(({ label, align, pl, pr, bold, divider }) => (
                      <th key={label}
                        className={`py-1 whitespace-nowrap ${bold ? 'font-semibold' : 'font-normal'}`}
                        style={{ color: SUB, textAlign: align, paddingLeft: pl, paddingRight: pr,
                          borderRight: divider ? `1px solid ${BORDER}` : undefined, fontSize: '0.7rem' }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const isStartRow   = i === 0; // previous year-end row (raw input values)
                    const preRetirement = r.age < params.retirementAge;
                    const pensionIncome = r.pensionPublic + r.pensionBenefit;
                    const yoyDiff = i > 0 ? r.totalAssets - rows[i - 1].totalAssets : null;
                    const act = actuals[String(r.year)];
                    const hasActual = !!act;
                    const highlight = hasActual || isStartRow; // gold styling

                    // Use actual values when available, fall back to plan (all in 万円)
                    const dispDivM   = act?.dividend  != null ? act.dividend  : Math.round(r.dividendIncome / 10_000);
                    const dispExpM   = act?.expense   != null ? act.expense   : Math.round(r.livingExpense  / 10_000);
                    const dispPenM   = Math.round(pensionIncome / 10_000);
                    // balance: use actual values if any actual entered, else plan (no rounding accumulation)
                    const balSrc = hasActual ? dispDivM + dispPenM - dispExpM
                      : Math.round(r.balance / 10_000);
                    // start row has all zeros — show '—'; pre-retirement plan rows also show '—' for income
                    const showPre = (preRetirement || isStartRow) && !hasActual;

                    return (
                      <tr key={r.age}
                        onClick={() => setModalYear(r.year)}
                        style={{ borderBottom: `1px solid ${BORDER}`, background: highlight ? `${GOLD}18` : undefined, cursor: 'pointer' }}>
                        {/* 1. 西暦 — gold left-border when highlighted */}
                        <td className="py-1 font-normal tabular-nums"
                          style={{
                            color: SUB,
                            paddingLeft: highlight ? '7px' : '10px',
                            paddingRight: '2px',
                            borderLeft: highlight ? `3px solid ${GOLD}` : '3px solid transparent',
                          }}>
                          {r.year}
                        </td>
                        {/* 2. 齢 */}
                        <td className="py-1 text-right font-normal tabular-nums"
                          style={{ color: NAVY, paddingLeft: '2px', paddingRight: '4px', borderRight: `1px solid ${BORDER}` }}>
                          {r.age}
                        </td>
                        {/* 3. 総資産 */}
                        <td className="py-1 text-right tabular-nums" style={{ paddingLeft: '4px', paddingRight: '4px' }}
                          onClick={e => e.stopPropagation()}>
                          {hasActual && act?.totalAsset != null ? (
                            <span style={{ color: GOLD, fontWeight: 600 }}>{act.totalAsset.toLocaleString()}</span>
                          ) : (
                            <TotalAssetsCell r={r} yoyDiff={yoyDiff} />
                          )}
                        </td>
                        {/* 4. 配当 */}
                        <td className="py-1 text-right tabular-nums" style={{ paddingLeft: '4px', paddingRight: '4px',
                          color: hasActual && act?.dividend != null ? GOLD : showPre ? SUB : NAVY,
                          fontWeight: hasActual && act?.dividend != null ? 600 : undefined }}>
                          {showPre ? '—' : dispDivM === 0 ? '—' : dispDivM.toLocaleString()}
                        </td>
                        {/* 5. 年金 */}
                        <td className="py-1 text-right tabular-nums" style={{ color: SUB, paddingLeft: '4px', paddingRight: '4px' }}>
                          {dispPenM === 0 ? '—' : dispPenM.toLocaleString()}
                        </td>
                        {/* 6. 支出 */}
                        <td className="py-1 text-right tabular-nums" style={{ paddingLeft: '4px', paddingRight: '4px',
                          color: hasActual && act?.expense != null ? GOLD : SUB,
                          fontWeight: hasActual && act?.expense != null ? 600 : undefined }}>
                          {dispExpM === 0 ? '—' : dispExpM.toLocaleString()}
                        </td>
                        {/* 7. 収支 */}
                        <td className="py-1 tabular-nums font-semibold"
                          style={{ paddingLeft: '4px', paddingRight: '14px', textAlign: 'right',
                            color: showPre ? SUB : balSrc >= 0 ? GREEN : RED }}>
                          {showPre ? '—' : balSrc === 0 ? '—' : (balSrc > 0 ? '+' : '') + balSrc.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom back button — 下半円デザイン */}
          <div className="flex justify-center pt-2 pb-0">
            <button
              onClick={() => router.push('/kurasu')}
              className="flex flex-col items-center justify-center gap-1 font-semibold transition-transform active:scale-95 hover:opacity-80"
              style={{
                color: NAVY,
                background: BG,
                border: `1px solid ${BORDER}`,
                width: 120,
                height: 60,
                borderRadius: '0 0 9999px 9999px',
                boxShadow: `0 4px 10px rgba(0,0,0,.07)`,
                fontSize: '0.65rem',
              }}
            >
              <SlidersHorizontal size={13} />
              設定に戻る
            </button>
          </div>

        </div>
      </main>

      {/* Actual data modal */}
      {modalYear !== null && (
        <ActualModal
          year={modalYear}
          entry={actuals[String(modalYear)]}
          planRow={rows.find(r => r.year === modalYear)}
          onSave={(e) => handleSaveActual(modalYear, e)}
          onDelete={() => handleDeleteActual(modalYear)}
          onClose={() => setModalYear(null)}
        />
      )}
    </div>
  );
}
