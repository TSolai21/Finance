"use client";

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  Banknote,
  Calendar,
  Building,
  CheckCircle2,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  FileSpreadsheet,
  Save,
  RefreshCw,
  DollarSign,
  X
} from 'lucide-react'
import { calculateBranchDailyReconciliation, BranchDailyFinancialPosition } from '@/lib/cashManagement'
import { exportToCSV } from '@/lib/exporter'

export default function BranchCashManagement() {
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [dayEndBlockedModal, setDayEndBlockedModal] = useState(false)
  const [dayEndSuccessModal, setDayEndSuccessModal] = useState(false)
  const [dayEndClosed, setDayEndClosed] = useState(false)

  // Manual/Operational Inputs (Initialized to 0 - loaded dynamically from database)
  const [openingCash, setOpeningCash] = useState<number>(0)
  const [branchExpenses, setBranchExpenses] = useState<number>(0)
  const [otherReceipts, setOtherReceipts] = useState<number>(0)
  const [otherPayments, setOtherPayments] = useState<number>(0)
  const [staffHandover, setStaffHandover] = useState<number>(0)
  const [hoHandover, setHoHandover] = useState<number>(0)
  const [physicalCashCounted, setPhysicalCashCounted] = useState<number>(0)

  // Fetch Branches
  const { data: branches } = useQuery({
    queryKey: ['branches-cash'],
    queryFn: async () => {
      const { data } = await supabase.from('branches').select('*')
      return data || []
    }
  })

  // Fetch existing recorded daily cash desk record from database for this branch & date
  const { data: existingCashRecord } = useQuery({
    queryKey: ['existing-cash-record', selectedDate, selectedBranchId],
    queryFn: async () => {
      const bId = selectedBranchId || branches?.[0]?.id
      if (!bId) return null
      const { data } = await supabase
        .from('branch_cash_daily')
        .select('*')
        .eq('branch_id', bId)
        .eq('record_date', selectedDate)
        .maybeSingle()
      return data || null
    },
    enabled: !!selectedDate
  })

  // Sync inputs from database record when loaded
  useMemo(() => {
    if (existingCashRecord) {
      setOpeningCash(existingCashRecord.opening_cash || 0)
      setBranchExpenses(existingCashRecord.branch_expenses || 0)
      setOtherReceipts(existingCashRecord.other_receipts || 0)
      setOtherPayments(existingCashRecord.other_payments || 0)
      setStaffHandover(existingCashRecord.staff_handover || 0)
      setHoHandover(existingCashRecord.ho_handover || 0)
      setPhysicalCashCounted(existingCashRecord.physical_cash_counted || 0)
      setDayEndClosed(existingCashRecord.status === 'Reconciled')
    } else {
      setDayEndClosed(false)
    }
  }, [existingCashRecord])

  // Fetch Collections for the selected date from database
  const { data: dayCollections } = useQuery({
    queryKey: ['day-collections', selectedDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('collections')
        .select('*')
        .eq('status', 'Approved')
        .gte('created_at', `${selectedDate}T00:00:00`)
        .lte('created_at', `${selectedDate}T23:59:59`)
      return data || []
    }
  })

  // Check for pending collections for the day (Must be approved or rejected before Day-End closure)
  const { data: pendingCollections } = useQuery({
    queryKey: ['day-pending-collections', selectedDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('collections')
        .select('id, amount, status, voucher_number, customers(full_name, client_id)')
        .eq('status', 'Pending Approval')
        .gte('created_at', `${selectedDate}T00:00:00`)
        .lte('created_at', `${selectedDate}T23:59:59`)
      return data || []
    }
  })

  // Fetch Disbursements for the selected date from database
  const { data: dayDisbursements } = useQuery({
    queryKey: ['day-disbursements', selectedDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('loans')
        .select('*')
        .eq('status', 'Active')
        .or(`disbursement_date.eq.${selectedDate},created_at.gte.${selectedDate}T00:00:00`)
      return data || []
    }
  })

  // Calculate Automated Totals from actual database rows
  const cashCollections = useMemo(() => {
    return (
      dayCollections
        ?.filter(c => c.payment_mode === 'Cash')
        .reduce((sum, c) => sum + (c.amount || 0), 0) || 0
    )
  }, [dayCollections])

  const digitalCollections = useMemo(() => {
    return (
      dayCollections
        ?.filter(c => c.payment_mode !== 'Cash')
        .reduce((sum, c) => sum + (c.amount || 0), 0) || 0
    )
  }, [dayCollections])

  const disbursementsPaid = useMemo(() => {
    return (
      dayDisbursements
        ?.filter(l => l.disbursement_date === selectedDate || l.created_at?.startsWith(selectedDate))
        .reduce((sum, l) => sum + (l.principal_amount || 0), 0) || 0
    )
  }, [dayDisbursements, selectedDate])

  // Compute 10-Point Reconciliation
  const financialPosition: BranchDailyFinancialPosition = {
    openingCash,
    cashCollections,
    digitalCollections,
    disbursementsPaid,
    branchExpenses,
    otherReceipts,
    otherPayments,
    staffHandover,
    hoHandover,
    physicalCashCounted: physicalCashCounted || 0
  }

  const reconciliation = useMemo(() => {
    return calculateBranchDailyReconciliation(financialPosition)
  }, [financialPosition])

  // Export Daily Cash Sheet
  const handleExport = () => {
    const reportData = [
      { Metric: '1. Opening Cash Balance', Amount: reconciliation.openingCash },
      { Metric: '2. Cash Collections (+)', Amount: reconciliation.cashCollections },
      { Metric: '3. Digital Collections (Reconciled)', Amount: reconciliation.digitalCollections },
      { Metric: '4. Disbursements Paid (-)', Amount: reconciliation.disbursementsPaid },
      { Metric: '5. Branch Expenses (-)', Amount: reconciliation.branchExpenses },
      { Metric: '6. Other Receipts (+)', Amount: reconciliation.otherReceipts },
      { Metric: '7. Other Payments (-)', Amount: reconciliation.otherPayments },
      { Metric: '8. Staff Cash Handover (+)', Amount: reconciliation.staffHandover },
      { Metric: '9. HO Remittance (-)', Amount: reconciliation.hoHandover },
      { Metric: '10. System Closing Cash', Amount: reconciliation.closingCashSystem },
      { Metric: 'Physical Cash Counted', Amount: reconciliation.physicalCashCounted },
      { Metric: 'Difference / Variance', Amount: reconciliation.differenceAmount },
      { Metric: 'Reconciliation Status', Amount: reconciliation.status }
    ]
    exportToCSV(reportData, `RAM_Finance_Branch_Cash_${selectedDate}`)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Branch Daily Cash Management</h1>
          <p className="text-slate-500 text-sm">
            10-Point Financial Position & Daily Cash Reconciliation
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold outline-none focus:border-indigo-600 bg-white"
          />
          <button
            onClick={handleExport}
            className="inline-flex items-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors"
          >
            <FileSpreadsheet size={15} className="mr-1.5" /> Export Cash Sheet
          </button>
        </div>
      </div>

      {/* 10-Point Cash Statement Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Cash Inflows & Outflows Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h2 className="font-bold text-slate-800 text-sm">10-Point Daily Financial Ledger</h2>
              <span className="text-xs font-mono font-bold text-indigo-700">{selectedDate}</span>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {/* 1. Opening Cash Balance */}
              <div className="p-4 flex items-center justify-between bg-slate-50/50">
                <span className="font-bold text-slate-700">1. Opening Cash Balance</span>
                <input
                  type="number"
                  value={openingCash}
                  onChange={e => setOpeningCash(parseFloat(e.target.value) || 0)}
                  className="w-32 text-right font-black font-mono text-slate-900 border border-slate-300 rounded px-2 py-1 outline-none"
                />
              </div>

              {/* 2. Cash Collections */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center text-emerald-700">
                  <ArrowDownCircle size={16} className="mr-2" />
                  <span className="font-semibold">2. Cash Collections (+)</span>
                </div>
                <span className="font-black font-mono text-emerald-700 text-sm">
                  + ₹{cashCollections.toLocaleString()}
                </span>
              </div>

              {/* 3. Digital Collections */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center text-purple-700">
                  <ArrowDownCircle size={16} className="mr-2" />
                  <span className="font-semibold">3. Digital / UPI Collections (Bank Account)</span>
                </div>
                <span className="font-black font-mono text-purple-700 text-sm">
                  ₹{digitalCollections.toLocaleString()}
                </span>
              </div>

              {/* 4. Approved Disbursements */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center text-rose-700">
                  <ArrowUpCircle size={16} className="mr-2" />
                  <span className="font-semibold">4. Approved Disbursements Paid (-)</span>
                </div>
                <span className="font-black font-mono text-rose-700 text-sm">
                  - ₹{disbursementsPaid.toLocaleString()}
                </span>
              </div>

              {/* 5. Branch Expenses */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center text-rose-700">
                  <ArrowUpCircle size={16} className="mr-2" />
                  <span className="font-semibold">5. Branch Operational Expenses (-)</span>
                </div>
                <input
                  type="number"
                  value={branchExpenses}
                  onChange={e => setBranchExpenses(parseFloat(e.target.value) || 0)}
                  className="w-32 text-right font-black font-mono text-rose-700 border border-slate-300 rounded px-2 py-1 outline-none"
                />
              </div>

              {/* 6. Other Cash Receipts / Payments */}
              <div className="p-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">6a. Other Receipts (+)</label>
                  <input
                    type="number"
                    value={otherReceipts}
                    onChange={e => setOtherReceipts(parseFloat(e.target.value) || 0)}
                    className="w-full text-right font-mono border border-slate-300 rounded px-2 py-1 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">6b. Other Payments (-)</label>
                  <input
                    type="number"
                    value={otherPayments}
                    onChange={e => setOtherPayments(parseFloat(e.target.value) || 0)}
                    className="w-full text-right font-mono border border-slate-300 rounded px-2 py-1 outline-none"
                  />
                </div>
              </div>

              {/* 7. Staff Cash Handover */}
              <div className="p-4 flex items-center justify-between">
                <span className="font-semibold text-slate-700">7. Staff Field Cash Handover (+)</span>
                <input
                  type="number"
                  value={staffHandover}
                  onChange={e => setStaffHandover(parseFloat(e.target.value) || 0)}
                  className="w-32 text-right font-mono border border-slate-300 rounded px-2 py-1 outline-none"
                />
              </div>

              {/* 8. Admin / HO Handover */}
              <div className="p-4 flex items-center justify-between">
                <span className="font-semibold text-slate-700">8. Admin / HO Handover Remittance (-)</span>
                <input
                  type="number"
                  value={hoHandover}
                  onChange={e => setHoHandover(parseFloat(e.target.value) || 0)}
                  className="w-32 text-right font-mono text-rose-700 border border-slate-300 rounded px-2 py-1 outline-none"
                />
              </div>

              {/* 9. Expected Closing Balance */}
              <div className="p-4 flex items-center justify-between bg-indigo-50/70 border-t-2 border-indigo-200">
                <span className="font-extrabold text-slate-900 text-sm">9. Expected System Closing Cash Balance</span>
                <span className="font-black font-mono text-indigo-900 text-lg">
                  ₹{reconciliation.closingCashSystem.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Physical Cash Verification & Discrepancy Reconciliation */}
        <div className="space-y-6 col-span-1">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
            <h3 className="font-bold text-slate-800 text-sm mb-4 border-b border-slate-100 pb-2">
              10. Physical Cash Count vs. Expected
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Physical Cash Counted in Vault (₹) *
                </label>
                <input
                  type="number"
                  placeholder="Enter physical cash counted"
                  value={physicalCashCounted || ''}
                  onChange={e => setPhysicalCashCounted(parseFloat(e.target.value) || 0)}
                  className="w-full text-lg font-black text-slate-900 border-2 border-slate-300 rounded-lg p-2.5 outline-none focus:border-indigo-600"
                />
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">System Expected:</span>
                  <span className="font-bold text-slate-800">₹{reconciliation.closingCashSystem.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Physical Counted:</span>
                  <span className="font-bold text-slate-800">₹{reconciliation.physicalCashCounted.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 font-bold">
                  <span className="text-slate-700">Variance / Difference:</span>
                  <span className={reconciliation.isBalanced ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>
                    ₹{reconciliation.differenceAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div
                className={`p-4 rounded-xl border text-center font-bold text-xs flex flex-col items-center ${
                  reconciliation.isBalanced
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : reconciliation.status === 'Excess Cash'
                    ? 'bg-blue-50 border-blue-300 text-blue-800'
                    : 'bg-rose-50 border-rose-300 text-rose-800'
                }`}
              >
                {reconciliation.isBalanced ? (
                  <>
                    <CheckCircle2 size={24} className="mb-1 text-emerald-600" />
                    <span>DAILY CASH BALANCED</span>
                    <span className="text-[10px] font-normal text-emerald-600 mt-0.5">Physical cash matches system ledger perfectly</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={24} className="mb-1 text-rose-600" />
                    <span>{reconciliation.status.toUpperCase()} DETECTED</span>
                    <span className="text-[10px] font-normal mt-0.5">Discrepancy: ₹{Math.abs(reconciliation.differenceAmount).toLocaleString()}</span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={async () => {
                  if (pendingCollections && pendingCollections.length > 0) {
                    setDayEndBlockedModal(true)
                    return
                  }
                  try {
                    const branchId = selectedBranchId || branches?.[0]?.id || null
                    if (branchId) {
                      await supabase
                        .from('branch_cash_daily')
                        .upsert({
                          branch_id: branchId,
                          record_date: selectedDate,
                          opening_cash: reconciliation.openingCash,
                          cash_collections: reconciliation.cashCollections,
                          digital_collections: reconciliation.digitalCollections,
                          disbursements_paid: reconciliation.disbursementsPaid,
                          branch_expenses: reconciliation.branchExpenses,
                          other_receipts: reconciliation.otherReceipts,
                          other_payments: reconciliation.otherPayments,
                          staff_handover: reconciliation.staffHandover,
                          ho_handover: reconciliation.hoHandover,
                          closing_cash_system: reconciliation.closingCashSystem,
                          physical_cash_counted: reconciliation.physicalCashCounted,
                          difference_amount: reconciliation.differenceAmount,
                          status: reconciliation.isBalanced ? 'Reconciled' : 'Discrepancy'
                        }, { onConflict: 'branch_id,record_date' })
                    }
                    setDayEndClosed(true)
                    setDayEndSuccessModal(true)
                  } catch (e: any) {
                    alert(`Error recording day end: ${e.message}`)
                  }
                }}
                className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center ${
                  dayEndClosed
                    ? 'bg-emerald-600 text-white cursor-default'
                    : 'bg-slate-900 hover:bg-black text-white'
                }`}
              >
                {dayEndClosed ? '✓ Daily Cash Desk Closed & Reconciled' : 'Sign Off & Close Daily Cash Desk'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Blocked Day-End Closure due to Pending Collections */}
      {dayEndBlockedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-rose-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start space-x-3 text-rose-600 mb-4">
              <AlertTriangle size={28} className="shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold text-slate-900">Day-End Closure Blocked</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Daily branch cash collection at the end of the day must close <strong>only after all collection entries are Approved or Rejected</strong>.
                </p>
              </div>
            </div>

            <div className="bg-rose-50 p-3.5 rounded-xl border border-rose-100 text-xs text-rose-800 mb-4">
              <span className="font-bold">Pending Approval Entries:</span> {pendingCollections?.length || 0} collections are currently awaiting Manager sign-off.
            </div>

            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl mb-5 text-xs">
              {pendingCollections?.map((col: any) => (
                <div key={col.id} className="p-3 flex justify-between items-center bg-white hover:bg-slate-50">
                  <div>
                    <span className="font-bold text-slate-800">{col.customers?.full_name}</span>
                    <span className="text-[10px] text-slate-400 block font-mono">{col.voucher_number || col.id.slice(0, 8)}</span>
                  </div>
                  <span className="font-mono font-bold text-rose-700">₹{col.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setDayEndBlockedModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Close
              </button>
              <Link
                href="/approvals"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center"
              >
                Go to Approvals Screen $\rightarrow$
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Day-End Successfully Closed */}
      {dayEndSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-emerald-200 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="h-14 w-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-lg font-black text-slate-900">Branch Cash Desk Closed</h3>
            <p className="text-xs text-slate-600 mt-1">
              All collections for {selectedDate} verified. Physical and digital balances have been reconciled and posted to the branch ledger.
            </p>
            <button
              type="button"
              onClick={() => setDayEndSuccessModal(false)}
              className="mt-5 w-full bg-slate-900 hover:bg-black text-white py-2 rounded-lg text-xs font-bold transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
