"use client";

import { useState, useMemo } from 'react'
import { FileText, Plus, Search, SlidersHorizontal, Trash2, Printer, X, Edit2, Eye } from 'lucide-react'
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Select from 'react-select'
import { customSelectStyles } from '@/components/ui/SelectStyles'
import { supabase } from '@/lib/supabase'
import { useTable } from '@/hooks/useTable'
import { Pagination } from '@/components/ui/Pagination'
import { SortHeader } from '@/components/ui/SortHeader'

const LOAN_STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Pending Approval', label: 'Pending Approval' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Draft', label: 'Draft' }
]

function formatCardDate(dateStr: string) {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  } catch {
    return dateStr
  }
}

export default function Loans() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [editingLoan, setEditingLoan] = useState<any>(null)
  const [editFormData, setEditFormData] = useState({
    principal_amount: '',
    tenure_weeks: '',
    emi_amount: '',
    status: 'Active'
  })

  const { data: loans, isLoading } = useQuery({
    queryKey: ['loans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loans')
        .select(`*, customers (full_name, client_id)`)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data || []
    }
  })

  // Update Loan Mutation
  const updateLoanMutation = useMutation({
    mutationFn: async (updated: any) => {
      const { error } = await supabase
        .from('loans')
        .update({
          principal_amount: parseFloat(updated.principal_amount),
          tenure_weeks: updated.tenure_weeks ? parseInt(updated.tenure_weeks) : null,
          emi_amount: updated.emi_amount ? parseFloat(updated.emi_amount) : null,
          status: updated.status
        })
        .eq('id', updated.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] })
      setEditingLoan(null)
    },
    onError: (err: any) => alert(`Failed to update loan: ${err.message}`)
  })

  // Delete Loan Mutation
  const deleteLoanMutation = useMutation({
    mutationFn: async (loanId: string) => {
      const { error } = await supabase
        .from('loans')
        .delete()
        .eq('id', loanId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] })
    },
    onError: (err: any) => {
      alert(`Cannot delete loan: ${err.message || 'This loan might have associated repayment collections.'}`)
    }
  })

  const handleDeleteLoan = (loan: any) => {
    if (confirm(`Are you sure you want to delete loan ${loan.loan_id} (₹${loan.principal_amount})?`)) {
      deleteLoanMutation.mutate(loan.id)
    }
  }

  const handleOpenEdit = (loan: any) => {
    setEditingLoan(loan)
    setEditFormData({
      principal_amount: loan.principal_amount?.toString() || '',
      tenure_weeks: loan.tenure_weeks?.toString() || '',
      emi_amount: loan.emi_amount?.toString() || '',
      status: loan.status || 'Active'
    })
  }

  // Filtered Loans
  const filteredLoans = useMemo(() => {
    if (!loans) return []
    return loans.filter(l => {
      const matchSearch =
        !searchTerm.trim() ||
        l.customers?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.loan_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.customers?.client_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.principal_amount?.toString().includes(searchTerm)

      const matchStatus =
        filterStatus === 'ALL' ||
        (filterStatus === 'ACTIVE' && l.status === 'Active') ||
        (filterStatus === 'PENDING' && l.status === 'Pending Approval')

      return matchSearch && matchStatus
    })
  }, [loans, searchTerm, filterStatus])

  const {
    paginatedData,
    currentPage,
    totalPages,
    setCurrentPage,
    requestSort,
    getSortDirection,
    totalItems
  } = useTable(filteredLoans, { itemsPerPage: 10, initialSort: { key: 'created_at', direction: 'desc' } })

  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6 pb-20 md:pb-6">
      {/* Page Heading & Action */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-black text-slate-800">Loans</h1>
        <Link href="/loans/new" className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 md:px-5 py-2 md:py-2.5 rounded-xl text-sm font-bold shadow-md shadow-indigo-200 transition-all active:scale-95">
          <Plus size={18} className="mr-1.5 md:mr-2 stroke-[2.5]" /> <span className="hidden sm:inline">New Loan</span><span className="sm:hidden">New</span>
        </Link>
      </div>

      {/* Search & Filter Bar (Matching Screenshot) */}
      <div className="flex items-center space-x-2.5">
        <div className="flex-1 flex items-center bg-white border border-slate-200/90 rounded-2xl px-4 py-3 shadow-xs focus-within:ring-2 focus-within:ring-slate-300 transition-all">
          <Search size={19} className="text-slate-400 mr-2.5 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search loan ID, customer or amount..."
            className="w-full bg-transparent outline-none text-sm text-slate-800 placeholder:text-slate-400 font-normal"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600 p-0.5">
              <X size={15} />
            </button>
          )}
        </div>

        {/* Filter Slider Button */}
        <button
          onClick={() => setShowFilterModal(!showFilterModal)}
          className={`w-12 h-12 rounded-2xl border border-slate-200/90 flex items-center justify-center transition-all active-press shrink-0 shadow-xs ${
            filterStatus !== 'ALL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
          title="Filter loans"
        >
          <SlidersHorizontal size={19} />
        </button>
      </div>

      {/* Filter Chips */}
      {showFilterModal && (
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between text-xs animate-in fade-in zoom-in-95 duration-150">
          <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Status:</span>
          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
            {['ALL', 'ACTIVE', 'PENDING'].map(st => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs ${
                  filterStatus === st
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
          <button onClick={() => setShowFilterModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Content Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden min-h-[360px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-[360px]">
            <div className="animate-spin h-8 w-8 border-4 border-slate-400 border-t-transparent rounded-full"></div>
          </div>
        ) : filteredLoans && filteredLoans.length > 0 ? (
          <div>
            {/* Native Mobile Cards View (Exact match to screenshot) */}
            <div className="divide-y divide-slate-100 md:hidden bg-white">
              {paginatedData.map(loan => (
                <div key={loan.id} className="p-4 bg-white hover:bg-slate-50/60 transition-colors">
                  {/* Top row: Title + Amount */}
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 pr-3">
                      <Link href={`/loans/${loan.id}`} className="block">
                        <h3 className="text-base font-bold text-slate-900 leading-tight truncate">
                          {loan.customers?.full_name || 'Customer'}
                        </h3>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 font-mono">
                          {loan.loan_id} • CYCLE {loan.cycle_number || 1}
                        </p>
                      </Link>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-lg font-black text-slate-900 tracking-tight">
                        ₹{loan.principal_amount?.toLocaleString()}
                      </div>
                      <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mt-0.5">
                        {loan.status === 'Active' ? 'ACTIVE' : 'PENDING'}
                      </div>
                    </div>
                  </div>

                  {/* Bottom row: Timestamp + Action Buttons */}
                  <div className="flex items-center justify-between mt-3.5 pt-0.5">
                    <span className="text-xs text-slate-400 font-medium">
                      {formatCardDate(loan.created_at)}
                    </span>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleOpenEdit(loan)}
                        className="text-slate-400 hover:text-indigo-600 active:scale-90 transition-transform p-1"
                        title="Edit Loan"
                      >
                        <Edit2 size={17} className="stroke-[1.75]" />
                      </button>
                      <button
                        onClick={() => handleDeleteLoan(loan)}
                        className="text-slate-400 hover:text-rose-600 active:scale-90 transition-transform p-1"
                        title="Delete Loan"
                      >
                        <Trash2 size={17} className="stroke-[1.75]" />
                      </button>
                      <Link
                        href={`/loans/${loan.id}`}
                        className="text-slate-600 hover:text-slate-900 active:scale-90 transition-transform p-1"
                        title="View Loan Details"
                      >
                        <Eye size={18} className="stroke-[1.75]" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Full Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                  <tr>
                    <SortHeader label="Loan ID" sortKey="loan_id" currentSortKey={getSortDirection('loan_id') ? 'loan_id' : null} sortDirection={getSortDirection('loan_id')} onSort={requestSort as any} />
                    <SortHeader label="Customer" sortKey="customer_id" currentSortKey={getSortDirection('customer_id') ? 'customer_id' : null} sortDirection={getSortDirection('customer_id')} onSort={requestSort as any} />
                    <SortHeader label="Amount" sortKey="principal_amount" currentSortKey={getSortDirection('principal_amount') ? 'principal_amount' : null} sortDirection={getSortDirection('principal_amount')} onSort={requestSort as any} />
                    <SortHeader label="Status" sortKey="status" currentSortKey={getSortDirection('status') ? 'status' : null} sortDirection={getSortDirection('status')} onSort={requestSort as any} />
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedData.map((loan) => (
                    <tr key={loan.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-indigo-700">{loan.loan_id}</td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-800">{loan.customers?.full_name || 'Unknown'}</p>
                        <p className="text-xs text-slate-500 font-mono">{loan.customers?.client_id}</p>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-800">₹{loan.principal_amount?.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                          loan.status === 'Active' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                          loan.status === 'Pending Approval' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                          'bg-slate-100 text-slate-800 border-slate-200'
                        }`}>
                          {loan.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-1">
                        <Link
                          href={`/loans/${loan.id}`}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-flex items-center justify-center"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </Link>
                        <button
                          onClick={() => handleOpenEdit(loan)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-flex items-center justify-center"
                          title="Edit Loan"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteLoan(loan)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors inline-flex items-center justify-center"
                          title="Delete Loan"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={totalItems}
              itemsPerPage={10}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[360px] text-center text-slate-500 p-4">
            <FileText size={44} className="mx-auto mb-3 text-slate-300" />
            <p className="text-base font-semibold text-slate-700 mb-0.5">No loans found</p>
            <p className="text-xs text-slate-400">Search for another term or create a new loan disbursement.</p>
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) - Matching Exact Design in Screenshot */}
      <Link
        href="/loans/new"
        className="fixed bottom-[88px] right-5 z-40 w-14 h-14 rounded-full bg-[#4a5548] hover:bg-[#3d463b] text-white shadow-xl shadow-slate-900/30 flex items-center justify-center active:scale-90 transition-transform active-press md:hidden"
        title="New Loan Disbursement"
      >
        <Plus size={28} className="stroke-[2.5]" />
      </Link>

      {/* Edit Loan Modal */}
      {editingLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Edit Loan Account</h3>
                <p className="text-xs text-slate-500 font-mono">Loan ID: {editingLoan.loan_id}</p>
              </div>
              <button onClick={() => setEditingLoan(null)} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Principal Amount (₹) *</label>
                <input
                  type="number"
                  required
                  value={editFormData.principal_amount}
                  onChange={e => setEditFormData({ ...editFormData, principal_amount: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tenure (Weeks)</label>
                  <input
                    type="number"
                    value={editFormData.tenure_weeks}
                    onChange={e => setEditFormData({ ...editFormData, tenure_weeks: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">EMI Amount (₹)</label>
                  <input
                    type="number"
                    value={editFormData.emi_amount}
                    onChange={e => setEditFormData({ ...editFormData, emi_amount: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                <Select
                  value={LOAN_STATUS_OPTIONS.find(o => o.value === editFormData.status)}
                  onChange={(opt: any) => setEditFormData({ ...editFormData, status: opt?.value || 'Active' })}
                  options={LOAN_STATUS_OPTIONS}
                  styles={customSelectStyles}
                  isSearchable={false}
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingLoan(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => updateLoanMutation.mutate({ ...editingLoan, ...editFormData })}
                disabled={updateLoanMutation.isPending || !editFormData.principal_amount}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                {updateLoanMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
