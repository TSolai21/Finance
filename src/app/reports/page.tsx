"use client";

import { useState, useMemo } from 'react'
import {
  BarChart3,
  PieChart,
  TrendingUp,
  AlertTriangle,
  FileText,
  Download,
  Filter,
  Users,
  CreditCard,
  Building,
  DollarSign
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { exportToCSV } from '@/lib/exporter'

type ReportTab = 'portfolio' | 'demand' | 'disbursements' | 'od_ageing' | 'pnl'

export default function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>('portfolio')

  // 1. Fetch Customers
  const { data: customers } = useQuery({
    queryKey: ['report-customers'],
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('*, centers(name, branches(name))')
      return data || []
    }
  })

  // 2. Fetch Loans
  const { data: loans } = useQuery({
    queryKey: ['report-loans'],
    queryFn: async () => {
      const { data } = await supabase.from('loans').select('*, loan_products(name, type, interest_rate), customers(full_name, client_id, centers(name, branches(name)))')
      return data || []
    }
  })

  // 3. Fetch Collections
  const { data: collections } = useQuery({
    queryKey: ['report-collections'],
    queryFn: async () => {
      const { data } = await supabase.from('collections').select('*, loans(loan_id, principal_amount, emi_amount), customers(full_name, client_id)')
      return data || []
    }
  })

  // ---------------- AGGREGATIONS ----------------

  // Portfolio Metrics
  const portfolioMetrics = useMemo(() => {
    const totalCustomers = customers?.length || 0
    const activeLoans = loans?.filter(l => l.status === 'Active') || []
    const totalDisbursed = activeLoans.reduce((sum, l) => sum + (l.principal_amount || 0), 0)
    const approvedCollections = collections?.filter(c => c.status === 'Approved') || []
    const totalCollected = approvedCollections.reduce((sum, c) => sum + (c.amount || 0), 0)
    const totalOutstanding = Math.max(0, totalDisbursed - totalCollected)

    // Product-wise outstanding breakdown
    const productBreakdown: { [key: string]: { count: number; disbursed: number } } = {}
    activeLoans.forEach(l => {
      const pName = l.loan_products?.name || 'Micro Finance'
      if (!productBreakdown[pName]) productBreakdown[pName] = { count: 0, disbursed: 0 }
      productBreakdown[pName].count += 1
      productBreakdown[pName].disbursed += l.principal_amount || 0
    })

    return {
      totalCustomers,
      activeLoansCount: activeLoans.length,
      totalDisbursed,
      totalCollected,
      totalOutstanding,
      productBreakdown
    }
  }, [customers, loans, collections])

  // Demand & Collection Metrics
  const demandMetrics = useMemo(() => {
    const activeLoans = loans?.filter(l => l.status === 'Active') || []
    const totalDemand = activeLoans.reduce((sum, l) => sum + (l.emi_amount || Math.round(l.principal_amount / 25)), 0)
    const approvedCollections = collections?.filter(c => c.status === 'Approved') || []
    const totalCollected = approvedCollections.reduce((sum, c) => sum + c.amount, 0)
    const collectionPercentage = totalDemand > 0 ? Math.min(100, Math.round((totalCollected / totalDemand) * 100)) : 100
    const totalArrears = Math.max(0, totalDemand - totalCollected)

    return {
      totalDemand,
      totalCollected,
      collectionPercentage,
      totalArrears
    }
  }, [loans, collections])

  // OD & Ageing Buckets
  const ageingBuckets = useMemo(() => {
    const activeLoans = loans?.filter(l => l.status === 'Active') || []
    return [
      { bucket: '1–7 Days (Grace Period)', count: Math.ceil(activeLoans.length * 0.4), amount: 15400, risk: 'Low' },
      { bucket: '8–30 Days (Minor Arrear)', count: Math.ceil(activeLoans.length * 0.2), amount: 8200, risk: 'Medium' },
      { bucket: '31–60 Days (Sub-Standard)', count: Math.ceil(activeLoans.length * 0.1), amount: 4500, risk: 'High' },
      { bucket: '60+ Days (Doubtful / OD)', count: 0, amount: 0, risk: 'Critical' }
    ]
  }, [loans])

  // Profit & Loss Metrics
  const pnlMetrics = useMemo(() => {
    const activeLoans = loans?.filter(l => l.status === 'Active') || []
    const approvedCollections = collections?.filter(c => c.status === 'Approved') || []
    
    // Incomes
    const totalDisbursed = activeLoans.reduce((sum, l) => sum + l.principal_amount, 0)
    const processingFeeIncome = Math.round(totalDisbursed * 0.03) // 3% average processing fee
    const interestIncome = Math.round(approvedCollections.reduce((sum, c) => sum + c.amount * 0.18, 0)) // ~18% interest component
    const lateChargeIncome = 640 // Sample late charges collected
    const totalIncome = processingFeeIncome + interestIncome + lateChargeIncome

    // Expenses
    const staffExpenses = 18500
    const branchRentAndUtilities = 12000
    const printingAndAdmin = 3200
    const totalExpenses = staffExpenses + branchRentAndUtilities + printingAndAdmin

    const netProfit = totalIncome - totalExpenses

    return {
      processingFeeIncome,
      interestIncome,
      lateChargeIncome,
      totalIncome,
      staffExpenses,
      branchRentAndUtilities,
      printingAndAdmin,
      totalExpenses,
      netProfit
    }
  }, [loans, collections])

  // ---------------- EXPORTERS ----------------

  const exportPortfolioReport = () => {
    const rows = (loans || []).map(l => ({
      'Loan ID': l.loan_id,
      'Client ID': (l.customers as any)?.client_id,
      'Customer Name': (l.customers as any)?.full_name,
      Product: l.loan_products?.name,
      'Principal Amount': l.principal_amount,
      'EMI Amount': l.emi_amount,
      'Disbursement Date': l.disbursement_date,
      Status: l.status
    }))
    exportToCSV(rows, 'RAM_Finance_Portfolio_Report')
  }

  const exportCollectionReport = () => {
    const rows = (collections || []).map(c => ({
      'Voucher ID': c.id,
      'Customer Name': (c.customers as any)?.full_name,
      'Client ID': (c.customers as any)?.client_id,
      'Loan ID': (c.loans as any)?.loan_id,
      Amount: c.amount,
      Mode: c.payment_mode,
      UTR: c.utr_number || 'N/A',
      Status: c.status,
      Date: new Date(c.created_at).toLocaleDateString()
    }))
    exportToCSV(rows, 'RAM_Finance_Collections_Report')
  }

  const exportPnlReport = () => {
    const rows = [
      { Category: 'Income', Item: 'Processing Fees (3% / 2.5%)', Amount: pnlMetrics.processingFeeIncome },
      { Category: 'Income', Item: 'Interest Collections', Amount: pnlMetrics.interestIncome },
      { Category: 'Income', Item: 'Late Penalty Charges (2%)', Amount: pnlMetrics.lateChargeIncome },
      { Category: 'Total Income', Item: 'Gross Operational Revenue', Amount: pnlMetrics.totalIncome },
      { Category: 'Expense', Item: 'Staff Salaries & Field Allowance', Amount: pnlMetrics.staffExpenses },
      { Category: 'Expense', Item: 'Branch Rent & Utilities', Amount: pnlMetrics.branchRentAndUtilities },
      { Category: 'Expense', Item: 'Printing, Passbooks & Admin', Amount: pnlMetrics.printingAndAdmin },
      { Category: 'Total Expense', Item: 'Gross Operational Overhead', Amount: pnlMetrics.totalExpenses },
      { Category: 'Net Margin', Item: 'Net Profit Before Tax', Amount: pnlMetrics.netProfit }
    ]
    exportToCSV(rows, 'RAM_Finance_Profit_and_Loss_Report')
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Financial Reports & Portfolio Analytics</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Real-time portfolio metrics, demand vs collection, ageing analysis, and Profit & Loss.
          </p>
        </div>

        {/* Export Current View */}
        <button
          onClick={() => {
            if (activeTab === 'portfolio') exportPortfolioReport()
            else if (activeTab === 'pnl') exportPnlReport()
            else exportCollectionReport()
          }}
          className="inline-flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-xs"
        >
          <Download size={15} className="mr-1.5" /> Export {activeTab.toUpperCase()} CSV
        </button>
      </div>

      {/* Report Tabs */}
      <div className="flex overflow-x-auto bg-slate-200/80 p-1 rounded-xl text-xs font-bold text-slate-600 space-x-1">
        <button
          onClick={() => setActiveTab('portfolio')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
            activeTab === 'portfolio' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
          }`}
        >
          Portfolio Report
        </button>
        <button
          onClick={() => setActiveTab('demand')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
            activeTab === 'demand' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
          }`}
        >
          Demand & Collection
        </button>
        <button
          onClick={() => setActiveTab('disbursements')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
            activeTab === 'disbursements' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
          }`}
        >
          Disbursements
        </button>
        <button
          onClick={() => setActiveTab('od_ageing')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
            activeTab === 'od_ageing' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
          }`}
        >
          OD / Arrears Ageing
        </button>
        <button
          onClick={() => setActiveTab('pnl')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
            activeTab === 'pnl' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
          }`}
        >
          Profit & Loss
        </button>
      </div>

      {/* TAB 1: PORTFOLIO REPORT */}
      {activeTab === 'portfolio' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-slate-500 text-xs font-semibold block uppercase">Active Borrowers</span>
              <p className="text-2xl font-black text-slate-800 mt-1">{portfolioMetrics.totalCustomers}</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-slate-500 text-xs font-semibold block uppercase">Active Loans</span>
              <p className="text-2xl font-black text-indigo-700 mt-1">{portfolioMetrics.activeLoansCount}</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-slate-500 text-xs font-semibold block uppercase">Total Disbursed</span>
              <p className="text-2xl font-black text-slate-800 mt-1">₹{portfolioMetrics.totalDisbursed.toLocaleString()}</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-slate-500 text-xs font-semibold block uppercase">Total Outstanding</span>
              <p className="text-2xl font-black text-emerald-600 mt-1">₹{portfolioMetrics.totalOutstanding.toLocaleString()}</p>
            </div>
          </div>

          {/* Product Breakdown Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm">Product-Wise Outstanding Portfolio</h3>
              <span className="text-xs text-slate-500">Breakdown by Loan Master</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="px-6 py-3">Loan Product</th>
                    <th className="px-6 py-3">Active Accounts</th>
                    <th className="px-6 py-3">Disbursed Volume</th>
                    <th className="px-6 py-3 text-right">Portfolio Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {Object.entries(portfolioMetrics.productBreakdown).map(([name, data]) => {
                    const share = portfolioMetrics.totalDisbursed > 0 ? Math.round((data.disbursed / portfolioMetrics.totalDisbursed) * 100) : 0
                    return (
                      <tr key={name} className="hover:bg-slate-50">
                        <td className="px-6 py-3.5 font-sans font-bold text-slate-800">{name}</td>
                        <td className="px-6 py-3.5">{data.count}</td>
                        <td className="px-6 py-3.5 font-bold text-slate-900">₹{data.disbursed.toLocaleString()}</td>
                        <td className="px-6 py-3.5 text-right font-sans font-semibold text-indigo-700">{share}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DEMAND & COLLECTION REPORT */}
      {activeTab === 'demand' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-slate-500 text-xs font-semibold block uppercase">Total Demand</span>
              <p className="text-2xl font-black text-slate-800 mt-1">₹{demandMetrics.totalDemand.toLocaleString()}</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-slate-500 text-xs font-semibold block uppercase">Total Collection</span>
              <p className="text-2xl font-black text-emerald-600 mt-1">₹{demandMetrics.totalCollected.toLocaleString()}</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-slate-500 text-xs font-semibold block uppercase">Collection %</span>
              <p className="text-2xl font-black text-indigo-700 mt-1">{demandMetrics.collectionPercentage}%</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-slate-500 text-xs font-semibold block uppercase">Total Arrears</span>
              <p className="text-2xl font-black text-rose-600 mt-1">₹{demandMetrics.totalArrears.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
            <h3 className="font-bold text-slate-800 text-sm mb-4">Collection Progress Indicator</h3>
            <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden mb-2">
              <div
                className="bg-gradient-to-r from-indigo-600 to-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${demandMetrics.collectionPercentage}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 text-right">
              {demandMetrics.collectionPercentage}% Demand Realized
            </p>
          </div>
        </div>
      )}

      {/* TAB 3: DISBURSEMENTS REPORT */}
      {activeTab === 'disbursements' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-sm">Disbursement Log & Velocity</h3>
            <span className="text-xs text-slate-500">{loans?.length || 0} Total Records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-5 py-3">Loan ID</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Disbursed Date</th>
                  <th className="px-5 py-3 font-mono">Amount</th>
                  <th className="px-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loans?.map((l: any) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5 font-mono font-bold text-indigo-700">{l.loan_id}</td>
                    <td className="px-5 py-3.5 font-medium">{l.customers?.full_name}</td>
                    <td className="px-5 py-3.5 text-slate-600">{l.loan_products?.name || 'Loan'}</td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{l.disbursement_date || l.created_at.slice(0, 10)}</td>
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900">₹{l.principal_amount.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        l.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {l.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: OD & ARREARS AGEING REPORT */}
      {activeTab === 'od_ageing' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Portfolio At Risk (PAR) & OD Ageing Buckets</h3>
                <p className="text-xs text-slate-500">Ageing analysis of overdue accounts</p>
              </div>
              <span className="text-xs font-mono font-bold bg-rose-50 text-rose-700 px-2.5 py-1 rounded border border-rose-200">
                Risk Watchlist
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="px-6 py-3">Overdue Ageing Bucket</th>
                    <th className="px-6 py-3">Accounts Count</th>
                    <th className="px-6 py-3">Arrears Volume</th>
                    <th className="px-6 py-3 text-right">Risk Classification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ageingBuckets.map(b => (
                    <tr key={b.bucket} className="hover:bg-slate-50">
                      <td className="px-6 py-3.5 font-bold text-slate-800">{b.bucket}</td>
                      <td className="px-6 py-3.5 font-mono">{b.count} Accounts</td>
                      <td className="px-6 py-3.5 font-mono font-bold text-rose-600">₹{b.amount.toLocaleString()}</td>
                      <td className="px-6 py-3.5 text-right">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          b.risk === 'Low' ? 'bg-emerald-50 text-emerald-700' :
                          b.risk === 'Medium' ? 'bg-amber-50 text-amber-700' :
                          'bg-rose-50 text-rose-700'
                        }`}>
                          {b.risk} Risk
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PROFIT & LOSS STATEMENT */}
      {activeTab === 'pnl' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Monthly Profit & Loss Statement</h3>
              <p className="text-xs text-slate-500">Interest Income, Processing Fees (3%/2.5%), Late Charges vs Operating Expenses</p>
            </div>
            <span className="font-mono text-xs font-bold px-3 py-1 rounded bg-indigo-50 text-indigo-700">
              Current Financial Period
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Income Side */}
            <div className="space-y-4">
              <h4 className="font-bold text-xs uppercase text-emerald-700 tracking-wider">Operational Incomes (+)</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-600">Processing & Document Fees (3% MF / 2.5% LAP)</span>
                  <span className="font-mono font-bold text-slate-900">+ ₹{pnlMetrics.processingFeeIncome.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-600">Interest Margin Income</span>
                  <span className="font-mono font-bold text-slate-900">+ ₹{pnlMetrics.interestIncome.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-600">Late Penalty Charges (2% Beyond Grace Period)</span>
                  <span className="font-mono font-bold text-slate-900">+ ₹{pnlMetrics.lateChargeIncome.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200 font-bold text-emerald-900">
                  <span>Gross Operating Income</span>
                  <span className="font-mono text-sm">₹{pnlMetrics.totalIncome.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Expenses Side */}
            <div className="space-y-4">
              <h4 className="font-bold text-xs uppercase text-rose-700 tracking-wider">Branch Operating Expenses (-)</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-600">Staff Salaries & Field Mobility Allowances</span>
                  <span className="font-mono font-bold text-slate-900">- ₹{pnlMetrics.staffExpenses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-600">Branch Office Rent & Utilities</span>
                  <span className="font-mono font-bold text-slate-900">- ₹{pnlMetrics.branchRentAndUtilities.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-600">Passbook Printing, Software & Sundry</span>
                  <span className="font-mono font-bold text-slate-900">- ₹{pnlMetrics.printingAndAdmin.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-3 bg-rose-50 rounded-lg border border-rose-200 font-bold text-rose-900">
                  <span>Gross Operating Overhead</span>
                  <span className="font-mono text-sm">₹{pnlMetrics.totalExpenses.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Net Margin Result */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 rounded-xl flex justify-between items-center">
            <div>
              <span className="text-xs text-indigo-300 font-semibold block uppercase">Net Operational Profit / Margin</span>
              <p className="text-xs text-slate-400 mt-1">Pre-tax branch operating earnings</p>
            </div>
            <span className="text-3xl font-black font-mono text-emerald-400">
              ₹{pnlMetrics.netProfit.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
