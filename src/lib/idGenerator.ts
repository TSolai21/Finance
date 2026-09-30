import { supabase } from '@/lib/supabase'

/**
 * Generate Next Permanent Client ID:
 * Format: RF0001, RF0002, etc.
 * Never resets, unique and permanent across all cycles.
 */
export async function generateNextClientId(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('client_id')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error || !data || data.length === 0) {
      return 'RF0001'
    }

    let maxNum = 0
    for (const row of data) {
      if (row.client_id && row.client_id.startsWith('RF')) {
        const numPart = parseInt(row.client_id.replace('RF', ''), 10)
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart
        }
      }
    }

    const nextNum = maxNum + 1
    return `RF${nextNum.toString().padStart(4, '0')}`
  } catch (e) {
    console.error('Error generating client ID:', e)
    return `RF${Math.floor(1000 + Math.random() * 9000)}`
  }
}

/**
 * Map Cycle Number to Loan Prefix:
 * Cycle 1 -> PPRA
 * Cycle 2 -> PPRB
 * Cycle 3 -> PPRC
 * Cycle 4 -> PPRD
 * ...
 */
export function getCyclePrefix(cycleNumber: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const index = Math.max(0, cycleNumber - 1)
  const letter = letters[index % letters.length] || 'A'
  return `PPR${letter}`
}

/**
 * Generate Next Cycle-Based Loan ID:
 * e.g., PPRA0001 for 1st cycle, PPRB0001 for 2nd cycle
 */
export async function generateNextLoanId(cycleNumber: number = 1): Promise<string> {
  const prefix = getCyclePrefix(cycleNumber)

  try {
    const { data, error } = await supabase
      .from('loans')
      .select('loan_id')
      .ilike('loan_id', `${prefix}%`)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error || !data || data.length === 0) {
      return `${prefix}0001`
    }

    let maxNum = 0
    for (const row of data) {
      if (row.loan_id && row.loan_id.startsWith(prefix)) {
        const numPart = parseInt(row.loan_id.replace(prefix, ''), 10)
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart
        }
      }
    }

    const nextNum = maxNum + 1
    return `${prefix}${nextNum.toString().padStart(4, '0')}`
  } catch (e) {
    console.error('Error generating loan ID:', e)
    return `${prefix}${Math.floor(1000 + Math.random() * 9000)}`
  }
}

/**
 * Get Customer Loan Cycle Number:
 * Counts existing loans for this customer to determine next cycle.
 */
export async function getCustomerNextCycle(customerId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('loans')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)

    if (error || count === null || count === undefined) {
      return 1
    }

    return count + 1
  } catch (e) {
    console.error('Error determining customer cycle:', e)
    return 1
  }
}
