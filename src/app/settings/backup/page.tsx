"use client";

import { useState } from 'react'
import {
  FileSpreadsheet,
  Download,
  Database,
  Users,
  CreditCard,
  Building,
  CheckCircle2,
  Shield,
  Clock,
  HardDrive,
  FileText
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/store/appStore'
import { SettingsHeader } from '@/components/ui/SettingsHeader'
import { downloadFullDatabaseAsExcel, exportToCSV } from '@/lib/exporter'

export default function AdminBackupExport() {
  const profile = useAppStore(state => state.profile)
  const isAdmin = profile?.role === 'Admin'

  const [isExportingMaster, setIsExportingMaster] = useState(false)
  const [lastExportStatus, setLastExportStatus] = useState<string | null>(null)

  // Fetch Live Counts for each table
  const { data: counts, isLoading } = useQuery({
    queryKey: ['admin-db-counts'],
    queryFn: async () => {
      const [
        { count: custCount },
        { count: loanCount },
        { count: colCount },
        { count: centerCount },
        { count: cashCount }
      ] = await Promise.all([
        supabase.from('customers').select('*', { count: 'exact', head: true }),
        supabase.from('loans').select('*', { count: 'exact', head: true }),
        supabase.from('collections').select('*', { count: 'exact', head: true }),
        supabase.from('centers').select('*', { count: 'exact', head: true }),
        supabase.from('branch_cash_daily').select('*', { count: 'exact', head: true })
      ])

      return {
        customers: custCount || 0,
        loans: loanCount || 0,
        collections: colCount || 0,
        centers: centerCount || 0,
        cashDesk: cashCount || 0
      }
    }
  })

  // Trigger Master Multi-Sheet Excel Download
  const handleMasterDownload = async () => {
    try {
      setIsExportingMaster(true)
      setLastExportStatus(null)

      const result = await downloadFullDatabaseAsExcel(supabase)

      // Log action to audit_logs
      try {
        await supabase.from('audit_logs').insert({
          user_id: profile?.id || null,
          action: 'MASTER_EXCEL_EXPORT',
          entity_type: 'DATABASE_BACKUP',
          reason: 'Admin initiated full database master Excel download',
          details: { ...result, exported_at: new Date().toISOString() }
        })
      } catch (logErr) {
        console.warn('Audit log write skipped:', logErr)
      }

      setLastExportStatus(`Successfully exported ${result.customersCount} customers, ${result.loansCount} loans, and ${result.collectionsCount} collections into Master Excel Workbook!`)
    } catch (err: any) {
      alert(`Master Export Error: ${err.message}`)
    } finally {
      setIsExportingMaster(false)
    }
  }

  // Individual Table Download Handlers
  const handleDownloadTable = async (table: 'customers' | 'loans' | 'collections' | 'centers' | 'cash_desk') => {
    try {
      if (table === 'customers') {
        const { data } = await supabase.from('customers').select('*, centers(name, branches(name))')
        const rows = (data || []).map((c: any) => ({
          'Client ID': c.client_id,
          'Full Name': c.full_name,
          'Mobile': c.mobile_number,
          'DOB': c.dob,
          'KYC Type': c.kyc_doc_type,
          'UID Number': c.kyc_doc_number,
          'Address': c.address,
          'Center': c.centers?.name,
          'Branch': c.centers?.branches?.name,
          'Nominee Name': c.nominee_name,
          'Nominee Relation': c.nominee_relationship,
          'Nominee Mobile': c.nominee_mobile,
          'Photo Link': c.photo_url || '',
          'Doc Link': c.kyc_doc_url || '',
          'Status': c.status
        }))
        exportToCSV(rows, 'RAM_Finance_Customers_Export')
      } else if (table === 'loans') {
        const { data } = await supabase.from('loans').select('*, customers(client_id, full_name), loan_products(name, type)')
        const rows = (data || []).map((l: any) => ({
          'Loan ID': l.loan_id,
          'Client ID': l.customers?.client_id,
          'Borrower Name': l.customers?.full_name,
          'Product': l.loan_products?.name,
          'Principal Amount': l.principal_amount,
          'Tenure': l.tenure_weeks,
          'EMI Amount': l.emi_amount,
          'Processing Fee': l.processing_fee,
          'First EMI Date': l.first_emi_date,
          'Status': l.status
        }))
        exportToCSV(rows, 'RAM_Finance_Loans_Export')
      } else if (table === 'collections') {
        const { data } = await supabase.from('collections').select('*, customers(client_id, full_name), loans(loan_id)')
        const rows = (data || []).map((c: any) => ({
          'Voucher No': c.voucher_number || c.id.slice(0, 8),
          'Client ID': c.customers?.client_id,
          'Borrower Name': c.customers?.full_name,
          'Loan ID': c.loans?.loan_id,
          'Collected Amount': c.amount,
          'Payment Mode': c.payment_mode,
          'UTR Reference': c.utr_number || 'Cash',
          'Status': c.status,
          'Date': c.created_at ? new Date(c.created_at).toLocaleDateString() : ''
        }))
        exportToCSV(rows, 'RAM_Finance_Collections_Export')
      } else if (table === 'centers') {
        const { data } = await supabase.from('centers').select('*, branches(name, code)')
        const rows = (data || []).map((cen: any) => ({
          'Center Name': cen.name,
          'Branch Name': cen.branches?.name,
          'Meeting Day': cen.meeting_day,
          'Center ID': cen.id
        }))
        exportToCSV(rows, 'RAM_Finance_Centers_Export')
      } else if (table === 'cash_desk') {
        const { data } = await supabase.from('branch_cash_daily').select('*, branches(name)')
        const rows = (data || []).map((cb: any) => ({
          'Date': cb.record_date,
          'Branch': cb.branches?.name,
          'Opening Cash': cb.opening_cash,
          'Cash Collections': cb.cash_collections,
          'Digital Collections': cb.digital_collections,
          'Disbursements Paid': cb.disbursements_paid,
          'Branch Expenses': cb.branch_expenses,
          'Staff Handover': cb.staff_handover,
          'HO Remittance': cb.ho_handover,
          'Closing Cash System': cb.closing_cash_system,
          'Physical Cash': cb.physical_cash_counted,
          'Variance': cb.difference_amount,
          'Status': cb.status
        }))
        exportToCSV(rows, 'RAM_Finance_CashDesk_Export')
      }
    } catch (e: any) {
      alert(`Export Error: ${e.message}`)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <SettingsHeader
        title="Data Backup & Master Excel Export"
        description="Comprehensive administrative database export into structured Microsoft Excel Workbooks."
        breadcrumb="Master Excel Export"
      />

      {/* Admin Access Banner */}
      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-xs flex items-center">
          <Shield size={18} className="mr-2 text-amber-600 shrink-0" />
          <span>
            <strong>Administrative Feature:</strong> Master database downloads are restricted to authorized Admin accounts for data protection compliance.
          </span>
        </div>
      )}

      {/* Master Action Banner */}
      <section className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center space-x-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold">
              <Database size={14} />
              <span>Full System Database Backup</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">
              All-in-One Master Excel Workbook (.xls)
            </h2>
            <p className="text-indigo-200 text-xs md:text-sm leading-relaxed">
              Generates a single, multi-tab Microsoft Excel file containing every module: Customers &amp; KYC, Loan Disbursements, Collection Vouchers, Centers &amp; Branches, and Daily Cash Desks.
            </p>

            {/* Live Count Chips */}
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="bg-white/10 backdrop-blur-xs px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium">
                👥 {isLoading ? '...' : counts?.customers} Customers
              </span>
              <span className="bg-white/10 backdrop-blur-xs px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium">
                📄 {isLoading ? '...' : counts?.loans} Loans
              </span>
              <span className="bg-white/10 backdrop-blur-xs px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium">
                💳 {isLoading ? '...' : counts?.collections} Vouchers
              </span>
              <span className="bg-white/10 backdrop-blur-xs px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium">
                🏢 {isLoading ? '...' : counts?.centers} Centers
              </span>
              <span className="bg-white/10 backdrop-blur-xs px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium">
                💵 {isLoading ? '...' : counts?.cashDesk} Cash Desks
              </span>
            </div>
          </div>

          <div className="flex flex-col items-start lg:items-end gap-3 shrink-0">
            <button
              onClick={handleMasterDownload}
              disabled={isExportingMaster}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-3.5 rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-60 flex items-center space-x-2.5 text-sm"
            >
              {isExportingMaster ? (
                <>
                  <Clock size={18} className="animate-spin" />
                  <span>Compiling Master Workbook...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet size={20} />
                  <span>Download Master Excel (.xls)</span>
                </>
              )}
            </button>
            <span className="text-[11px] text-indigo-300">
              Native Microsoft Excel multi-sheet format
            </span>
          </div>
        </div>

        {lastExportStatus && (
          <div className="mt-5 p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs flex items-center">
            <CheckCircle2 size={16} className="mr-2 text-emerald-400 shrink-0" />
            <span>{lastExportStatus}</span>
          </div>
        )}
      </section>

      {/* Module-Wise Individual Table Downloads */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-bold text-slate-800">Individual Table Downloads</h3>
          <p className="text-xs text-slate-500">Download specific datasets separately in CSV / Excel format.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Customers Table */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Users size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Customers &amp; KYC</h4>
                  <span className="text-[11px] font-mono text-slate-500">{counts?.customers || 0} registered</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500">All borrower profiles, Aadhaar UIDs, photos, nominee details, and address data.</p>
            <button
              onClick={() => handleDownloadTable('customers')}
              className="w-full inline-flex items-center justify-center space-x-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 py-2 rounded-xl text-xs font-bold transition-colors"
            >
              <Download size={14} />
              <span>Download Customers (Excel/CSV)</span>
            </button>
          </div>

          {/* Loans Table */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <FileText size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Loans &amp; Disbursals</h4>
                  <span className="text-[11px] font-mono text-slate-500">{counts?.loans || 0} loan accounts</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500">Principal amounts, cycle numbers, EWI tenures, fees, approval status, and photo proofs.</p>
            <button
              onClick={() => handleDownloadTable('loans')}
              className="w-full inline-flex items-center justify-center space-x-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 py-2 rounded-xl text-xs font-bold transition-colors"
            >
              <Download size={14} />
              <span>Download Loans (Excel/CSV)</span>
            </button>
          </div>

          {/* Collections Table */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Collections Ledger</h4>
                  <span className="text-[11px] font-mono text-slate-500">{counts?.collections || 0} vouchers</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500">All repayment entries, Cash vs. UPI payment modes, UTR references, and maker-checker approvals.</p>
            <button
              onClick={() => handleDownloadTable('collections')}
              className="w-full inline-flex items-center justify-center space-x-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 py-2 rounded-xl text-xs font-bold transition-colors"
            >
              <Download size={14} />
              <span>Download Collections (Excel/CSV)</span>
            </button>
          </div>

          {/* Centers & Branches */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <Building size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Centers &amp; Branches</h4>
                  <span className="text-[11px] font-mono text-slate-500">{counts?.centers || 0} centers</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500">Center hierarchies, assigned meeting days, branch codes, and operational RO centers.</p>
            <button
              onClick={() => handleDownloadTable('centers')}
              className="w-full inline-flex items-center justify-center space-x-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 py-2 rounded-xl text-xs font-bold transition-colors"
            >
              <Download size={14} />
              <span>Download Centers (Excel/CSV)</span>
            </button>
          </div>

          {/* Cash Desk Daily Reconciliation */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <HardDrive size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Branch Cash Desk</h4>
                  <span className="text-[11px] font-mono text-slate-500">{counts?.cashDesk || 0} days closed</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500">Day-end cash desk closings, vault physical counts, variances, and expenses ledger.</p>
            <button
              onClick={() => handleDownloadTable('cash_desk')}
              className="w-full inline-flex items-center justify-center space-x-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 py-2 rounded-xl text-xs font-bold transition-colors"
            >
              <Download size={14} />
              <span>Download Cash Desk (Excel/CSV)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

