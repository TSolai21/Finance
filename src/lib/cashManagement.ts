export interface CashDenominations {
  [key: number]: number
}

export const DENOMINATION_VALUES = [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1]

export function calculateDenominationTotal(denominations: CashDenominations): number {
  return DENOMINATION_VALUES.reduce((total, val) => {
    const count = denominations[val] || 0
    return total + val * count
  }, 0)
}

export function formatDenominationsSummary(denominations: CashDenominations): string {
  const parts: string[] = []
  for (const val of DENOMINATION_VALUES) {
    const count = denominations[val] || 0
    if (count > 0) {
      parts.push(`₹${val} × ${count} = ₹${val * count}`)
    }
  }
  return parts.join('; ')
}

export interface BranchDailyFinancialPosition {
  openingCash: number
  cashCollections: number
  digitalCollections: number
  disbursementsPaid: number
  branchExpenses: number
  otherReceipts: number
  otherPayments: number
  staffHandover: number
  hoHandover: number
  physicalCashCounted: number
}

export interface BranchReconciliationResult {
  openingCash: number
  cashCollections: number
  digitalCollections: number
  disbursementsPaid: number
  branchExpenses: number
  otherReceipts: number
  otherPayments: number
  staffHandover: number
  hoHandover: number
  totalInflows: number
  totalOutflows: number
  closingCashSystem: number
  physicalCashCounted: number
  differenceAmount: number
  isBalanced: boolean
  status: 'Balanced' | 'Excess Cash' | 'Cash Shortage'
}

/**
 * 10-Point Branch Daily Financial Position Calculator:
 * System Closing Cash = Opening + Cash Collections + Other Receipts + Staff Handover - Disbursements - Branch Expenses - Other Payments - HO Handover
 */
export function calculateBranchDailyReconciliation(
  data: BranchDailyFinancialPosition
): BranchReconciliationResult {
  const totalInflows =
    (data.openingCash || 0) +
    (data.cashCollections || 0) +
    (data.otherReceipts || 0) +
    (data.staffHandover || 0)

  const totalOutflows =
    (data.disbursementsPaid || 0) +
    (data.branchExpenses || 0) +
    (data.otherPayments || 0) +
    (data.hoHandover || 0)

  const closingCashSystem = totalInflows - totalOutflows
  const differenceAmount = (data.physicalCashCounted || 0) - closingCashSystem
  const isBalanced = Math.abs(differenceAmount) < 0.01

  let status: 'Balanced' | 'Excess Cash' | 'Cash Shortage' = 'Balanced'
  if (differenceAmount > 0.01) {
    status = 'Excess Cash'
  } else if (differenceAmount < -0.01) {
    status = 'Cash Shortage'
  }

  return {
    ...data,
    totalInflows,
    totalOutflows,
    closingCashSystem,
    differenceAmount,
    isBalanced,
    status
  }
}
