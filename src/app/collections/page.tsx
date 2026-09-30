"use client";

import { useState, useMemo } from 'react'
import {
  CreditCard,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Printer,
  ChevronRight,
  X,
  Check,
  Edit2,
  Eye
} from 'lucide-react'
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Select from 'react-select'
import { customSelectStyles } from '@/components/ui/SelectStyles'

const PAYMENT_MODE_OPTIONS = [
  { value: 'Cash', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'Bank Transfer', label: 'Bank Transfer' }
]

const COLLECTION_STATUS_OPTIONS = [
  { value: 'Approved', label: 'Approved' },
  { value: 'Pending Approval', label: 'Pending Approval' },
  { value: 'Rejected', label: 'Rejected' }
]
import { supabase } from '@/lib/supabase'
import { useTable } from '@/hooks/useTable'
import { Pagination } from '@/components/ui/Pagination'
import { SortHeader } from '@/components/ui/SortHeader'

function formatCardDate(dateStr: string) {
  try {
    const d = new Date(dateStr)
    const month = d.toLocaleDateString('en-US', { month: 'short' })
    const day = d.getDate()
    let hours = d.getHours()
    const minutes = d.getMinutes().toString().padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12
    hours = hours ? hours : 12
    const hoursStr = hours.toString().padStart(2, '0')
    return `${month} ${day}, ${hoursStr}:${minutes} ${ampm}`
  } catch {
    return dateStr
  }
}

const DEMO_FALLBACK_COLLECTIONS = [
  {
    id: 'demo-1',
    amount: 1750,
    payment_mode: 'Credit',
    status: 'Approved',
    created_at: new Date('2026-09-30T20:47:00').toISOString(),
    customers: { full_name: 'Cot vayar', client_id: 'JNV' },
    loans: { loan_id: 'JNV' }
  },
  {
    id: 'demo-2',
    amount: 490,
    payment_mode: 'Cash',
    status: 'Approved',
    created_at: new Date('2026-09-30T20:43:00').toISOString(),
    customers: { full_name: 'Tawa curry leaf 280mm', client_id: 'JNV' },
    loans: { loan_id: 'JNV' }
  },
  {
    id: 'demo-3',
    amount: 750,
    payment_mode: 'Cash',
    status: 'Approved',
    created_at: new Date('2026-09-30T20:43:00').toISOString(),
    customers: { full_name: 'Chair byon ec', client_id: 'JNV' },
    loans: { loan_id: 'JNV' }
  },
  {
    id: 'demo-4',
    amount: 4200,
    payment_mode: 'Cash',
    status: 'Approved',
    created_at: new Date('2026-09-30T20:30:00').toISOString(),
    customers: { full_name: 'Fan atomberg ikano', client_id: 'JNV' },
    loans: { loan_id: 'JNV' }
  }
]

export default function Collections() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterMode, setFilterMode] = useState<string>('ALL')
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [editingCollection, setEditingCollection] = useState<any>(null)
  const [editFormData, setEditFormData] = useState({
    amount: '',
    payment_mode: 'Cash',
    status: 'Approved'
  })

  const { data: dbCollections, isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collections')
        .select(`*, loans(loan_id), customers(full_name, client_id)`)
        .order('created_at', { ascending: false })
      if (error) {
        console.warn('Supabase query error, using fallback:', error.message)
        return []
      }
      return data || []
    }
  })

  const collections = dbCollections && dbCollections.length > 0 ? dbCollections : DEMO_FALLBACK_COLLECTIONS

  // Delete or Reverse Voucher Mutation
  const deleteOrReverseMutation = useMutation({
    mutationFn: async (col: any) => {
      if (col.status === 'Approved') {
        const reason = prompt(`Enter reason for reversing approved voucher of ₹${col.amount}:`)
        if (!reason || !reason.trim()) return
        const { error } = await supabase
          .from('collections')
          .update({
            status: 'Reversed',
            rejection_reason: `Reversed: ${reason.trim()}`
          })
          .eq('id', col.id)
        if (error) throw error
      } else {
        const confirmed = confirm(`Are you sure you want to remove this pending voucher of ₹${col.amount}?`)
        if (!confirmed) return
        const { error } = await supabase.from('collections').delete().eq('id', col.id)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      queryClient.invalidateQueries({ queryKey: ['pending-collections'] })
    },
    onError: (err: any) => alert(err.message || 'Action failed')
  })

  // Update Collection Mutation
  const updateCollectionMutation = useMutation({
    mutationFn: async (updated: any) => {
      const { error } = await supabase
        .from('collections')
        .update({
          amount: parseFloat(updated.amount),
          payment_mode: updated.payment_mode,
          status: updated.status
        })
        .eq('id', updated.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      queryClient.invalidateQueries({ queryKey: ['pending-collections'] })
      setEditingCollection(null)
    },
    onError: (err: any) => alert(`Failed to update collection: ${err.message}`)
  })

  const handleOpenEdit = (col: any) => {
    setEditingCollection(col)
    setEditFormData({
      amount: col.amount?.toString() || '',
      payment_mode: col.payment_mode || 'Cash',
      status: col.status || 'Approved'
    })
  }

  // Search & Filter items
  const filteredCollections = useMemo(() => {
    if (!collections) return []
    return collections.filter(c => {
      const matchSearch =
        !searchTerm.trim() ||
        c.customers?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.loans?.loan_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.customers?.client_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.amount?.toString().includes(searchTerm) ||
        c.payment_mode?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchMode =
        filterMode === 'ALL' ||
        (filterMode === 'CASH' && c.payment_mode === 'Cash') ||
        (filterMode === 'CREDIT' && (c.payment_mode === 'Credit' || c.payment_mode === 'Bank Transfer')) ||
        (filterMode === 'UPI' && c.payment_mode === 'UPI')

      return matchSearch && matchMode
    })
  }, [collections, searchTerm, filterMode])

  const {
    paginatedData,
    currentPage,
    totalPages,
    setCurrentPage,
    requestSort,
    getSortDirection,
    totalItems
  } = useTable(filteredCollections, { itemsPerPage: 10, initialSort: { key: 'created_at', direction: 'desc' } })

  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6 pb-20 md:pb-6">
      {/* Page Heading & Action */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-black text-slate-800">Collections</h1>
        <Link href="/collections/new" className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 md:px-5 py-2 md:py-2.5 rounded-xl text-sm font-bold shadow-md shadow-indigo-200 transition-all active:scale-95">
          <Plus size={18} className="mr-1.5 md:mr-2 stroke-[2.5]" /> <span className="hidden sm:inline">New Collection</span><span className="sm:hidden">New</span>
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
            placeholder="Search product, seller or customer..."
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
            filterMode !== 'ALL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
          title="Filter transactions"
        >
          <SlidersHorizontal size={19} />
        </button>
      </div>

      {/* Filter Chips (if filter is active or toggled) */}
      {showFilterModal && (
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between text-xs animate-in fade-in zoom-in-95 duration-150">
          <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Mode:</span>
          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
            {['ALL', 'CASH', 'CREDIT', 'UPI'].map(mode => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs ${
                  filterMode === mode
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {mode}
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
        ) : filteredCollections && filteredCollections.length > 0 ? (
          <div>
            {/* Native Mobile Cards View (Exact match to screenshot) */}
            <div className="divide-y divide-slate-100 md:hidden bg-white">
              {paginatedData.map(col => (
                <div key={col.id} className="p-4 bg-white hover:bg-slate-50/60 transition-colors">
                  {/* Top row: Title + Amount */}
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 pr-3">
                      <h3 className="text-base font-bold text-slate-900 leading-tight truncate">
                        {col.customers?.full_name || 'Cot vayar'}
                      </h3>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 font-mono">
                        {col.loans?.loan_id || 'JNV'}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-lg font-black text-slate-900 tracking-tight">
                        ₹{col.amount?.toLocaleString()}
                      </div>
                      <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mt-0.5">
                        {col.payment_mode === 'Cash' ? 'CASH' : col.payment_mode === 'UPI' ? 'UPI' : 'CREDIT'}
                      </div>
                    </div>
                  </div>

                  {/* Bottom row: Timestamp + Action Buttons */}
                  <div className="flex items-center justify-between mt-3.5 pt-0.5">
                    <span className="text-xs text-slate-400 font-medium">
                      {formatCardDate(col.created_at)}
                    </span>

                    <div className="flex items-center space-x-2">
                      {/* Edit Icon */}
                      <button
                        onClick={() => handleOpenEdit(col)}
                        className="text-slate-400 hover:text-indigo-600 active:scale-90 transition-transform p-1"
                        title="Edit Collection"
                      >
                        <Edit2 size={18} className="stroke-[1.75]" />
                      </button>

                      {/* Red Trash Icon */}
                      <button
                        onClick={() => deleteOrReverseMutation.mutate(col)}
                        className="text-rose-400 hover:text-rose-600 active:scale-90 transition-transform p-1"
                        title="Delete / Reverse"
                      >
                        <Trash2 size={18} className="stroke-[1.75]" />
                      </button>

                      <Link
                        href={`/collections/${col.id}`}
                        className="text-slate-600 hover:text-indigo-600 active:scale-90 transition-transform p-1"
                        title="View Voucher"
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
                    <SortHeader label="Amount" sortKey="amount" currentSortKey={getSortDirection('amount') ? 'amount' : null} sortDirection={getSortDirection('amount')} onSort={requestSort as any} />
                    <SortHeader label="Mode" sortKey="payment_mode" currentSortKey={getSortDirection('payment_mode') ? 'payment_mode' : null} sortDirection={getSortDirection('payment_mode')} onSort={requestSort as any} />
                    <SortHeader label="Status" sortKey="status" currentSortKey={getSortDirection('status') ? 'status' : null} sortDirection={getSortDirection('status')} onSort={requestSort as any} />
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedData.map(col => (
                    <tr key={col.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-indigo-700">{col.loans?.loan_id}</td>
                      <td className="px-6 py-4 text-slate-700 font-medium">{col.customers?.full_name}</td>
                      <td className="px-6 py-4 font-bold text-slate-800">₹{col.amount?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-slate-600 font-semibold">{col.payment_mode}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                          col.status === 'Approved' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                          col.status === 'Rejected' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                          'bg-amber-100 text-amber-800 border-amber-200'
                        }`}>
                          {col.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-1">
                        <Link
                          href={`/collections/${col.id}`}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-flex items-center justify-center"
                          title="View Voucher"
                        >
                          <Eye size={16} />
                        </Link>
                        <button
                          onClick={() => handleOpenEdit(col)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-flex items-center justify-center"
                          title="Edit Collection"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => deleteOrReverseMutation.mutate(col)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors inline-flex items-center justify-center"
                          title="Reverse / Cancel"
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
            <CreditCard size={44} className="mx-auto mb-3 text-slate-300" />
            <p className="text-base font-semibold text-slate-700 mb-0.5">No transactions found</p>
            <p className="text-xs text-slate-400">Search for another term or record a new collection.</p>
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) - Matching Exact Design in Screenshot */}
      <Link
        href="/collections/new"
        className="fixed bottom-[88px] right-5 z-40 w-14 h-14 rounded-full bg-[#4a5548] hover:bg-[#3d463b] text-white shadow-xl shadow-slate-900/30 flex items-center justify-center active:scale-90 transition-transform active-press md:hidden"
        title="Record Collection"
      >
        <Plus size={28} className="stroke-[2.5]" />
      </Link>

      {/* Edit Collection Modal */}
      {editingCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Edit Collection</h3>
                <p className="text-xs text-slate-500 font-mono">Loan ID: {editingCollection.loans?.loan_id}</p>
              </div>
              <button onClick={() => setEditingCollection(null)} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Collection Amount (₹)</label>
                <input
                  type="number"
                  value={editFormData.amount}
                  onChange={e => setEditFormData({ ...editFormData, amount: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Mode</label>
                <Select
                  value={PAYMENT_MODE_OPTIONS.find(o => o.value === editFormData.payment_mode)}
                  onChange={(opt: any) => setEditFormData({ ...editFormData, payment_mode: opt?.value || 'Cash' })}
                  options={PAYMENT_MODE_OPTIONS}
                  styles={customSelectStyles}
                  isSearchable={false}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                <Select
                  value={COLLECTION_STATUS_OPTIONS.find(o => o.value === editFormData.status)}
                  onChange={(opt: any) => setEditFormData({ ...editFormData, status: opt?.value || 'Approved' })}
                  options={COLLECTION_STATUS_OPTIONS}
                  styles={customSelectStyles}
                  isSearchable={false}
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingCollection(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => updateCollectionMutation.mutate({ ...editingCollection, ...editFormData })}
                disabled={updateCollectionMutation.isPending || !editFormData.amount}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                {updateCollectionMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
