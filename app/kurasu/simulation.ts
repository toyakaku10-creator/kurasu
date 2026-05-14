export interface Params {
  currentAge: number;
  currentYear: number;
  // Stocks
  stockAmount: number;
  stockGrowthRate: number;
  stockDividendRate: number;
  stockNisaRatio: number;
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
}

export const DEFAULT_PARAMS: Params = {
  currentAge: 51,
  currentYear: 2026,
  stockAmount: 15_000_000,
  stockGrowthRate: 0.06,
  stockDividendRate: 0.038,
  stockNisaRatio: 0.4,
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

  for (let age = params.currentAge; age <= 100; age++) {
    const year = params.currentYear + (age - params.currentAge);

    // Asset growth
    stocks *= 1 + params.stockGrowthRate;
    gold *= 1 + params.goldGrowthRate;

    // iDeCo accumulation
    const isAccumulating = age <= params.iDeCoEndAge;
    const annualContrib = isAccumulating
      ? (year >= 2027 ? params.iDeCoMonthly2027 : params.iDeCoMonthly) * 12
      : 0;
    iDeCoFund = iDeCoFund * (1 + params.iDeCoReturn) + annualContrib;

    // Dividend (after tax, NISA-adjusted)
    const dividendGross = stocks * params.stockDividendRate;
    const dividendAfterTax =
      dividendGross *
      (params.stockNisaRatio + (1 - params.stockNisaRatio) * (1 - 0.20315));

    // Living expense
    const yearsFromNow = age - params.currentAge;
    let livingExpense =
      params.annualLivingExpense * Math.pow(1 + params.inflationRate, yearsFromNow);
    if (params.livingExpenseDecline && age >= params.livingExpenseDeclineAge) {
      livingExpense *= 1 - params.livingExpenseDeclineRate;
    }

    // FIRE check
    const isFIREYear = !dividendFIREReached && dividendAfterTax >= livingExpense;
    if (isFIREYear) dividendFIREReached = true;

    // One-time retirement income
    let retirementIncome = 0;
    if (age === params.retirementAge) {
      retirementIncome = retirementNet;
      if (params.reinvestRetirement) stocks += retirementIncome;
      else cash += retirementIncome;
    }

    // iDeCo lump-sum payout
    let iDeCoIncome = 0;
    if (age === params.iDeCoStartReceiveAge) {
      const net = iDeCoLumpSumAfterTax(iDeCoFund, params.iDeCoYearsOfMembership);
      iDeCoIncome = net;
      if (params.reinvestRetirement) stocks += net;
      else cash += net;
      iDeCoFund = 0;
    }

    // Public pension (after 公的年金等控除 & 15% tax on excess)
    let pensionPublic = 0;
    let pensionBenefit = 0;
    if (age >= params.pensionStartAge) {
      const pGross = params.pensionMonthly * 12;
      const bGross = params.pensionRetirementBenefitMonthly * 12;
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
    if (dividendFIREReached) {
      if (balance > 0) {
        stocks += balance;
      } else {
        const deficit = -balance;
        if (cash >= deficit) {
          cash -= deficit;
        } else {
          const remaining = deficit - cash;
          cash = 0;
          stocks = Math.max(0, stocks - remaining);
        }
      }
    } else {
      // Pre-FIRE: reinvest dividends
      stocks += dividendAfterTax;
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
