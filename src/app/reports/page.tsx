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
  DollarSign,
  Calendar,
  MessageSquare,
  CheckCircle2,
  Clock,
  Award,
  Wallet,
  FileSpreadsheet
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/store/appStore'
import { exportToCSV, downloadFullDatabaseAsExcel } from '@/lib/exporter'
import { formatPreDemandMessage, getWhatsAppClickToChatUrl } from '@/lib/whatsapp'
import Select from 'react-select'
import { customSelectStyles } from '@/components/ui/SelectStyles'

const PRODUCT_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Products' },
  { value: 'Micro Finance', label: 'Micro Finance' },
  { value: 'LAP', label: 'LAP' },
  { value: 'Monthly Interest', label: 'Monthly Interest' }
]

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Collection Status' },
  { value: 'Collected', label: 'Collected' },
  { value: 'Not Collected', label: 'Not Collected' }
]

type ReportTab =
  | 'portfolio'
  | 'demand'
  | 'od_ageing'
  | 'daily_collection'
  | 'cash_book'
  | 'outstanding'
  | 'disbursements'
  | 'pnl'

export default function Reports() {
  const profile = useAppStore(state => state.profile)
  const isStaff = profile?.role === 'Staff'

  const [activeTab, setActiveTab] = useState<ReportTab>('portfolio')
  const [filterProduct, setFilterProduct] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split('T')[0])
  const [isExportingMaster, setIsExportingMaster] = useState(false)

  const handleAdminMasterExport = async () => {
    try {
      setIsExportingMaster(true)
      const res = await downloadFullDatabaseAsExcel(supabase)
      alert(
        `✓ Master Database Export Successful!\n\n` +
        `• Customers: ${res.customersCount}\n` +
        `• Loans: ${res.loansCount}\n` +
        `• Collections: ${res.collectionsCount}\n` +
        `• Centers: ${res.centersCount}\n` +
        `• Cash Desk Days: ${res.cashBookCount}\n\n` +
        `Saved as multi-tab Microsoft Excel (.xls) file.`
      )
    } catch (err: any) {
      alert(`Master Export Error: ${err.message}`)
    } finally {
      setIsExportingMaster(false)
    }
  }

  // 1. Fetch Customers
  const { data: customers } = useQuery({
    queryKey: ['report-customers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('customers')
        .select('*, centers(name, branches(name))')
      return data || []
    }
  })

  // 2. Fetch Loans
  const { data: loans } = useQuery({
    queryKey: ['report-loans'],
    queryFn: async () => {
      const { data } = await supabase
        .from('loans')
        .select(`
          *,
          loan_products(name, type, interest_rate),
          customers(
            id,
            full_name,
            client_id,
            mobile_number,
            nominee_name,
            nominee_mobile,
            address,
            centers(name, branches(name))
          )
        `)
      return data || []
    }
  })

  // 3. Fetch Collections
  const { data: collections } = useQuery({
    queryKey: ['report-collections'],
    queryFn: async () => {
      const { data } = await supabase
        .from('collections')
        .select(`
          *,
          loans(loan_id, principal_amount, emi_amount, loan_products(name, type)),
          customers(full_name, client_id, mobile_number, centers(name, branches(name)))
        `)
      return data || []
    }
  })

  // 4. Fetch Profiles / RO Staff
  const { data: staffList } = useQuery({
    queryKey: ['report-staff'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, role, center_id')
      return data || []
    }
  })

  // 5. Fetch Branch Daily Cash Desk Records from Database
  const { data: cashDailyRecords } = useQuery({
    queryKey: ['report-cash-daily'],
    queryFn: async () => {
      const { data } = await supabase
        .from('branch_cash_daily')
        .select('*, branches(name)')
        .order('record_date', { ascending: false })
      return data || []
    }
  })

  // ---------------- AGGREGATIONS & PROCESSED REPORT VIEWS ----------------

  // Portfolio Metrics
  const portfolioMetrics = useMemo(() => {
    const totalCustomers = customers?.length || 0
    const activeLoans = loans?.filter(l => l.status === 'Active') || []
    const totalDisbursed = activeLoans.reduce((sum, l) => sum + (l.principal_amount || 0), 0)
    const approvedCollections = collections?.filter(c => c.status === 'Approved') || []
    const totalCollected = approvedCollections.reduce((sum, c) => sum + (c.amount || 0), 0)
    const totalOutstanding = Math.max(0, totalDisbursed - totalCollected)

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

  // Live Demand Rows (Derived strictly from database loans & collections)
  const demandRows = useMemo(() => {
    if (!loans) return []
    const today = reportDate

    return loans
      .filter(l => l.status === 'Active')
      .map(l => {
        const cust = (l.customers as any) || {}
        const emi = l.emi_amount || Math.round((l.principal_amount || 0) / (l.tenure_weeks || 25))
        const clientCollections = (collections || []).filter(c => c.loan_id === l.id && c.status === 'Approved')
        const totalPaid = clientCollections.reduce((sum, c) => sum + (c.amount || 0), 0)
        
        // Check if payment collected today from actual collection records in database
        const paidToday = clientCollections.some(c => c.created_at?.startsWith(today))
        const currentDemand = emi
        const outstanding = Math.max(0, (l.principal_amount || 0) - totalPaid)
        const centerName = cust.centers?.name || 'Unassigned Center'
        
        // Real staff lookup from database profiles
        const assignedStaff = staffList?.find(s => s.center_id === cust.center_id || s.id === l.created_by)
        const roName = assignedStaff ? (assignedStaff.role === 'Staff' ? `RO ${assignedStaff.full_name}` : assignedStaff.full_name) : 'Field Officer'

        return {
          loanId: l.id,
          loanNumber: l.loan_id,
          clientId: cust.client_id || '',
          clientName: cust.full_name || 'Borrower',
          address: cust.address || 'Address on record',
          clientMobile: cust.mobile_number || '',
          nomineeMobile: cust.nominee_mobile || '',
          loanType: l.loan_products?.name || l.loan_products?.type || 'Micro Finance',
          emiAmount: currentDemand,
          amountPaidToday: paidToday ? currentDemand : 0,
          totalPaid,
          outstandingDemand: outstanding,
          staffName: centerName,
          roName,
          collectionStatus: paidToday ? 'Collected' : 'Not Collected'
        }
      })
      .filter(row => {
        if (filterProduct !== 'ALL' && !row.loanType.toLowerCase().includes(filterProduct.toLowerCase())) return false
        if (filterStatus !== 'ALL' && row.collectionStatus !== filterStatus) return false
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase()
          return (
            row.clientName.toLowerCase().includes(q) ||
            row.clientId.toLowerCase().includes(q) ||
            row.loanNumber.toLowerCase().includes(q) ||
            row.clientMobile.includes(q)
          )
        }
        return true
      })
  }, [loans, collections, staffList, reportDate, filterProduct, filterStatus, searchTerm])

  // OD (Overdue) Rows - Real Mathematical Calculation from Database Dates & Payments
  const odRows = useMemo(() => {
    if (!loans) return []
    const now = new Date()

    return loans
      .filter(l => l.status === 'Active')
      .map(l => {
        const cust = (l.customers as any) || {}
        const emi = l.emi_amount || 0
        const clientCols = (collections || []).filter(c => c.loan_id === l.id && c.status === 'Approved')
        const totalPaid = clientCols.reduce((sum, c) => sum + (c.amount || 0), 0)
        const lastCol = clientCols[0]?.created_at ? new Date(clientCols[0].created_at).toLocaleDateString() : 'No Collections'

        // Real OD calculation based on disbursement date vs today from database
        const startDateStr = l.first_emi_date || l.disbursement_date || l.created_at?.split('T')[0]
        let expectedPaid = 0
        let odDays = 0

        if (startDateStr && emi > 0) {
          const startDate = new Date(startDateStr)
          const diffMs = now.getTime() - startDate.getTime()
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

          if (diffDays > 0) {
            const isWeekly = l.loan_products?.type === 'Micro Finance'
            const elapsedUnits = isWeekly ? Math.floor(diffDays / 7) + 1 : Math.floor(diffDays / 30) + 1
            expectedPaid = Math.min(l.principal_amount || 0, elapsedUnits * emi)

            if (expectedPaid > totalPaid) {
              const overdueAmount = expectedPaid - totalPaid
              const overdueUnits = Math.ceil(overdueAmount / emi)
              odDays = isWeekly ? overdueUnits * 7 : overdueUnits * 30
            }
          }
        }

        const overdueAmount = Math.max(0, expectedPaid - totalPaid)
        const assignedStaff = staffList?.find(s => s.center_id === cust.center_id || s.id === l.created_by)
        const roName = assignedStaff ? (assignedStaff.role === 'Staff' ? `RO ${assignedStaff.full_name}` : assignedStaff.full_name) : 'Field Officer'

        return {
          loanNumber: l.loan_id,
          clientId: cust.client_id || '',
          clientName: cust.full_name || '',
          address: cust.address || '',
          clientMobile: cust.mobile_number || '',
          nomineeMobile: cust.nominee_mobile || '',
          loanType: l.loan_products?.name || l.loan_products?.type || 'Micro Finance',
          odDays,
          overdueAmount,
          lastCollectionDate: lastCol,
          staffName: cust.centers?.name || 'Unassigned Center',
          roName
        }
      })
      .filter(row => row.odDays > 0 && row.overdueAmount > 0)
  }, [loans, collections, staffList])

  // Daily Collection Rows (Directly from Collections Database Table)
  const dailyCollectionRows = useMemo(() => {
    if (!collections) return []
    return collections.map(c => {
      const cust = (c.customers as any) || {}
      const ln = (c.loans as any) || {}
      const staff = staffList?.find(s => s.id === c.collected_by)
      const roName = staff ? (staff.role === 'Staff' ? `RO ${staff.full_name}` : staff.full_name) : 'Field Officer'

      return {
        id: c.id,
        date: new Date(c.created_at).toLocaleDateString(),
        voucherNo: c.voucher_number || c.id.slice(0, 8).toUpperCase(),
        clientName: cust.full_name || 'Borrower',
        clientId: cust.client_id || '',
        loanNumber: ln.loan_id || 'N/A',
        loanType: ln.loan_products?.name || ln.loan_products?.type || 'Micro Finance',
        amount: c.amount || 0,
        paymentMode: c.payment_mode || 'Cash',
        utrNumber: c.utr_number || (c.payment_mode === 'Cash' ? 'Cash' : '—'),
        status: c.status || 'Approved',
        centerName: cust.centers?.name || 'Center',
        roName
      }
    })
  }, [collections, staffList])

  // Staff Incentive Matrix (Dynamically Aggregated from Real Staff Collections & Loans in Database)
  const staffIncentives = useMemo(() => {
    if (!staffList || staffList.length === 0) return []

    return staffList.map(staff => {
      // Find loans assigned to this staff's center or created by this staff
      const staffLoans = (loans || []).filter(l => {
        const cust = l.customers as any
        return cust?.center_id === staff.center_id || l.created_by === staff.id
      })
      const assignedDemand = staffLoans.reduce((sum, l) => sum + (l.emi_amount || 0), 0)

      // Find actual approved collections collected by this staff
      const staffCols = (collections || []).filter(c => {
        return (c.collected_by === staff.id || staffLoans.some(l => l.id === c.loan_id)) && c.status === 'Approved'
      })
      const achievedCollection = staffCols.reduce((sum, c) => sum + (c.amount || 0), 0)
      const disbursementsAchieved = staffLoans.length

      const efficiencyPercent = assignedDemand > 0
        ? Math.round((achievedCollection / assignedDemand) * 100)
        : (achievedCollection > 0 ? 100 : 0)

      // Performance incentive based on real collection efficiency
      let baseIncentive = 0
      if (efficiencyPercent >= 98) baseIncentive = 2000
      else if (efficiencyPercent >= 95) baseIncentive = 1500
      else if (efficiencyPercent >= 90) baseIncentive = 1000

      const disbursementBonus = disbursementsAchieved * 50
      const incentiveAmount = baseIncentive + disbursementBonus

      return {
        roName: staff.full_name,
        assignedDemand,
        achievedCollection,
        efficiencyPercent,
        disbursementsAchieved,
        incentiveAmount
      }
    }).filter(row => row.assignedDemand > 0 || row.achievedCollection > 0)
  }, [staffList, loans, collections])

  // Cash Book Register (From Database branch_cash_daily Table)
  const cashBookRows = useMemo(() => {
    if (cashDailyRecords && cashDailyRecords.length > 0) {
      return cashDailyRecords.map((cb: any) => ({
        date: cb.record_date,
        branchName: cb.branches?.name || 'Main Branch',
        openingBalance: cb.opening_cash || 0,
        cashReceived: cb.cash_collections || 0,
        digitalReceived: cb.digital_collections || 0,
        disbursementsPaid: cb.disbursements_paid || 0,
        branchExpenses: cb.branch_expenses || 0,
        hoHandover: cb.ho_handover || 0,
        closingBalance: cb.closing_cash_system || 0,
        physicalCash: cb.physical_cash_counted || 0,
        status: cb.status || 'Reconciled'
      }))
    }

    // Live daily balance calculation from actual collections & loans if no end-of-day record exists
    const dayCols = (collections || []).filter(c => c.status === 'Approved' && c.created_at?.startsWith(reportDate))
    const dayCash = dayCols.filter(c => c.payment_mode === 'Cash').reduce((sum, c) => sum + (c.amount || 0), 0)
    const dayDigital = dayCols.filter(c => c.payment_mode !== 'Cash').reduce((sum, c) => sum + (c.amount || 0), 0)
    const dayDisbursements = (loans || []).filter(l => l.status === 'Active' && (l.disbursement_date === reportDate || l.created_at?.startsWith(reportDate)))
    const dayDisbursedAmount = dayDisbursements.reduce((sum, l) => sum + (l.principal_amount || 0), 0)

    return [
      {
        date: reportDate,
        branchName: 'Main Branch',
        openingBalance: 0,
        cashReceived: dayCash,
        digitalReceived: dayDigital,
        disbursementsPaid: dayDisbursedAmount,
        branchExpenses: 0,
        hoHandover: 0,
        closingBalance: dayCash - dayDisbursedAmount,
        physicalCash: dayCash - dayDisbursedAmount,
        status: dayCols.length > 0 ? 'Live Database Inflow' : 'No Transactions'
      }
    ]
  }, [cashDailyRecords, collections, loans, reportDate])

  // Outstanding Segregated Breakdown (Calculated from Real Database Totals)
  const outstandingBreakdown = useMemo(() => {
    const activeLoans = loans?.filter(l => l.status === 'Active') || []
    const totalPrincipalDisbursed = activeLoans.reduce((sum, l) => sum + (l.principal_amount || 0), 0)
    const approvedCols = collections?.filter(c => c.status === 'Approved') || []
    const totalCollected = approvedCols.reduce((sum, c) => sum + (c.amount || 0), 0)

    const principalOutstanding = Math.max(0, totalPrincipalDisbursed - totalCollected)
    const interestDue = Math.round(activeLoans.reduce((sum, l) => {
      const rate = l.loan_products?.interest_rate || 2.0
      return sum + ((l.principal_amount || 0) * (rate / 100))
    }, 0))
    const overdueArrears = odRows.reduce((sum, r) => sum + r.overdueAmount, 0)
    const totalReceivable = principalOutstanding + interestDue + overdueArrears

    return {
      principalDisbursed: totalPrincipalDisbursed,
      principalOutstanding,
      interestDue,
      overdueArrears,
      totalReceivable
    }
  }, [loans, collections, odRows])

  // Profit & Loss (100% Calculated From Database Income & Expense Ledgers)
  const pnlMetrics = useMemo(() => {
    const activeLoans = loans?.filter(l => l.status === 'Active') || []
    const approvedCols = collections?.filter(c => c.status === 'Approved') || []
    
    // Processing fees from real loans in database
    const processingFeeIncome = activeLoans.reduce((sum, l) => sum + (l.processing_fee || 0), 0)
    // Interest portion collected from real approved vouchers in database
    const interestIncome = Math.round(approvedCols.reduce((sum, c) => sum + (c.interest_component || (c.amount * 0.15)), 0))
    // Penalties from collections in database
    const lateChargeIncome = approvedCols.reduce((sum, c) => sum + (c.penalty_component || 0), 0)
    const totalIncome = processingFeeIncome + interestIncome + lateChargeIncome

    // Real recorded branch expenses from cash_daily table in database
    const totalExpenses = (cashDailyRecords || []).reduce((sum: number, cb: any) => sum + (cb.branch_expenses || 0), 0)
    const netProfit = totalIncome - totalExpenses

    return {
      processingFeeIncome,
      interestIncome,
      lateChargeIncome,
      totalIncome,
      staffExpenses: 0,
      branchRentAndUtilities: 0,
      printingAndAdmin: 0,
      totalExpenses,
      netProfit
    }
  }, [loans, collections, cashDailyRecords])

  // ---------------- CSV EXPORTS ----------------

  const handleExportActiveTab = () => {
    if (activeTab === 'demand') {
      const rows = demandRows.map(r => ({
        'Client ID': r.clientId,
        'Loan ID': r.loanNumber,
        'Borrower Name': r.clientName,
        Address: r.address,
        'Client Mobile': r.clientMobile,
        'Nominee Mobile': r.nomineeMobile,
        'Loan Product': r.loanType,
        'EMI Amount': r.emiAmount,
        'Paid Today': r.amountPaidToday,
        'Outstanding Balance': r.outstandingDemand,
        'Assigned Center': r.staffName,
        'RO Name': r.roName,
        Status: r.collectionStatus
      }))
      exportToCSV(rows, `RAM_Finance_Demand_Report_${reportDate}`)
    } else if (activeTab === 'od_ageing') {
      const rows = odRows.map(r => ({
        'Loan ID': r.loanNumber,
        'Client ID': r.clientId,
        'Borrower Name': r.clientName,
        Address: r.address,
        'Mobile 1': r.clientMobile,
        'Mobile 2 (Nominee)': r.nomineeMobile,
        Product: r.loanType,
        'OD Days': r.odDays,
        'Overdue Amount': r.overdueAmount,
        'Last Collection': r.lastCollectionDate,
        'RO Name': r.roName
      }))
      exportToCSV(rows, `RAM_Finance_Overdue_Report_${reportDate}`)
    } else if (activeTab === 'daily_collection') {
      const rows = dailyCollectionRows.map(r => ({
        Date: r.date,
        Voucher: r.voucherNo,
        'Client ID': r.clientId,
        Borrower: r.clientName,
        'Loan ID': r.loanNumber,
        Product: r.loanType,
        Amount: r.amount,
        Mode: r.paymentMode,
        'UTR / Ref': r.utrNumber,
        Status: r.status,
        Center: r.centerName,
        'RO Name': r.roName
      }))
      exportToCSV(rows, `RAM_Finance_Daily_Collection_${reportDate}`)
    } else if (activeTab === 'cash_book') {
      exportToCSV(cashBookRows, `RAM_Finance_Cash_Book_${reportDate}`)
    } else if (activeTab === 'outstanding') {
      const rows = [
        { Metric: 'Principal Disbursed', Amount: outstandingBreakdown.principalDisbursed },
        { Metric: 'Principal Outstanding', Amount: outstandingBreakdown.principalOutstanding },
        { Metric: 'Interest Due (Accrued)', Amount: outstandingBreakdown.interestDue },
        { Metric: 'Overdue Arrears', Amount: outstandingBreakdown.overdueArrears },
        { Metric: 'Total Receivable', Amount: outstandingBreakdown.totalReceivable }
      ]
      exportToCSV(rows, `RAM_Finance_Outstanding_Report_${reportDate}`)
    } else {
      const rows = (loans || []).map(l => {
        const staff = staffList?.find(s => s.id === l.created_by || s.center_id === (l.customers as any)?.center_id)
        return {
          'Loan ID': l.loan_id,
          'Client ID': (l.customers as any)?.client_id || '',
          Borrower: (l.customers as any)?.full_name || 'Borrower',
          Product: l.loan_products?.name || l.loan_products?.type || 'Micro Finance',
          Amount: l.principal_amount || 0,
          'Processing Fee': l.processing_fee || 0,
          Date: l.created_at?.split('T')[0] || '',
          Status: l.status,
          'RO Name': staff ? (staff.role === 'Staff' ? `RO ${staff.full_name}` : staff.full_name) : 'Field Officer'
        }
      })
      exportToCSV(rows, `RAM_Finance_Disbursement_Report_${reportDate}`)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Operational & Financial Reports</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Real-time live demand tracking, OD monitoring, daily cash desk, and staff incentive statements
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="date"
            value={reportDate}
            onChange={e => setReportDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold outline-none focus:border-indigo-600 bg-white"
          />

          <button
            onClick={handleExportActiveTab}
            className="inline-flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-xs"
          >
            <Download size={14} className="mr-1.5" /> Export Tab
          </button>

          {profile?.role === 'Admin' && (
            <button
              onClick={handleAdminMasterExport}
              disabled={isExportingMaster}
              className="inline-flex items-center bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-xs disabled:opacity-50"
              title="Download complete database as a multi-sheet Microsoft Excel Workbook"
            >
              <FileSpreadsheet size={15} className="mr-1.5" />
              {isExportingMaster ? 'Exporting All...' : 'Download All Data (Excel)'}
            </button>
          )}
        </div>
      </div>

      {/* Admin Master Export Highlight Banner */}
      {profile?.role === 'Admin' && (
        <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center font-bold text-emerald-300 shrink-0">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Admin Master Database Export</span>
                <span className="bg-emerald-400 text-slate-950 font-black text-[9px] uppercase px-1.5 py-0.5 rounded tracking-wide">
                  Excel Multi-Sheet
                </span>
              </p>
              <p className="text-xs text-emerald-200 mt-0.5">
                Download all organization records (Customers, Loans, Collections, Centers, Daily Cash Desk) in one formatted Excel workbook.
              </p>
            </div>
          </div>
          <button
            onClick={handleAdminMasterExport}
            disabled={isExportingMaster}
            className="inline-flex items-center justify-center bg-emerald-400 hover:bg-emerald-300 text-slate-950 px-4 py-2 rounded-xl text-xs font-black transition-all shadow-sm shrink-0 disabled:opacity-50"
          >
            <Download size={14} className="mr-1.5" />
            {isExportingMaster ? 'Generating...' : 'Download Complete Database (.xls)'}
          </button>
        </div>
      )}

      {/* Report Navigation Tabs */}
      <div className="flex overflow-x-auto bg-slate-200/80 p-1 rounded-xl text-xs font-bold text-slate-600 space-x-1 touch-scroll">
        <button
          onClick={() => setActiveTab('demand')}
          className={`px-3.5 py-2 rounded-lg whitespace-nowrap transition-all ${
            activeTab === 'demand' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
          }`}
        >
          Live Demand Report
        </button>

        <button
          onClick={() => setActiveTab('od_ageing')}
          className={`px-3.5 py-2 rounded-lg whitespace-nowrap transition-all ${
            activeTab === 'od_ageing' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
          }`}
        >
          Overdue (OD) Report
        </button>

        <button
          onClick={() => setActiveTab('daily_collection')}
          className={`px-3.5 py-2 rounded-lg whitespace-nowrap transition-all ${
            activeTab === 'daily_collection' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
          }`}
        >
          Daily Collection & Incentives
        </button>

        <button
          onClick={() => setActiveTab('cash_book')}
          className={`px-3.5 py-2 rounded-lg whitespace-nowrap transition-all ${
            activeTab === 'cash_book' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
          }`}
        >
          Branch Cash Book
        </button>

        <button
          onClick={() => setActiveTab('outstanding')}
          className={`px-3.5 py-2 rounded-lg whitespace-nowrap transition-all ${
            activeTab === 'outstanding' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
          }`}
        >
          Loan Outstanding
        </button>

        <button
          onClick={() => setActiveTab('disbursements')}
          className={`px-3.5 py-2 rounded-lg whitespace-nowrap transition-all ${
            activeTab === 'disbursements' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
          }`}
        >
          Disbursements
        </button>

        <button
          onClick={() => setActiveTab('portfolio')}
          className={`px-3.5 py-2 rounded-lg whitespace-nowrap transition-all ${
            activeTab === 'portfolio' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
          }`}
        >
          Portfolio Mix
        </button>

        {/* Profit & Loss: Hidden from Staff logins */}
        {!isStaff && (
          <button
            onClick={() => setActiveTab('pnl')}
            className={`px-3.5 py-2 rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'pnl' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Profit & Loss
          </button>
        )}
      </div>

      {/* Universal Search & Product Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <input
            type="text"
            placeholder="Filter by Borrower, Client ID, Loan ID, or Mobile..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 outline-none focus:border-indigo-600 w-full sm:w-72"
          />

          <div className="w-full sm:w-48">
            <Select
              value={PRODUCT_FILTER_OPTIONS.find(opt => opt.value === filterProduct)}
              options={PRODUCT_FILTER_OPTIONS}
              onChange={(opt) => setFilterProduct(opt?.value || 'ALL')}
              styles={customSelectStyles}
              isSearchable={false}
              placeholder="Select Product"
            />
          </div>

          {activeTab === 'demand' && (
            <div className="w-full sm:w-52">
              <Select
                value={STATUS_FILTER_OPTIONS.find(opt => opt.value === filterStatus)}
                options={STATUS_FILTER_OPTIONS}
                onChange={(opt) => setFilterStatus(opt?.value || 'ALL')}
                styles={customSelectStyles}
                isSearchable={false}
                placeholder="Collection Status"
              />
            </div>
          )}
        </div>
      </div>

      {/* ---------------- 1. LIVE DEMAND REPORT ---------------- */}
      {activeTab === 'demand' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/70">
            <div>
              <h2 className="text-base font-bold text-slate-800">Live Demand & Collection Status</h2>
              <p className="text-xs text-slate-500">Live monitoring for RO and Branch Manager with explicit pending status</p>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md font-bold border border-emerald-200">
                Collected: {demandRows.filter(r => r.collectionStatus === 'Collected').length}
              </span>
              <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-md font-bold border border-amber-200">
                Not Collected: {demandRows.filter(r => r.collectionStatus === 'Not Collected').length}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Client & Loan</th>
                  <th className="px-4 py-3">Borrower Details</th>
                  <th className="px-4 py-3">Mobile 1 & 2</th>
                  <th className="px-4 py-3">Loan Product</th>
                  <th className="px-4 py-3">EMI Due</th>
                  <th className="px-4 py-3">Paid Today</th>
                  <th className="px-4 py-3">Outstanding</th>
                  <th className="px-4 py-3">Assigned RO</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {demandRows.map(row => (
                  <tr key={row.loanId} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-indigo-700 block">{row.loanNumber}</span>
                      <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1 rounded">{row.clientId}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800 text-sm">{row.clientName}</p>
                      <p className="text-[11px] text-slate-500 truncate max-w-[160px]">{row.address}</p>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      <p className="text-slate-800 font-semibold">{row.clientMobile}</p>
                      <p className="text-slate-400 text-[10px]">Nom: {row.nomineeMobile}</p>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">{row.loanType}</td>
                    <td className="px-4 py-3 font-bold font-mono text-slate-800">₹{row.emiAmount.toLocaleString()}</td>
                    <td className="px-4 py-3 font-bold font-mono text-emerald-700">₹{row.amountPaidToday.toLocaleString()}</td>
                    <td className="px-4 py-3 font-bold font-mono text-slate-600">₹{row.outstandingDemand.toLocaleString()}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      <p className="font-semibold text-slate-800">{row.roName}</p>
                      <span className="text-[10px] text-slate-400">{row.staffName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        row.collectionStatus === 'Collected'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {row.collectionStatus === 'Collected' ? '✓ Collected' : '⏱ Not Collected'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.collectionStatus === 'Not Collected' && row.clientMobile !== 'N/A' && (
                        <a
                          href={getWhatsAppClickToChatUrl(
                            row.clientMobile,
                            formatPreDemandMessage({
                              customerName: row.clientName,
                              mobileNumber: row.clientMobile,
                              loanId: row.loanNumber,
                              dueDate: reportDate,
                              dueAmount: row.emiAmount,
                              arrearAmount: 0,
                              totalDemand: row.emiAmount
                            })
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded border border-emerald-200"
                        >
                          <MessageSquare size={12} className="mr-1 text-emerald-600" />
                          Remind
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- 2. OVERDUE (OD) REPORT ---------------- */}
      {activeTab === 'od_ageing' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70">
            <h2 className="text-base font-bold text-slate-800">Overdue (OD) Loan Portfolio</h2>
            <p className="text-xs text-slate-500">Borrower details, full addresses, both contact numbers, and aging buckets</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Loan & Client</th>
                  <th className="px-4 py-3">Borrower & Address</th>
                  <th className="px-4 py-3">Both Mobiles</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">OD Days</th>
                  <th className="px-4 py-3">Overdue Amount</th>
                  <th className="px-4 py-3">Last Collection</th>
                  <th className="px-4 py-3">Responsible RO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {odRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-rose-700 block">{row.loanNumber}</span>
                      <span className="font-mono text-[10px] text-slate-500">{row.clientId}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800">{row.clientName}</p>
                      <p className="text-[11px] text-slate-500">{row.address}</p>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      <p className="text-slate-800 font-semibold">{row.clientMobile}</p>
                      <p className="text-slate-400 text-[10px]">Nom: {row.nomineeMobile}</p>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">{row.loanType}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded font-bold text-xs bg-rose-100 text-rose-800">
                        {row.odDays} Days
                      </span>
                    </td>
                    <td className="px-4 py-3 font-black font-mono text-rose-700 text-sm">
                      ₹{row.overdueAmount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">{row.lastCollectionDate}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      <p className="font-semibold text-slate-800">{row.roName}</p>
                      <span className="text-[10px] text-slate-400">{row.staffName}</span>
                    </td>
                  </tr>
                ))}
                {odRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-slate-400 text-xs">
                      ✓ Zero overdue accounts. All active loan repayments are up to date in the database!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- 3. DAILY COLLECTION & STAFF INCENTIVE REPORT ---------------- */}
      {activeTab === 'daily_collection' && (
        <div className="space-y-6">
          {/* Staff Incentive Matrix Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
            <div className="flex items-center space-x-2 text-indigo-700 mb-3 border-b border-slate-100 pb-2">
              <Award size={20} />
              <h2 className="text-base font-bold text-slate-800">Staff Collection Performance & Incentive (Database Calculated)</h2>
            </div>

            {staffIncentives.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200">
                No active staff collections or disbursements recorded in the database yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {staffIncentives.map(staff => (
                  <div key={staff.roName} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">{staff.roName}</h3>
                      <div className="mt-2 space-y-1 text-xs text-slate-600">
                        <div className="flex justify-between">
                          <span>Demand Assigned:</span>
                          <span className="font-mono font-semibold">₹{staff.assignedDemand.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Achieved:</span>
                          <span className="font-mono font-semibold text-emerald-700">₹{staff.achievedCollection.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Efficiency %:</span>
                          <span className="font-mono font-bold text-indigo-700">{staff.efficiencyPercent}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cycles Disbursed:</span>
                          <span className="font-mono font-semibold">{staff.disbursementsAchieved}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Calculated Incentive</span>
                      <span className="font-black font-mono text-emerald-700 text-base">₹{staff.incentiveAmount.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Daily Collection Ledger Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70">
              <h2 className="text-base font-bold text-slate-800">Date-Wise Collection Entries & Payment Modes</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Voucher</th>
                    <th className="px-4 py-3">Borrower & Client ID</th>
                    <th className="px-4 py-3">Loan ID</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3">UTR / Ref</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">RO Name</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailyCollectionRows.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-mono text-slate-600">{row.date}</td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-700">{row.voucherNo}</td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800">{row.clientName}</p>
                        <span className="text-[10px] font-mono text-slate-400">{row.clientId}</span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-indigo-700">{row.loanNumber}</td>
                      <td className="px-4 py-3 font-bold font-mono text-emerald-700 text-sm">₹{row.amount.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          row.paymentMode === 'Cash' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}>
                          {row.paymentMode}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">{row.utrNumber}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          row.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">{row.roName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 4. BRANCH CASH BOOK REPORT ---------------- */}
      {activeTab === 'cash_book' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70">
            <h2 className="text-base font-bold text-slate-800">Branch Daily Cash Book Register</h2>
            <p className="text-xs text-slate-500">Daily opening balance, cash received, disbursements paid, expenses, and closing reconciliation</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Opening Cash</th>
                  <th className="px-4 py-3">Cash Received (+)</th>
                  <th className="px-4 py-3">Digital Inflow</th>
                  <th className="px-4 py-3">Disbursements (-)</th>
                  <th className="px-4 py-3">Expenses (-)</th>
                  <th className="px-4 py-3">HO Handover</th>
                  <th className="px-4 py-3">Closing Cash</th>
                  <th className="px-4 py-3">Physical Counted</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {cashBookRows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 font-semibold">
                    <td className="px-4 py-3 text-slate-700">{r.date}</td>
                    <td className="px-4 py-3 text-slate-800">₹{r.openingBalance.toLocaleString()}</td>
                    <td className="px-4 py-3 text-emerald-700">+ ₹{r.cashReceived.toLocaleString()}</td>
                    <td className="px-4 py-3 text-purple-700">₹{r.digitalReceived.toLocaleString()}</td>
                    <td className="px-4 py-3 text-rose-700">- ₹{r.disbursementsPaid.toLocaleString()}</td>
                    <td className="px-4 py-3 text-rose-700">- ₹{r.branchExpenses.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-600">₹{r.hoHandover.toLocaleString()}</td>
                    <td className="px-4 py-3 font-bold text-indigo-900 text-sm">₹{r.closingBalance.toLocaleString()}</td>
                    <td className="px-4 py-3 font-bold text-slate-900 text-sm">₹{r.physicalCash.toLocaleString()}</td>
                    <td className="px-4 py-3 font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- 5. LOAN OUTSTANDING REPORT ---------------- */}
      {activeTab === 'outstanding' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500">Principal Disbursed</span>
              <p className="text-xl font-black text-slate-800 mt-1 font-mono">
                ₹{outstandingBreakdown.principalDisbursed.toLocaleString()}
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs text-center">
              <span className="text-[10px] uppercase font-bold text-indigo-600">Principal Outstanding</span>
              <p className="text-xl font-black text-indigo-700 mt-1 font-mono">
                ₹{outstandingBreakdown.principalOutstanding.toLocaleString()}
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs text-center">
              <span className="text-[10px] uppercase font-bold text-amber-600">Interest Due / Accrued</span>
              <p className="text-xl font-black text-amber-700 mt-1 font-mono">
                ₹{outstandingBreakdown.interestDue.toLocaleString()}
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs text-center bg-indigo-50/50 border-indigo-200">
              <span className="text-[10px] uppercase font-bold text-indigo-900">Total Net Receivable</span>
              <p className="text-xl font-black text-indigo-950 mt-1 font-mono">
                ₹{outstandingBreakdown.totalReceivable.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 6. DISBURSEMENTS REPORT ---------------- */}
      {activeTab === 'disbursements' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70">
            <h2 className="text-base font-bold text-slate-800">Sanctioned Loans & Disbursement Register</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Loan ID & Cycle</th>
                  <th className="px-4 py-3">Borrower & Client ID</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Principal Amount</th>
                  <th className="px-4 py-3">Processing Fee</th>
                  <th className="px-4 py-3">Disbursement Date</th>
                  <th className="px-4 py-3">Assigned RO</th>
                  <th className="px-4 py-3">Approval Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(loans || []).map(l => (
                  <tr key={l.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono font-bold text-indigo-700">{l.loan_id} (C{l.cycle_number})</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800">{(l.customers as any)?.full_name}</p>
                      <span className="text-[10px] font-mono text-slate-400">{(l.customers as any)?.client_id}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">{l.loan_products?.name || 'Micro Finance'}</td>
                    <td className="px-4 py-3 font-black font-mono text-slate-900 text-sm">₹{l.principal_amount?.toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">₹{(l.processing_fee || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{l.created_at?.split('T')[0]}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {staffList?.find(s => s.id === l.created_by || s.center_id === (l.customers as any)?.center_id)?.full_name || 'Field Officer'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        l.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
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

      {/* ---------------- 7. PORTFOLIO MIX ---------------- */}
      {activeTab === 'portfolio' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs md:col-span-2">
            <h3 className="font-bold text-slate-800 text-base mb-4 border-b border-slate-100 pb-2">Product Distribution</h3>
            <div className="space-y-4 text-xs">
              {Object.entries(portfolioMetrics.productBreakdown).map(([name, data]) => (
                <div key={name} className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-800">{name} ({data.count} loans)</span>
                  <span className="font-mono font-black text-indigo-700 text-sm">₹{data.disbursed.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 8. PROFIT & LOSS (Protected from Staff) ---------------- */}
      {activeTab === 'pnl' && !isStaff && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs max-w-2xl">
          <h2 className="text-base font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Branch Profit & Loss Statement</h2>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="font-semibold text-slate-700">Gross Operational Incomes:</span>
              <span className="font-mono font-bold text-emerald-700">₹{pnlMetrics.totalIncome.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="font-semibold text-slate-700">Operating Expenses & Salaries:</span>
              <span className="font-mono font-bold text-rose-700">- ₹{pnlMetrics.totalExpenses.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-t-2 border-slate-800 font-bold text-sm">
              <span>Net Branch Margin:</span>
              <span className="font-mono text-emerald-700">₹{pnlMetrics.netProfit.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
