"use client";

import { useMemo } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  Wallet,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  CreditCard,
  PlusCircle,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  Building,
  UserCheck
} from 'lucide-react'

export default function Dashboard() {
  // 1. Pending Collections
  const { data: pendingCollections } = useQuery({
    queryKey: ['dashboard-pending-collections'],
    queryFn: async () => {
      const { data } = await supabase
        .from('collections')
        .select('*, customers(full_name, client_id), loans(loan_id)')
        .eq('status', 'Pending Approval')
        .order('created_at', { ascending: false })
        .limit(6)
      return data || []
    }
  })

  // 2. Pending Disbursements
  const { data: pendingDisbursements } = useQuery({
    queryKey: ['dashboard-pending-disbursements'],
    queryFn: async () => {
      const { data } = await supabase
        .from('loans')
        .select('*, customers(full_name, client_id), loan_products(name)')
        .eq('status', 'Pending Approval')
        .order('created_at', { ascending: false })
        .limit(6)
      return data || []
    }
  })

  // 3. Loans and Collections for Aggregation
  const { data: loansData } = useQuery({
    queryKey: ['dashboard-loans'],
    queryFn: async () => {
      const { data } = await supabase.from('loans').select('id, principal_amount, emi_amount, status, created_at')
      return data || []
    }
  })

  const { data: collectionsData } = useQuery({
    queryKey: ['dashboard-collections'],
    queryFn: async () => {
      const { data } = await supabase.from('collections').select('id, amount, payment_mode, status, created_at')
      return data || []
    }
  })

  // Aggregated Financial Metrics
  const metrics = useMemo(() => {
    const activeLoans = (loansData || []).filter(l => l.status === 'Active')
    const totalDisbursed = activeLoans.reduce((acc, curr) => acc + curr.principal_amount, 0)
    const approvedCollections = (collectionsData || []).filter(c => c.status === 'Approved')
    const totalCollection = approvedCollections.reduce((acc, curr) => acc + curr.amount, 0)
    
    // Cash vs Digital breakdown
    const cashCollections = approvedCollections.filter(c => c.payment_mode === 'Cash').reduce((a, c) => a + c.amount, 0)
    const digitalCollections = approvedCollections.filter(c => c.payment_mode !== 'Cash').reduce((a, c) => a + c.amount, 0)

    // Demand calculation
    const totalDemand = activeLoans.reduce((acc, curr) => acc + (curr.emi_amount || Math.round(curr.principal_amount / 25)), 0)
    const totalArrears = Math.max(0, totalDemand - totalCollection)
    const collectionPercent = totalDemand > 0 ? Math.min(100, Math.round((totalCollection / totalDemand) * 100)) : 100

    return {
      totalDisbursed,
      totalDemand,
      totalCollection,
      cashCollections,
      digitalCollections,
      totalArrears,
      collectionPercent,
      activeLoansCount: activeLoans.length,
      pendingApprovalsCount: (pendingCollections?.length || 0) + (pendingDisbursements?.length || 0)
    }
  }, [loansData, collectionsData, pendingCollections, pendingDisbursements])

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Welcome & Quick Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Operations Hub</h1>
          <p className="text-slate-500 text-xs md:text-sm mt-0.5">Real-time portfolio demand, collections, and approvals.</p>
        </div>

        {/* Desktop Quick Actions */}
        <div className="hidden sm:flex flex-wrap items-center gap-2">
          <Link
            href="/loans/new"
            className="inline-flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm shadow-indigo-300 transition-all active-press"
          >
            <PlusCircle size={15} className="mr-1.5" /> New Loan
          </Link>
          <Link
            href="/collections/new"
            className="inline-flex items-center bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm shadow-emerald-300 transition-all active-press"
          >
            <CreditCard size={15} className="mr-1.5" /> Record Collect
          </Link>
          <Link
            href="/cash-management"
            className="inline-flex items-center bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all active-press"
          >
            <DollarSign size={15} className="mr-1.5" /> Cash Desk
          </Link>
        </div>
      </div>

      {/* Mobile Native Quick Actions Grid (4 App Tiles) */}
      <div className="grid grid-cols-4 gap-2 sm:hidden">
        <Link
          href="/collections/new"
          className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center text-center active-press"
        >
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5 shadow-xs">
            <CreditCard size={20} />
          </div>
          <span className="text-[11px] font-bold text-slate-800 leading-tight">Collect</span>
        </Link>

        <Link
          href="/loans/new"
          className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center text-center active-press"
        >
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1.5 shadow-xs">
            <PlusCircle size={20} />
          </div>
          <span className="text-[11px] font-bold text-slate-800 leading-tight">New Loan</span>
        </Link>

        <Link
          href="/customers/new"
          className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center text-center active-press"
        >
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-1.5 shadow-xs">
            <UserCheck size={20} />
          </div>
          <span className="text-[11px] font-bold text-slate-800 leading-tight">New KYC</span>
        </Link>

        <Link
          href="/approvals"
          className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center text-center active-press relative"
        >
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-1.5 shadow-xs relative">
            <Clock size={20} />
            {metrics.pendingApprovalsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-black flex items-center justify-center">
                {metrics.pendingApprovalsCount}
              </span>
            )}
          </div>
          <span className="text-[11px] font-bold text-slate-800 leading-tight">Approvals</span>
        </Link>
      </div>

      {/* Metric Cards Grid (2x2 on Mobile, 4-col on Desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <MetricCard
          title="Cycle Demand"
          amount={`₹${metrics.totalDemand.toLocaleString()}`}
          subtext={`${metrics.activeLoansCount} accounts`}
          icon={<Wallet size={18} className="text-blue-600" />}
          badgeColor="bg-blue-50 text-blue-700"
        />
        <MetricCard
          title="Collections"
          amount={`₹${metrics.totalCollection.toLocaleString()}`}
          subtext={`${metrics.collectionPercent}% efficiency`}
          icon={<TrendingUp size={18} className="text-emerald-600" />}
          badgeColor="bg-emerald-50 text-emerald-700"
        />
        <MetricCard
          title="Approvals"
          amount={metrics.pendingApprovalsCount.toString()}
          subtext="Pending review"
          icon={<Clock size={18} className="text-amber-600" />}
          badgeColor="bg-amber-50 text-amber-700"
        />
        <MetricCard
          title="Arrears"
          amount={`₹${metrics.totalArrears.toLocaleString()}`}
          subtext="Overdue sum"
          icon={<AlertTriangle size={18} className="text-rose-600" />}
          badgeColor="bg-rose-50 text-rose-700"
        />
      </div>

      {/* Cash vs Digital Ratio Banner */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[11px] md:text-xs font-bold text-slate-800 uppercase tracking-wider">
            Daily Collection Mode (Cash vs Digital)
          </span>
          <span className="text-xs font-mono font-bold text-slate-600">
            Total: ₹{metrics.totalCollection.toLocaleString()}
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3 flex overflow-hidden">
          <div
            className="bg-emerald-500 h-full transition-all duration-500"
            style={{
              width: `${metrics.totalCollection > 0 ? (metrics.cashCollections / metrics.totalCollection) * 100 : 50}%`
            }}
            title={`Cash: ₹${metrics.cashCollections}`}
          />
          <div
            className="bg-purple-600 h-full transition-all duration-500"
            style={{
              width: `${metrics.totalCollection > 0 ? (metrics.digitalCollections / metrics.totalCollection) * 100 : 50}%`
            }}
            title={`Digital: ₹${metrics.digitalCollections}`}
          />
        </div>
        <div className="flex justify-between items-center text-xs mt-2.5 text-slate-600">
          <span className="flex items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1.5" />
            Cash Denominations: <strong className="ml-1 text-slate-800">₹{metrics.cashCollections.toLocaleString()}</strong>
          </span>
          <span className="flex items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-600 mr-1.5" />
            Digital / UPI / UTR: <strong className="ml-1 text-slate-800">₹{metrics.digitalCollections.toLocaleString()}</strong>
          </span>
        </div>
      </div>

      {/* Maker-Checker Queues Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Collections */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div className="flex items-center space-x-2">
              <ShieldCheck size={18} className="text-indigo-600" />
              <h3 className="font-bold text-slate-800 text-sm">Pending Collection Vouchers</h3>
            </div>
            <Link href="/approvals" className="text-xs text-indigo-600 font-bold hover:underline flex items-center">
              All ({pendingCollections?.length || 0}) <ArrowRight size={13} className="ml-1" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {pendingCollections?.map((col: any) => (
              <div key={col.id} className="p-4 hover:bg-slate-50 flex items-center justify-between transition-colors">
                <div>
                  <p className="font-bold text-slate-800">{col.customers?.full_name}</p>
                  <p className="text-[11px] font-mono text-slate-500">
                    {col.customers?.client_id} • Loan: {col.loans?.loan_id}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-black text-slate-900 text-sm block">₹{col.amount.toLocaleString()}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    col.payment_mode === 'Cash' ? 'bg-emerald-50 text-emerald-700' : 'bg-purple-50 text-purple-700'
                  }`}>
                    {col.payment_mode}
                  </span>
                </div>
              </div>
            ))}
            {!pendingCollections?.length && (
              <div className="p-8 text-center text-slate-400">No pending collection vouchers requiring approval.</div>
            )}
          </div>
        </div>

        {/* Pending Disbursements */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div className="flex items-center space-x-2">
              <UserCheck size={18} className="text-indigo-600" />
              <h3 className="font-bold text-slate-800 text-sm">Pending Loan Disbursements</h3>
            </div>
            <Link href="/approvals" className="text-xs text-indigo-600 font-bold hover:underline flex items-center">
              All ({pendingDisbursements?.length || 0}) <ArrowRight size={13} className="ml-1" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {pendingDisbursements?.map((loan: any) => (
              <div key={loan.id} className="p-4 hover:bg-slate-50 flex items-center justify-between transition-colors">
                <div>
                  <p className="font-bold text-slate-800">{loan.customers?.full_name}</p>
                  <p className="text-[11px] font-mono text-indigo-700 font-semibold">
                    {loan.loan_id} (Cycle {loan.cycle_number}) • {loan.loan_products?.name || 'Loan'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-black text-slate-900 text-sm block">₹{loan.principal_amount.toLocaleString()}</span>
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    {loan.tenure_weeks ? `${loan.tenure_weeks} Wks` : 'N/A'} • EWI: ₹{loan.emi_amount || 'N/A'}
                  </span>
                </div>
              </div>
            ))}
            {!pendingDisbursements?.length && (
              <div className="p-8 text-center text-slate-400">No pending loan disbursements requiring approval.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  title,
  amount,
  subtext,
  icon,
  badgeColor
}: {
  title: string
  amount: string
  subtext: string
  icon: React.ReactNode
  badgeColor: string
}) {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
        <div className={`p-2 rounded-lg ${badgeColor}`}>{icon}</div>
      </div>
      <div className="mt-3">
        <span className="text-2xl font-black text-slate-800 tracking-tight">{amount}</span>
        <p className="text-[11px] text-slate-400 mt-0.5">{subtext}</p>
      </div>
    </div>
  )
}
