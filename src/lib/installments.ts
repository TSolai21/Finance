export interface Installment {
  installmentNumber: number
  dueDate: string // YYYY-MM-DD
  principalDue: number
  interestDue: number
  totalDue: number
  paidAmount: number
  status: 'Pending' | 'Partially Paid' | 'Paid' | 'Overdue'
}

/**
 * Generate Weekly Micro Finance Installment Schedule:
 * Generates an array of weekly installments from a given first EMI date.
 */
export function generateWeeklyInstallmentSchedule(
  startDateStr: string,
  tenureWeeks: number,
  ewiAmount: number,
  principalAmount: number
): Installment[] {
  const schedule: Installment[] = []
  const start = new Date(startDateStr)
  
  // Approximate principal/interest per installment
  const totalRepayable = ewiAmount * tenureWeeks
  const totalInterest = Math.max(0, totalRepayable - principalAmount)
  const principalPerInstallment = Math.round((principalAmount / tenureWeeks) * 100) / 100
  const interestPerInstallment = Math.round((totalInterest / tenureWeeks) * 100) / 100

  for (let i = 1; i <= tenureWeeks; i++) {
    const dueDate = new Date(start)
    dueDate.setDate(start.getDate() + (i - 1) * 7)
    const dueDateFormatted = dueDate.toISOString().split('T')[0]

    schedule.push({
      installmentNumber: i,
      dueDate: dueDateFormatted,
      principalDue: principalPerInstallment,
      interestDue: interestPerInstallment,
      totalDue: ewiAmount,
      paidAmount: 0,
      status: 'Pending'
    })
  }

  return schedule
}

/**
 * Generate Monthly LAP / Monthly Interest Schedule:
 */
export function generateMonthlyInstallmentSchedule(
  startDateStr: string,
  tenureMonths: number,
  monthlyAmount: number,
  principalAmount: number,
  isInterestOnly: boolean = false
): Installment[] {
  const schedule: Installment[] = []
  const start = new Date(startDateStr)

  for (let i = 1; i <= tenureMonths; i++) {
    const dueDate = new Date(start)
    dueDate.setMonth(start.getMonth() + i)
    const dueDateFormatted = dueDate.toISOString().split('T')[0]

    const principalDue = isInterestOnly ? (i === tenureMonths ? principalAmount : 0) : Math.round(principalAmount / tenureMonths)
    const interestDue = isInterestOnly ? monthlyAmount : Math.max(0, monthlyAmount - principalDue)

    schedule.push({
      installmentNumber: i,
      dueDate: dueDateFormatted,
      principalDue,
      interestDue,
      totalDue: isInterestOnly && i === tenureMonths ? principalAmount + monthlyAmount : monthlyAmount,
      paidAmount: 0,
      status: 'Pending'
    })
  }

  return schedule
}

/**
 * Demand Calculation Engine:
 * Calculates Current Demand, Arrears, Advance, and Total Demand
 */
export function calculateLoanDemand(
  principalAmount: number,
  emiAmount: number,
  totalApprovedCollections: number,
  firstEmiDateStr?: string,
  tenureWeeks?: number
) {
  if (!emiAmount || !firstEmiDateStr) {
    const pendingBalance = Math.max(0, principalAmount - totalApprovedCollections)
    return {
      currentDemand: emiAmount || 0,
      arrears: 0,
      advance: 0,
      totalDemand: emiAmount || 0,
      outstandingBalance: pendingBalance,
      weeksElapsed: 0,
      expectedToDate: 0
    }
  }

  const firstEmi = new Date(firstEmiDateStr)
  const today = new Date()
  
  // Calculate weeks elapsed since first EMI date
  const diffTime = today.getTime() - firstEmi.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  const weeksElapsed = diffDays >= 0 ? Math.floor(diffDays / 7) + 1 : 0
  
  const cappedWeeks = tenureWeeks ? Math.min(weeksElapsed, tenureWeeks) : weeksElapsed
  const expectedToDate = cappedWeeks * emiAmount

  let arrears = 0
  let advance = 0

  if (totalApprovedCollections < expectedToDate) {
    arrears = expectedToDate - totalApprovedCollections
  } else {
    advance = totalApprovedCollections - expectedToDate
  }

  const currentDemand = emiAmount
  const totalDemand = Math.max(0, currentDemand + arrears - advance)
  const totalRepayable = tenureWeeks ? emiAmount * tenureWeeks : principalAmount
  const outstandingBalance = Math.max(0, totalRepayable - totalApprovedCollections)

  return {
    currentDemand,
    arrears,
    advance,
    totalDemand,
    outstandingBalance,
    weeksElapsed: cappedWeeks,
    expectedToDate
  }
}
