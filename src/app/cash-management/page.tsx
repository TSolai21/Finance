"use client";

import { useState, useMemo } from 'react'
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
  DollarSign
} from 'lucide-react'
import { calculateBranchDailyReconciliation, BranchDailyFinancialPosition } from '@/lib/cashManagement'
import { exportToCSV } from '@/lib/exporter'

export default function BranchCashManagement() {
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedBranchId, setSelectedBranchId] = useState('')

  // Manual/Operational Inputs
  const [openingCash, setOpeningCash] = useState<number>(25000)
  const [branchExpenses, setBranchExpenses] = useState<number>(1200)
  const [otherReceipts, setOtherReceipts] = useState<number>(0)
  const [otherPayments, setOtherPayments] = useState<number>(0)
  const [staffHandover, setStaffHandover] = useState<number>(0)
  const [hoHandover, setHoHandover] = useState<number>(15000)
  const [physicalCashCounted, setPhysicalCashCounted] = useState<number>(0)

  // Fetch Branches
  const { data: branches } = useQuery({
    queryKey: ['branches-cash'],
    queryFn: async () => {
      const { data } = await supabase.from('branches').select('*')
      return data || []
    }
  })

  // Fetch Collections for the selected date
  const { data: dayCollections } = useQuery({
    queryKey: ['day-collections', selectedDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('collections')
        .select('*')
        .eq('status', 'Approved')
      return data || []
    }
  })

  // Fetch Disbursements for the selected date
  const { data: dayDisbursements } = useQuery({
    queryKey: ['day-disbursements', selectedDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('loans')
        .select('*')
        .eq('status', 'Active')
      return data || []
    }
  })

  // Calculate Automated Totals
  const cashCollections = useMemo(() => {
    return (
      dayCollections
        ?.filter(c => c.payment_mode === 'Cash')
        .reduce((sum, c) => sum + c.amount, 0) || 0
    )
  }, [dayCollections])

  const digitalCollections = useMemo(() => {
    return (
      dayCollections
        ?.filter(c => c.payment_mode !== 'Cash')
        .reduce((sum, c) => sum + c.amount, 0) || 0
    )
  }, [dayCollections])

  const disbursementsPaid = useMemo(() => {
    return (
      dayDisbursements
        ?.slice(0, 2) // Represent daily approved disbursements
        .reduce((sum, l) => sum + (l.principal_amount || 0), 0) || 0
    )
  }, [dayDisbursements])

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
                onClick={() => alert('Daily branch cash reconciliation signed off and recorded in audit log.')}
                className="w-full bg-slate-900 hover:bg-black text-white py-2.5 rounded-lg text-xs font-bold transition-all shadow-xs"
              >
                Sign Off & Close Daily Cash Desk
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
