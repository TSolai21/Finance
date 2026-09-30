// RAM Finance Loan Products Master & Financial Calculations

export interface MicroFinanceProduct {
  id?: string
  amount: number
  tenure: number // in weeks
  ewi: number
  processingFeePercent: number
}

// 15 Standard Micro Finance products as required by SRS Section 3
export const STANDARD_MICRO_FINANCE_PRODUCTS: MicroFinanceProduct[] = [
  { amount: 10000, tenure: 20, ewi: 630, processingFeePercent: 3.0 },
  { amount: 10000, tenure: 15, ewi: 820, processingFeePercent: 3.0 },
  { amount: 15000, tenure: 25, ewi: 750, processingFeePercent: 3.0 },
  { amount: 15000, tenure: 30, ewi: 630, processingFeePercent: 3.0 },
  { amount: 20000, tenure: 25, ewi: 990, processingFeePercent: 3.0 },
  { amount: 20000, tenure: 30, ewi: 830, processingFeePercent: 3.0 },
  { amount: 20000, tenure: 40, ewi: 630, processingFeePercent: 3.0 },
  { amount: 25000, tenure: 25, ewi: 1230, processingFeePercent: 3.0 },
  { amount: 25000, tenure: 30, ewi: 1030, processingFeePercent: 3.0 },
  { amount: 25000, tenure: 40, ewi: 790, processingFeePercent: 3.0 },
  { amount: 30000, tenure: 25, ewi: 1450, processingFeePercent: 3.0 },
  { amount: 30000, tenure: 30, ewi: 1230, processingFeePercent: 3.0 },
  { amount: 30000, tenure: 40, ewi: 930, processingFeePercent: 3.0 },
  { amount: 30000, tenure: 52, ewi: 730, processingFeePercent: 3.0 },
  { amount: 30000, tenure: 60, ewi: 640, processingFeePercent: 3.0 },
]

export const PRODUCT_TYPES = ['Micro Finance', 'LAP', 'Monthly Interest'] as const
export type ProductType = typeof PRODUCT_TYPES[number]

export interface LAPTerms {
  loanAmount: number
  interestRateMonthly: number // e.g. 2%
  tenureMonths: number
  emiAmount: number
  emiDates: number[] // default [5, 10]
  processingFeePercent: number // 2.5%
  foreclosureChargesPercent: number // 2.0%
}

export interface MonthlyInterestTerms {
  principalAmount: number
  monthlyInterestRate: number // e.g. 2.5%
  repaymentMode: 'Bullet' | 'Monthly Interest'
  disbursementDate: string
}

/**
 * Calculates LAP late delay charges:
 * "If EMI is delayed beyond 3 days, an additional 2% applies to delayed days only."
 * Delay Penalty = EMI * 2% * (Delayed Days / 30)
 */
export function calculateLAPDelayCharge(emiAmount: number, daysDelayed: number, lateRatePercent: number = 2.0): number {
  const GRACE_PERIOD_DAYS = 3
  if (daysDelayed <= GRACE_PERIOD_DAYS) return 0
  const chargeableDays = daysDelayed // or daysDelayed - GRACE_PERIOD_DAYS based on policy, standard: delayed days only
  const charge = (emiAmount * (lateRatePercent / 100) * chargeableDays) / 30
  return Math.round(charge * 100) / 100
}

/**
 * Calculates Processing Fee:
 * Micro Finance: 3.0%
 * LAP: 2.5%
 * Monthly Interest: 2.0%
 */
export function calculateProcessingFee(productType: ProductType, amount: number, isExistingCustomer: boolean = false): number {
  if (productType === 'Micro Finance') {
    return Math.round(amount * 0.03) // 3%
  } else if (productType === 'LAP') {
    return Math.round(amount * 0.025) // 2.5%
  } else {
    return Math.round(amount * 0.02) // 2%
  }
}

/**
 * Calculates Foreclosure charges for LAP:
 * 2% of principal outstanding
 */
export function calculateForeclosureCharge(principalOutstanding: number): number {
  return Math.round(principalOutstanding * 0.02)
}

/**
 * Monthly Interest Loan Part Payment & Recalculation:
 * Ongoing monthly interest recalculates on remaining principal:
 * New Monthly Interest = Remaining Principal * (Monthly Rate / 100)
 */
export function recalculateMonthlyInterest(remainingPrincipal: number, monthlyRatePercent: number): number {
  return Math.round((remainingPrincipal * (monthlyRatePercent / 100)) * 100) / 100
}

/**
 * Monthly Interest Loan Full Closure Settlement:
 * Closure = Principal Outstanding + Accrued Interest + Arrears + Other charges
 */
export function calculateMonthlyLoanClosureAmount(
  principalOutstanding: number,
  accruedInterest: number,
  arrears: number = 0,
  charges: number = 0
): number {
  return Math.round((principalOutstanding + accruedInterest + arrears + charges) * 100) / 100
}
