export interface Params {
  currentAge: number;
  currentYear: number;
  // Stocks
  stockAmount: number;
  stockGrowthRate: number;
  stockDividendRate: number;
  nisaCurrentAmount: number; // 現在のNISA保有額（円）・毎年240万増・上限1200万
  // Gold
  goldAmount: number;
  goldGrowthRate: number;
  // Cash
  cashAmount: number;
  // Living expenses
  annualLivingExpense: number;
  inflationRate: number;
  livingExpenseDecline: boolean;
  livingExpenseDeclineAge: number;
  livingExpenseDeclineRate: number;
  // iDeCo
  iDeCoMonthly: number;
  iDeCoMonthly2027: number;
  iDeCoReturn: number;
  iDeCoEndAge: number;
  iDeCoStartReceiveAge: number;
  iDeCoYearsOfMembership: number;
  // Retirement
  retirementAge: number;
  retirementPayment: number;
  yearsOfService: number;
  // Pension
  pensionMonthly: number;
  pensionStartAge: number;
  pensionRetirementBenefitMonthly: number;
  // Toggles
  reinvestRetirement: boolean;
}

export interface YearRow {
  age: number;
  year: number;
  stocks: number;
  gold: number;
  cash: number;
  iDeCoFund: number;
  totalAssets: number;
  dividendIncome: number;
  iDeCoIncome: number;
  retirementIncome: number;
  pensionPublic: number;
  pensionBenefit: number;
  totalIncome: number;
  livingExpense: number;
  balance: number;
  isFIREYear: boolean;
  fireBadge: boolean;
  // Asset change breakdown (for tooltip)
  assetAppreciation: number;
  dividendReinvest: number;
  retirementReinvest: number;
  iDeCoReinvest: number;
  surplusReinvest: number;
  cashDrawdown: number;
  stockDrawdown: number;
}

export const DEFAULT_PARAMS: Params = {
  currentAge: 51,
  currentYear: 2026,
  stockAmount: 15_000_000,
  stockGrowthRate: 0.06,
  stockDividendRate: 0.038,
  nisaCurrentAmount: 4_800_000, // 480万（2年分）
  goldAmount: 3_000_000,
  goldGrowthRate: 0.04,
  cashAmount: 8_000_000,
  annualLivingExpense: 3_000_000,
  inflationRate: 0.015,
  livingExpenseDecline: true,
  livingExpenseDeclineAge: 70,
  livingExpenseDeclineRate: 0.15,
  iDeCoMonthly: 20_000,
  iDeCoMonthly2027: 30_000,
  iDeCoReturn: 0.04,
  iDeCoEndAge: 60,
  iDeCoStartReceiveAge: 65,
  iDeCoYearsOfMembership: 14,
  retirementAge: 60,
  retirementPayment: 21_000_000,
  yearsOfService: 35,
  pensionMonthly: 150_000,
  pensionStartAge: 65,
  pensionRetirementBenefitMonthly: 15_000,
  reinvestRetirement: true,
};

function progressiveIncomeTax(income: number): number {
  if (income <= 0) return 0;
  const brackets = [
    { limit: 1_950_000, rate: 0.05, ded: 0 },
    { limit: 3_300_000, rate: 0.10, ded: 97_500 },
    { limit: 6_950_000, rate: 0.20, ded: 427_500 },
    { limit: 9_000_000, rate: 0.23, ded: 636_000 },
    { limit: 18_000_000, rate: 0.33, ded: 1_536_000 },
    { limit: 40_000_000, rate: 0.40, ded: 2_796_000 },
    { limit: Infinity, rate: 0.45, ded: 4_796_000 },
  ];
  for (const b of brackets) {
    if (income <= b.limit) return Math.max(0, income * b.rate - b.ded);
  }
  return Math.max(0, income * 0.45 - 4_796_000);
}

function iDeCoLumpSumAfterTax(fund: number, yearsOfMembership: number): number {
  const deduction =
    yearsOfMembership <= 20
      ? 400_000 * yearsOfMembership
      : 8_000_000 + 700_000 * (yearsOfMembership - 20);
  const taxableIncome = Math.max(0, (fund - deduction)) * 0.5;
  const incomeTax = progressiveIncomeTax(taxableIncome);
  const residenceTax = taxableIncome * 0.10;
  return fund - incomeTax - residenceTax;
}

function retirementAfterTax(payment: number, yearsOfService: number): number {
  const deduction =
    yearsOfService <= 20
      ? 400_000 * yearsOfService
      : 8_000_000 + 700_000 * (yearsOfService - 20);
  const retirementIncome = Math.max(0, (payment - deduction)) * 0.5;
  const incomeTax = progressiveIncomeTax(retirementIncome);
  const residenceTax = retirementIncome * 0.10;
  return payment - incomeTax - residenceTax;
}

export function simulate(params: Params): YearRow[] {
  const rows: YearRow[] = [];

  let stocks = params.stockAmount;
  let gold = params.goldAmount;
  let cash = params.cashAmount;
  let iDeCoFund = 0;
  let dividendFIREReached = false;

  const retirementNet = retirementAfterTax(params.retirementPayment, params.yearsOfService);

  for (let age = params.currentAge - 1; age <= 99; age++) {
    const year = params.currentYear + (age - params.currentAge);

    // First row (previous year-end): push raw input values as starting point, no calculations
    if (age === params.currentAge - 1) {
      const initTotal = params.stockAmount + params.goldAmount + params.cashAmount;
      rows.push({ age, year, stocks: params.stockAmount, gold: params.goldAmount, cash: params.cashAmount, iDeCoFund: 0, totalAssets: initTotal, dividendIncome: 0, iDeCoIncome: 0, retirementIncome: 0, pensionPublic: 0, pensionBenefit: 0, totalIncome: 0, livingExpense: 0, balance: 0, isFIREYear: false, fireBadge: false, assetAppreciation: 0, dividendReinvest: 0, retirementReinvest: 0, iDeCoReinvest: 0, surplusReinvest: 0, cashDrawdown: 0, stockDrawdown: 0 });
      continue;
    }

    // Asset growth
    const stocksBefore = stocks;
    const goldBefore = gold;
    stocks *= 1 + params.stockGrowthRate;
    gold *= 1 + params.goldGrowthRate;
    const assetAppreciation = (stocks - stocksBefore) + (gold - goldBefore);

    // iDeCo accumulation
    const isAccumulating = age <= params.iDeCoEndAge;
    const annualContrib = isAccumulating
      ? (year >= 2027 ? params.iDeCoMonthly2027 : params.iDeCoMonthly) * 12
      : 0;
    iDeCoFund = iDeCoFund * (1 + params.iDeCoReturn) + annualContrib;

    // Living expense
    const yearsFromNow = age - params.currentAge;
    let livingExpense =
      params.annualLivingExpense * Math.pow(1 + params.inflationRate, yearsFromNow);

    // Dividend (after tax, NISA-adjusted)
    // NISA cumulative: 現在値 + 経過年数×240万、上限1200万
    const nisaCumulative = Math.min(
      params.nisaCurrentAmount + yearsFromNow * 2_400_000,
      12_000_000,
    );
    const nisaRatio = stocks > 0 ? Math.min(1, nisaCumulative / stocks) : 0;
    const dividendGross = stocks * params.stockDividendRate;
    const dividendAfterTax =
      dividendGross * (nisaRatio + (1 - nisaRatio) * (1 - 0.20315));

    if (params.livingExpenseDecline && age >= params.livingExpenseDeclineAge) {
      livingExpense *= 1 - params.livingExpenseDeclineRate;
    }

    // FIRE check
    const isFIREYear = !dividendFIREReached && dividendAfterTax >= livingExpense;
    if (isFIREYear) dividendFIREReached = true;

    // One-time retirement income
    let retirementIncome = 0;
    let retirementReinvest = 0;
    if (age === params.retirementAge) {
      retirementIncome = retirementNet;
      if (params.reinvestRetirement) {
        stocks += retirementIncome;
        retirementReinvest = retirementIncome;
      } else cash += retirementIncome;
    }

    // iDeCo lump-sum payout
    let iDeCoIncome = 0;
    let iDeCoReinvest = 0;
    if (age === params.iDeCoStartReceiveAge) {
      const net = iDeCoLumpSumAfterTax(iDeCoFund, params.iDeCoYearsOfMembership);
      iDeCoIncome = net;
      if (params.reinvestRetirement) {
        stocks += net;
        iDeCoReinvest = net;
      } else cash += net;
      iDeCoFund = 0;
    }

    // Public pension (after 公的年金等控除 & 15% tax on excess)
    let pensionPublic = 0;
    let pensionBenefit = 0;
    if (age >= params.pensionStartAge) {
      const pensionRatio = age === params.pensionStartAge ? 3 / 12 : 1;
      const pGross = params.pensionMonthly * 12 * pensionRatio;
      const bGross = params.pensionRetirementBenefitMonthly * 12 * pensionRatio;
      const totalGross = pGross + bGross;
      const taxableExcess = Math.max(0, totalGross - 2_200_000);
      const totalTax = taxableExcess * 0.15;
      const taxRatio = totalGross > 0 ? totalTax / totalGross : 0;
      pensionPublic = pGross * (1 - taxRatio);
      pensionBenefit = bGross * (1 - taxRatio);
    }

    // Spendable income for balance
    const spendableRetirement = params.reinvestRetirement ? 0 : retirementIncome;
    const spendableIdeco = params.reinvestRetirement ? 0 : iDeCoIncome;
    const spendableIncome =
      dividendAfterTax + spendableRetirement + spendableIdeco + pensionPublic + pensionBenefit;
    const balance = spendableIncome - livingExpense;

    // Asset draw / reinvest
    let dividendReinvest = 0;
    let surplusReinvest = 0;
    let cashDrawdown = 0;
    let stockDrawdown = 0;

    const isRetired = age >= params.retirementAge;
    if (!isRetired) {
      // Pre-retirement: salary covers living expenses, reinvest dividends fully
      stocks += dividendAfterTax;
      dividendReinvest = dividendAfterTax;
    } else {
      // Post-retirement: dividends are income; reinvest surplus or draw down assets
      if (balance > 0) {
        stocks += balance;
        surplusReinvest = balance;
      } else {
        const deficit = -balance;
        if (cash >= deficit) {
          cash -= deficit;
          cashDrawdown = deficit;
        } else {
          const remaining = deficit - cash;
          cashDrawdown = cash;
          cash = 0;
          stocks = Math.max(0, stocks - remaining);
          stockDrawdown = remaining;
        }
      }
    }

    const totalAssets =
      Math.max(0, stocks) + gold + Math.max(0, cash);
    const totalIncome =
      dividendAfterTax + iDeCoIncome + retirementIncome + pensionPublic + pensionBenefit;

    rows.push({
      age,
      year,
      stocks: Math.max(0, stocks),
      gold,
      cash: Math.max(0, cash),
      iDeCoFund: age < params.iDeCoStartReceiveAge ? iDeCoFund : 0,
      totalAssets,
      dividendIncome: dividendAfterTax,
      iDeCoIncome,
      retirementIncome,
      pensionPublic,
      pensionBenefit,
      totalIncome,
      livingExpense,
      balance,
      isFIREYear,
      fireBadge: dividendFIREReached,
      assetAppreciation,
      dividendReinvest,
      retirementReinvest,
      iDeCoReinvest,
      surplusReinvest,
      cashDrawdown,
      stockDrawdown,
    });
  }

  return rows;
}

export function getFireAge(rows: YearRow[]): number | null {
  return rows.find((r) => r.isFIREYear)?.age ?? null;
}

export function getSurplusAge(rows: YearRow[]): number | null {
  return rows.find((r) => r.balance >= 0)?.age ?? null;
}

export function getAssetLifetime(rows: YearRow[]): number | null {
  const last = [...rows].reverse().find((r) => r.totalAssets > 0);
  return last?.age ?? null;
}
