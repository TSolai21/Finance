"use client";

import { useState, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import {
  Wallet,
  CheckCircle2,
  Clock,
  Printer,
  Calendar,
  CreditCard,
  MessageSquare,
  AlertTriangle,
  Receipt,
  User,
  Calculator
} from 'lucide-react'
import { generateWeeklyInstallmentSchedule, calculateLoanDemand } from '@/lib/installments'
import { formatPreDemandMessage, getWhatsAppClickToChatUrl } from '@/lib/whatsapp'
import { recalculateMonthlyInterest, calculateMonthlyLoanClosureAmount, calculateLAPDelayCharge } from '@/lib/products'

export default function LoanDetails() {
  const { id } = useParams()
  const router = useRouter()
  const [printPassbookMode, setPrintPassbookMode] = useState(false)

  // Part Payment & Closure simulation state (for Monthly Interest Loan)
  const [partPaymentAmount, setPartPaymentAmount] = useState('')
  const [showClosureModal, setShowClosureModal] = useState(false)

  const { data: loan, isLoading } = useQuery({
    queryKey: ['loan', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loans')
        .select('*, customers(id, full_name, client_id, mobile_number, address, nominee_name, nominee_relationship), loan_products(name, type, interest_rate)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    }
  })

  const { data: collections } = useQuery({
    queryKey: ['loan-collections', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('loan_id', id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    }
  })

  const totalCollected = useMemo(() => {
    return collections?.filter(c => c.status === 'Approved').reduce((sum, c) => sum + c.amount, 0) || 0
  }, [collections])

  // Demand info
  const demand = useMemo(() => {
    if (!loan) return null
    return calculateLoanDemand(
      loan.principal_amount,
      loan.emi_amount || Math.round(loan.principal_amount / 25),
      totalCollected,
      loan.first_emi_date || undefined,
      loan.tenure_weeks || undefined
    )
  }, [loan, totalCollected])

  // Schedule matrix
  const schedule = useMemo(() => {
    if (!loan || !loan.first_emi_date || !loan.tenure_weeks || !loan.emi_amount) return []
    return generateWeeklyInstallmentSchedule(
      loan.first_emi_date,
      loan.tenure_weeks,
      loan.emi_amount,
      loan.principal_amount
    )
  }, [loan])

  if (isLoading) return <div className="p-8 text-center text-slate-500">Loading loan account...</div>
  if (!loan) return <div className="p-8 text-center text-rose-500">Loan not found.</div>

  const isMonthlyLoan = loan.loan_products?.type === 'Monthly Interest'
  const isLapLoan = loan.loan_products?.type === 'LAP'

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <Breadcrumbs
            items={[
              { label: 'Loans', href: '/loans' },
              { label: `Loan Account ${loan.loan_id}` }
            ]}
          />
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Loan Account {loan.loan_id}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
              loan.status === 'Active' ? 'bg-emerald-100 text-emerald-800' :
              loan.status === 'Pending Approval' ? 'bg-amber-100 text-amber-800' :
              loan.status === 'Closed' ? 'bg-slate-100 text-slate-800' :
              'bg-rose-100 text-rose-800'
            }`}>
              {loan.status}
            </span>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Cycle {loan.cycle_number} • Permanent Client ID: {loan.customers?.client_id}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* WhatsApp Pre-Demand Reminder */}
          {loan.customers?.mobile_number && loan.first_emi_date && (
            <a
              href={getWhatsAppClickToChatUrl(
                loan.customers.mobile_number,
                formatPreDemandMessage({
                  customerName: loan.customers.full_name,
                  mobileNumber: loan.customers.mobile_number,
                  loanId: loan.loan_id,
                  dueDate: loan.first_emi_date,
                  dueAmount: demand?.currentDemand || loan.emi_amount || 0,
                  arrearAmount: demand?.arrears || 0,
                  totalDemand: demand?.totalDemand || loan.emi_amount || 0
                })
              )}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-2 rounded-lg text-xs font-bold transition-colors"
            >
              <MessageSquare size={15} className="mr-1.5 text-emerald-600" />
              WhatsApp Reminder
            </a>
          )}

          {/* Print Passbook Loan Card */}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-xs"
          >
            <Printer size={15} className="mr-1.5" /> Print Loan Card
          </button>
        </div>
      </div>

      {/* Printable Loan Card Area */}
      <div id="print-area" className="space-y-6">
        {/* Passbook Header (Printed on passbook) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 mb-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">RAM Finance Ltd.</span>
              <h2 className="text-xl font-bold text-slate-800">Borrower Passbook & Loan Card</h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">Account ID: {loan.loan_id}</p>
            </div>
            <div className="mt-2 sm:mt-0 text-left sm:text-right">
              <span className="text-xs text-slate-400 block uppercase">Client ID</span>
              <span className="font-mono text-base font-extrabold text-slate-800">{loan.customers?.client_id}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px]">Customer Name</span>
              <span className="font-bold text-slate-800 text-sm">{loan.customers?.full_name}</span>
              <span className="text-slate-500 block text-[11px] mt-0.5">{loan.customers?.mobile_number}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Nominee</span>
              <span className="font-semibold text-slate-800">{loan.customers?.nominee_name || 'N/A'}</span>
              <span className="text-slate-500 block text-[11px] mt-0.5">{loan.customers?.nominee_relationship || 'Relation'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Product & Rate</span>
              <span className="font-semibold text-slate-800">{loan.loan_products?.name || 'Loan'}</span>
              <span className="text-slate-500 block text-[11px] mt-0.5">{loan.loan_products?.interest_rate}% Interest</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">First Due Date</span>
              <span className="font-bold text-indigo-700">{loan.first_emi_date || 'Pending Setup'}</span>
            </div>
          </div>
        </div>

        {/* Financial Balances Card */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-center">
            <span className="text-slate-500 text-xs font-semibold block uppercase">Principal Disbursed</span>
            <span className="text-xl font-black text-slate-800 mt-1 block">₹{loan.principal_amount.toLocaleString()}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-center">
            <span className="text-slate-500 text-xs font-semibold block uppercase">Total Collected</span>
            <span className="text-xl font-black text-emerald-600 mt-1 block">₹{totalCollected.toLocaleString()}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-center">
            <span className="text-slate-500 text-xs font-semibold block uppercase">Current Arrears</span>
            <span className={`text-xl font-black mt-1 block ${demand?.arrears && demand.arrears > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
              ₹{(demand?.arrears || 0).toLocaleString()}
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-center">
            <span className="text-slate-500 text-xs font-semibold block uppercase">Principal Outstanding</span>
            <span className="text-xl font-black text-indigo-700 mt-1 block">
              ₹{(demand?.outstandingBalance || Math.max(0, loan.principal_amount - totalCollected)).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Special Monthly Interest Loan Settlement Card (SRS Section 13) */}
        {isMonthlyLoan && (
          <div className="bg-purple-50/70 p-5 rounded-xl border border-purple-200">
            <div className="flex items-center space-x-2 text-purple-900 font-bold text-sm mb-3">
              <Calculator size={18} />
              <span>Monthly Interest Loan Part-Payment & Settlement Engine</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="bg-white p-3 rounded-lg border border-purple-100">
                <span className="text-slate-500 block text-[10px]">Current Monthly Interest</span>
                <span className="font-bold text-slate-800 text-base">
                  ₹{recalculateMonthlyInterest(Math.max(0, loan.principal_amount - totalCollected), loan.loan_products?.interest_rate || 2.5)} / mo
                </span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-purple-100">
                <span className="text-slate-500 block text-[10px]">Full Closure Settlement Amount</span>
                <span className="font-bold text-purple-700 text-base">
                  ₹{calculateMonthlyLoanClosureAmount(
                    Math.max(0, loan.principal_amount - totalCollected),
                    recalculateMonthlyInterest(Math.max(0, loan.principal_amount - totalCollected), loan.loan_products?.interest_rate || 2.5),
                    demand?.arrears || 0
                  ).toLocaleString()}
                </span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-purple-100 flex flex-col justify-center">
                <span className="text-[10px] text-slate-500">Recalculation Rule</span>
                <span className="text-[11px] text-slate-700 font-medium">Interest automatically recalculates on remaining principal after part payment.</span>
              </div>
            </div>
          </div>
        )}

        {/* Passbook Installment Matrix */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-800 text-sm">Passbook Installment Matrix</h3>
            <span className="text-xs text-slate-500 font-medium">{loan.tenure_weeks ? `${loan.tenure_weeks} Installments` : 'Repayment Schedule'}</span>
          </div>

          {/* Native Mobile Compact Grid (< md) */}
          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 md:hidden">
            {schedule.slice(0, 15).map((inst) => {
              const isPaid = (totalCollected >= inst.installmentNumber * (loan.emi_amount || 0))
              return (
                <div
                  key={inst.installmentNumber}
                  className={`p-3 rounded-xl border flex items-center justify-between ${
                    isPaid ? 'bg-emerald-50/40 border-emerald-100' : 'bg-slate-50/60 border-slate-200/70'
                  }`}
                >
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-mono font-bold text-xs text-slate-700">#{inst.installmentNumber}</span>
                      <span className="text-xs text-slate-500 font-medium">{inst.dueDate}</span>
                    </div>
                    <span className="text-sm font-black text-slate-900 mt-0.5 block font-mono">₹{inst.totalDue}</span>
                  </div>
                  <div>
                    {isPaid ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center">
                        <CheckCircle2 size={11} className="mr-1" /> Paid
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200/80 text-slate-600">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop Full Table View (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-4 py-2.5">Inst #</th>
                  <th className="px-4 py-2.5">Due Date</th>
                  <th className="px-4 py-2.5">Due Amount</th>
                  <th className="px-4 py-2.5">Paid Date</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Collector Sign</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {schedule.slice(0, 15).map((inst) => {
                  const isPaid = (totalCollected >= inst.installmentNumber * (loan.emi_amount || 0))
                  return (
                    <tr key={inst.installmentNumber} className={isPaid ? 'bg-emerald-50/40' : ''}>
                      <td className="px-4 py-2 font-bold text-slate-700">#{inst.installmentNumber}</td>
                      <td className="px-4 py-2 text-slate-700">{inst.dueDate}</td>
                      <td className="px-4 py-2 font-bold text-slate-900">₹{inst.totalDue}</td>
                      <td className="px-4 py-2 text-slate-600">{isPaid ? 'Paid' : '—'}</td>
                      <td className="px-4 py-2">
                        {isPaid ? (
                          <span className="text-emerald-700 font-bold font-sans text-[11px] flex items-center">
                            <CheckCircle2 size={13} className="mr-1" /> Cleared
                          </span>
                        ) : (
                          <span className="text-slate-400 font-sans text-[11px]">Due</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right border-b border-dashed border-slate-200">
                        {isPaid ? <span className="font-sans text-[10px] text-slate-500">Verified</span> : '___________'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Collection History */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-800 text-sm">Receipts & Payment History</h3>
            <Link href="/collections/new" className="text-indigo-600 font-bold text-xs hover:underline active-press">
              + Record Payment
            </Link>
          </div>

          {/* Native Mobile Receipts List (< md) */}
          <div className="divide-y divide-slate-100 md:hidden">
            {collections?.map(col => (
              <div key={col.id} className="p-3.5 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-black text-slate-900">₹{col.amount.toLocaleString()}</span>
                    <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                      col.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      col.status === 'Pending Approval' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {col.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(col.created_at).toLocaleDateString()} • {col.payment_mode}
                  </p>
                </div>
                <Link
                  href={`/collections/${col.id}`}
                  className="px-3 py-1.5 rounded-lg bg-indigo-50 active:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-100 transition-colors active-press"
                >
                  Receipt
                </Link>
              </div>
            ))}
            {!collections?.length && (
              <div className="p-6 text-center text-slate-400 text-xs">No payment receipts recorded yet.</div>
            )}
          </div>

          {/* Desktop Full Table View (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-5 py-3">Receipt Date</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Mode</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Voucher</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {collections?.map(col => (
                  <tr key={col.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-700">{new Date(col.created_at).toLocaleDateString()}</td>
                    <td className="px-5 py-3 font-bold text-slate-900">₹{col.amount.toLocaleString()}</td>
                    <td className="px-5 py-3 text-slate-600">{col.payment_mode}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        col.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                        col.status === 'Pending Approval' ? 'bg-amber-100 text-amber-800' :
                        col.status === 'Reversed' ? 'bg-rose-100 text-rose-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {col.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/collections/${col.id}`} className="text-indigo-600 font-bold hover:underline">
                        View Receipt
                      </Link>
                    </td>
                  </tr>
                ))}
                {!collections?.length && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">No payment receipts recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
