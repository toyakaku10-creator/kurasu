'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  User, TrendingUp, Landmark, Home, Building2, LogOut, Coins, RefreshCw, ArrowRight, ChevronUp, ChevronDown,
} from 'lucide-react';
import { DEFAULT_PARAMS } from './simulation';
import type { Params } from './simulation';

// ── Design tokens ─────────────────────────────
const GOLD   = '#C9A84C';
const NAVY   = '#0F2340';
const BG     = '#FFFFFF';
const CARD   = '#F8F9FA';
const BORDER = '#E9ECEF';
const SUB    = '#6B7280';

const SLIDER_CSS = `
  .sg { -webkit-appearance:none; appearance:none; height:6px; border-radius:3px;
        outline:none; cursor:pointer; width:100%; touch-action:pan-y; }
  .sg::-webkit-slider-thumb { -webkit-appearance:none; width:26px; height:26px;
    border-radius:50%; background:${GOLD}; cursor:pointer;
    border:3px solid #fff; box-shadow:0 1px 6px rgba(0,0,0,.2);
    transition:box-shadow .15s; }
  .sg:hover::-webkit-slider-thumb { box-shadow:0 2px 10px ${GOLD}88; }
  .sg::-moz-range-thumb { width:26px; height:26px; border-radius:50%;
    background:${GOLD}; cursor:pointer; border:3px solid #fff;
    box-shadow:0 1px 6px rgba(0,0,0,.2); }
`;

// ── Formatters ────────────────────────────────
const yen  = (v: number) => {
  if (v >= 10_000) return `${Math.round(v / 10_000).toLocaleString()}万円`;
  return `${v.toLocaleString()}円`;
};
const yenM = (v: number) => `${v.toLocaleString()}円/月`;
const pct  = (v: number) => `${(v * 100).toFixed(1)}%`;
const age  = (v: number) => `${v}歳`;
const yr   = (v: number) => `${v}年`;

// ── localStorage ──────────────────────────────
const LS_KEY = 'kurasu-params-v1';

function loadParams(): Params {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const merged: Params = { ...DEFAULT_PARAMS, ...JSON.parse(raw) };
      // Clamp retirementAge to valid range [currentAge, 60]
      merged.retirementAge = Math.min(60, Math.max(merged.currentAge, merged.retirementAge));
      return merged;
    }
  } catch {}
  return DEFAULT_PARAMS;
}
function saveParams(p: Params) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch {}
}

// ── Slider ────────────────────────────────────
function Slider({
  label, value, onChange, min, max, step, display,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; display: (v: number) => string;
}) {
  const fill = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-baseline gap-2">
        <span className="text-xs font-medium" style={{ color: SUB }}>{label}</span>
        <span className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color: GOLD }}>{display(value)}</span>
      </div>
      <input
        type="range" className="sg"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ background: `linear-gradient(to right,${GOLD} 0%,${GOLD} ${fill}%,${BORDER} ${fill}%,${BORDER} 100%)` }}
      />
    </div>
  );
}

// ── Toggle ────────────────────────────────────
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-xs font-medium" style={{ color: SUB }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
        style={{ background: value ? GOLD : '#D1D5DB' }}
      >
        <span
          className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform"
          style={{ transform: value ? 'translateX(20px)' : 'translateX(0)' }}
        />
      </button>
    </div>
  );
}

// ── Section ───────────────────────────────────
function Sec({ title, icon, children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${BORDER}`, background: BG, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-bold transition-colors hover:bg-gray-50"
        style={{ background: CARD, color: NAVY, borderBottom: open ? `1px solid ${BORDER}` : 'none' }}
      >
        <span className="flex items-center gap-2">
          <span style={{ color: GOLD }}>{icon}</span>
          <span>{title}</span>
        </span>
        {open ? <ChevronUp size={14} color={GOLD} /> : <ChevronDown size={14} color={GOLD} />}
      </button>
      {open && (
        <div className="px-5 py-5 grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6" style={{ background: BG }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Full({ children }: { children: React.ReactNode }) {
  return <div className="col-span-1 sm:col-span-2">{children}</div>;
}

// ── Main ──────────────────────────────────────
export default function InputClient() {
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const router = useRouter();

  useEffect(() => { setParams(loadParams()); }, []);

  const set = useCallback(
    <K extends keyof Params>(key: K, value: Params[K]) =>
      setParams((p) => ({ ...p, [key]: value })),
    []
  );

  useEffect(() => {
    const clamped = Math.min(60, Math.max(params.currentAge, params.retirementAge));
    if (clamped !== params.retirementAge) set('retirementAge', clamped);
  }, [params.currentAge, params.retirementAge, set]);

  const handleStart = useCallback(() => {
    saveParams(params);
    router.push('/kurasu/result');
  }, [params, router]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG, color: NAVY }}>
      <style>{SLIDER_CSS}</style>

      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        style={{ background: BG, borderBottom: `1px solid ${BORDER}` }}
      >
        <div>
          <h1 className="text-xl font-bold tracking-wider" style={{ color: NAVY }}>
            kurasu
          </h1>
          <p className="text-xs mt-0.5" style={{ color: SUB }}>
            パラメータを設定してシミュレーションを開始
          </p>
        </div>
        <div
          className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
          style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}55` }}
        >
          Step 1 / 2
        </div>
      </header>

      {/* Form */}
      <main className="flex-1 overflow-y-auto pb-28">
        <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4">

          <Sec title="基本情報" icon={<User size={15} />}>
            <Slider label="現在年齢" value={params.currentAge}
              onChange={(v) => set('currentAge', v)} min={20} max={80} step={1} display={age} />
            <Slider label="現在年（西暦）" value={params.currentYear}
              onChange={(v) => set('currentYear', v)} min={2020} max={2050} step={1}
              display={(v) => `${v}年`} />
          </Sec>

          <Sec title="株式" icon={<TrendingUp size={15} />}>
            <Full>
              <Slider label="保有額" value={params.stockAmount}
                onChange={(v) => set('stockAmount', v)} min={0} max={50_000_000} step={500_000} display={yen} />
            </Full>
            <Slider label="年間成長率" value={params.stockGrowthRate}
              onChange={(v) => set('stockGrowthRate', v)} min={0} max={0.20} step={0.001} display={pct} />
            <Slider label="配当率" value={params.stockDividendRate}
              onChange={(v) => set('stockDividendRate', v)} min={0} max={0.10} step={0.001} display={pct} />
            <Full>
              <Slider label="NISA比率" value={params.stockNisaRatio}
                onChange={(v) => set('stockNisaRatio', v)} min={0} max={1} step={0.01}
                display={(v) => `${Math.round(v * 100)}%`} />
            </Full>
          </Sec>

          <Sec title="その他資産" icon={<Coins size={15} />} defaultOpen={false}>
            <Slider label="金 保有額" value={params.goldAmount}
              onChange={(v) => set('goldAmount', v)} min={0} max={20_000_000} step={100_000} display={yen} />
            <Slider label="金 成長率" value={params.goldGrowthRate}
              onChange={(v) => set('goldGrowthRate', v)} min={0} max={0.15} step={0.001} display={pct} />
            <Slider label="現金・預金" value={params.cashAmount}
              onChange={(v) => set('cashAmount', v)} min={0} max={20_000_000} step={100_000} display={yen} />
          </Sec>

          <Sec title="生活費" icon={<Home size={15} />}>
            <Full>
              <Slider label="年間生活費" value={params.annualLivingExpense}
                onChange={(v) => set('annualLivingExpense', v)} min={1_200_000} max={10_000_000} step={100_000} display={yen} />
            </Full>
            <Slider label="インフレ率" value={params.inflationRate}
              onChange={(v) => set('inflationRate', v)} min={0} max={0.10} step={0.001} display={pct} />
            <Full>
              <Toggle label="生活費逓減（統計カーブ・70歳以降減少）"
                value={params.livingExpenseDecline}
                onChange={(v) => set('livingExpenseDecline', v)} />
            </Full>
            {params.livingExpenseDecline && (
              <>
                <Slider label="逓減開始年齢" value={params.livingExpenseDeclineAge}
                  onChange={(v) => set('livingExpenseDeclineAge', v)} min={60} max={85} step={1} display={age} />
                <Slider label="削減率" value={params.livingExpenseDeclineRate}
                  onChange={(v) => set('livingExpenseDeclineRate', v)} min={0} max={0.50} step={0.01} display={pct} />
              </>
            )}
          </Sec>

          <Sec title="iDeCo" icon={<Building2 size={15} />} defaultOpen={false}>
            <Slider label="月額掛金（〜2026年）" value={params.iDeCoMonthly}
              onChange={(v) => set('iDeCoMonthly', v)} min={0} max={68_000} step={1_000} display={yenM} />
            <Slider label="月額掛金（2027年以降）" value={params.iDeCoMonthly2027}
              onChange={(v) => set('iDeCoMonthly2027', v)} min={0} max={75_000} step={1_000} display={yenM} />
            <Slider label="利回り" value={params.iDeCoReturn}
              onChange={(v) => set('iDeCoReturn', v)} min={0} max={0.10} step={0.001} display={pct} />
            <Slider label="拠出終了年齢" value={params.iDeCoEndAge}
              onChange={(v) => set('iDeCoEndAge', v)} min={50} max={75} step={1} display={age} />
            <Slider label="一時金受取年齢" value={params.iDeCoStartReceiveAge}
              onChange={(v) => set('iDeCoStartReceiveAge', v)} min={60} max={75} step={1} display={age} />
            <Slider label="加入年数（退職所得控除の計算に使用）" value={params.iDeCoYearsOfMembership}
              onChange={(v) => set('iDeCoYearsOfMembership', v)} min={1} max={40} step={1} display={yr} />
          </Sec>

          <Sec title="退職" icon={<LogOut size={15} />}>
            {params.currentAge >= 60 ? (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-xs font-medium" style={{ color: SUB }}>退職年齢</span>
                  <span className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color: GOLD }}>60歳（固定）</span>
                </div>
              </div>
            ) : (
              <Slider label="退職年齢" value={params.retirementAge}
                onChange={(v) => set('retirementAge', v)} min={params.currentAge} max={60} step={1} display={age} />
            )}
            <Slider label="勤続年数" value={params.yearsOfService}
              onChange={(v) => set('yearsOfService', v)} min={1} max={45} step={1} display={yr} />
            <Full>
              <Slider label="退職金" value={params.retirementPayment}
                onChange={(v) => set('retirementPayment', v)} min={0} max={50_000_000} step={500_000} display={yen} />
            </Full>
          </Sec>

          <Sec title="年金" icon={<Landmark size={15} />} defaultOpen={false}>
            <Slider label="厚生+基礎年金（月額）" value={params.pensionMonthly}
              onChange={(v) => set('pensionMonthly', v)} min={0} max={300_000} step={5_000} display={yenM} />
            <Slider label="受取開始年齢" value={params.pensionStartAge}
              onChange={(v) => set('pensionStartAge', v)} min={60} max={75} step={1} display={age} />
            <Full>
              <Slider label="年金払退職給付（月額）" value={params.pensionRetirementBenefitMonthly}
                onChange={(v) => set('pensionRetirementBenefitMonthly', v)} min={0} max={50_000} step={1_000} display={yenM} />
            </Full>
          </Sec>

          <Sec title="再投資オプション" icon={<RefreshCw size={15} />} defaultOpen={false}>
            <Full>
              <Toggle label="退職金・iDeCoを株式に再投資（配当自立を加速）"
                value={params.reinvestRetirement}
                onChange={(v) => set('reinvestRetirement', v)} />
            </Full>
          </Sec>

        </div>
      </main>

      {/* Fixed start button */}
      <footer
        className="fixed bottom-0 inset-x-0 px-4 py-4 flex justify-center"
        style={{ background: 'rgba(255,255,255,0.95)', borderTop: `1px solid ${BORDER}`, backdropFilter: 'blur(8px)' }}
      >
        <button
          onClick={handleStart}
          className="w-full max-w-2xl py-4 rounded-2xl font-bold text-base tracking-wide transition-transform active:scale-95 hover:opacity-90 flex items-center justify-center gap-2"
          style={{ background: GOLD, color: NAVY, boxShadow: `0 4px 20px ${GOLD}55` }}
        >
          シミュレーション開始 <ArrowRight size={18} />
        </button>
      </footer>
    </div>
  );
}
