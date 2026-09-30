"use client";

import { useState, useMemo } from 'react'
import { UserPlus, Phone, Search, SlidersHorizontal, ChevronRight, User, X, Plus, Edit2, Trash2, Eye } from 'lucide-react'
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Select from 'react-select'
import { customSelectStyles } from '@/components/ui/SelectStyles'
import { supabase } from '@/lib/supabase'
import { useTable } from '@/hooks/useTable'
import { Pagination } from '@/components/ui/Pagination'
import { SortHeader } from '@/components/ui/SortHeader'
import { useAppStore } from '@/store/appStore'

const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
  { value: 'Defaulted', label: 'Defaulted' }
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

export default function Customers() {
  const profile = useAppStore(state => state.profile)
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<any>(null)
  const [editFormData, setEditFormData] = useState({
    full_name: '',
    mobile_number: '',
    status: 'Active',
    address: '',
    nominee_name: '',
    nominee_mobile: ''
  })

  const { data: customers, isLoading, isError } = useQuery({
    queryKey: ['customers', profile?.id],
    queryFn: async () => {
      let query = supabase
        .from('customers')
        .select('*, centers!inner(branch_id, name)')
        .order('created_at', { ascending: false })

      if (profile?.role === 'Staff' && profile?.center_id) {
        query = query.eq('center_id', profile.center_id)
      } else if (profile?.role === 'Manager' && profile?.branch_id) {
        query = query.eq('centers.branch_id', profile.branch_id)
      }
      
      const { data, error } = await query
      if (error) throw error
      return data
    },
    enabled: !!profile
  })

  // Update Customer Mutation
  const updateCustomerMutation = useMutation({
    mutationFn: async (updated: any) => {
      const { error } = await supabase
        .from('customers')
        .update({
          full_name: updated.full_name,
          mobile_number: updated.mobile_number,
          status: updated.status,
          address: updated.address || null,
          nominee_name: updated.nominee_name || null,
          nominee_mobile: updated.nominee_mobile || null
        })
        .eq('id', updated.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setEditingCustomer(null)
    },
    onError: (err: any) => alert(`Failed to update customer: ${err.message}`)
  })

  // Delete Customer Mutation
  const deleteCustomerMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (err: any) => {
      alert(`Cannot delete customer: ${err.message || 'This customer might have active loans or collection records.'}`)
    }
  })

  const handleDeleteCustomer = (customer: any) => {
    if (confirm(`Are you sure you want to delete customer "${customer.full_name}" (${customer.client_id})?`)) {
      deleteCustomerMutation.mutate(customer.id)
    }
  }

  const handleOpenEdit = (customer: any) => {
    setEditingCustomer(customer)
    setEditFormData({
      full_name: customer.full_name || '',
      mobile_number: customer.mobile_number || '',
      status: customer.status || 'Active',
      address: customer.address || '',
      nominee_name: customer.nominee_name || '',
      nominee_mobile: customer.nominee_mobile || ''
    })
  }

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    if (!customers) return []
    return customers.filter(c => {
      const matchSearch =
        !searchTerm.trim() ||
        c.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.client_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.mobile_number?.includes(searchTerm) ||
        (c.centers as any)?.name?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchStatus =
        filterStatus === 'ALL' ||
        (filterStatus === 'ACTIVE' && c.status === 'Active') ||
        (filterStatus === 'INACTIVE' && c.status !== 'Active')

      return matchSearch && matchStatus
    })
  }, [customers, searchTerm, filterStatus])

  const {
    paginatedData,
    currentPage,
    totalPages,
    setCurrentPage,
    requestSort,
    getSortDirection,
    totalItems
  } = useTable(filteredCustomers, { itemsPerPage: 10, initialSort: { key: 'created_at', direction: 'desc' } })

  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6 pb-20 md:pb-6">
      {/* Page Heading & Action */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-black text-slate-800">Customers</h1>
        <Link href="/customers/new" className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 md:px-5 py-2 md:py-2.5 rounded-xl text-sm font-bold shadow-md shadow-indigo-200 transition-all active:scale-95">
          <Plus size={18} className="mr-1.5 md:mr-2 stroke-[2.5]" /> <span className="hidden sm:inline">New Customer</span><span className="sm:hidden">New</span>
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
            placeholder="Search customer, mobile or client ID..."
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
          title="Filter customers"
        >
          <SlidersHorizontal size={19} />
        </button>
      </div>

      {/* Filter Chips */}
      {showFilterModal && (
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between text-xs animate-in fade-in zoom-in-95 duration-150">
          <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Status:</span>
          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
            {['ALL', 'ACTIVE', 'INACTIVE'].map(st => (
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
        ) : isError ? (
          <div className="flex items-center justify-center h-[360px] text-rose-500 text-sm p-4 text-center">
            Error loading customers. Please check your connection.
          </div>
        ) : filteredCustomers && filteredCustomers.length > 0 ? (
          <div>
            {/* Native Mobile Cards View (Exact match to screenshot) */}
            <div className="divide-y divide-slate-100 md:hidden bg-white">
              {paginatedData.map((customer) => (
                <div key={customer.id} className="p-4 bg-white hover:bg-slate-50/60 transition-colors">
                  {/* Top row: Title + ID */}
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 pr-3">
                      <Link href={`/customers/${customer.id}`} className="block">
                        <h3 className="text-base font-bold text-slate-900 leading-tight truncate">
                          {customer.full_name}
                        </h3>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 font-mono">
                          {customer.client_id} {(customer.centers as any)?.name ? `• ${(customer.centers as any).name}` : ''}
                        </p>
                      </Link>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-slate-700">
                        {customer.mobile_number || 'No Mobile'}
                      </div>
                      <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mt-0.5">
                        {customer.status || 'ACTIVE'}
                      </div>
                    </div>
                  </div>

                  {/* Bottom row: Timestamp + Action Buttons */}
                  <div className="flex items-center justify-between mt-3.5 pt-0.5">
                    <span className="text-xs text-slate-400 font-medium">
                      {formatCardDate(customer.created_at)}
                    </span>

                    <div className="flex items-center space-x-2">
                      {customer.mobile_number && (
                        <a
                          href={`tel:${customer.mobile_number}`}
                          className="text-slate-600 hover:text-indigo-600 active:scale-90 transition-transform p-1"
                          title="Call Customer"
                        >
                          <Phone size={17} className="stroke-[1.75]" />
                        </a>
                      )}
                      <button
                        onClick={() => handleOpenEdit(customer)}
                        className="text-slate-400 hover:text-indigo-600 active:scale-90 transition-transform p-1"
                        title="Edit Customer"
                      >
                        <Edit2 size={17} className="stroke-[1.75]" />
                      </button>
                      <button
                        onClick={() => handleDeleteCustomer(customer)}
                        className="text-slate-400 hover:text-rose-600 active:scale-90 transition-transform p-1"
                        title="Delete Customer"
                      >
                        <Trash2 size={17} className="stroke-[1.75]" />
                      </button>
                      <Link
                        href={`/customers/${customer.id}`}
                        className="text-slate-600 hover:text-slate-900 active:scale-90 transition-transform p-1"
                        title="View Profile"
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
                    <SortHeader label="Client ID" sortKey="client_id" currentSortKey={getSortDirection('client_id') ? 'client_id' : null} sortDirection={getSortDirection('client_id')} onSort={requestSort as any} />
                    <SortHeader label="Name" sortKey="full_name" currentSortKey={getSortDirection('full_name') ? 'full_name' : null} sortDirection={getSortDirection('full_name')} onSort={requestSort as any} />
                    <SortHeader label="Mobile" sortKey="mobile_number" currentSortKey={getSortDirection('mobile_number') ? 'mobile_number' : null} sortDirection={getSortDirection('mobile_number')} onSort={requestSort as any} />
                    <SortHeader label="Status" sortKey="status" currentSortKey={getSortDirection('status') ? 'status' : null} sortDirection={getSortDirection('status')} onSort={requestSort as any} />
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedData.map((customer) => (
                    <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-indigo-700">{customer.client_id}</td>
                      <td className="px-6 py-4 font-medium text-slate-800">{customer.full_name}</td>
                      <td className="px-6 py-4 text-slate-600">{customer.mobile_number}</td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {customer.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-1">
                        <Link
                          href={`/customers/${customer.id}`}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-flex items-center justify-center"
                          title="View Profile"
                        >
                          <Eye size={16} />
                        </Link>
                        <button
                          onClick={() => handleOpenEdit(customer)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-flex items-center justify-center"
                          title="Edit Customer"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteCustomer(customer)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors inline-flex items-center justify-center"
                          title="Delete Customer"
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
            <UserPlus size={44} className="mx-auto mb-3 text-slate-300" />
            <p className="text-base font-semibold text-slate-700 mb-0.5">No customers found</p>
            <p className="text-xs text-slate-400">Search for another term or create a new KYC profile.</p>
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) - Matching Exact Design in Screenshot */}
      <Link
        href="/customers/new"
        className="fixed bottom-[88px] right-5 z-40 w-14 h-14 rounded-full bg-[#4a5548] hover:bg-[#3d463b] text-white shadow-xl shadow-slate-900/30 flex items-center justify-center active:scale-90 transition-transform active-press md:hidden"
        title="New Customer KYC"
      >
        <Plus size={28} className="stroke-[2.5]" />
      </Link>

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Edit Customer Profile</h3>
                <p className="text-xs text-slate-500 font-mono">Client ID: {editingCustomer.client_id}</p>
              </div>
              <button onClick={() => setEditingCustomer(null)} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.full_name}
                    onChange={e => setEditFormData({ ...editFormData, full_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={editFormData.mobile_number}
                    onChange={e => setEditFormData({ ...editFormData, mobile_number: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                <Select
                  value={STATUS_OPTIONS.find(o => o.value === editFormData.status)}
                  onChange={(opt: any) => setEditFormData({ ...editFormData, status: opt?.value || 'Active' })}
                  options={STATUS_OPTIONS}
                  styles={customSelectStyles}
                  isSearchable={false}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Residential Address</label>
                <textarea
                  rows={2}
                  value={editFormData.address}
                  onChange={e => setEditFormData({ ...editFormData, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nominee Name</label>
                  <input
                    type="text"
                    value={editFormData.nominee_name}
                    onChange={e => setEditFormData({ ...editFormData, nominee_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nominee Mobile</label>
                  <input
                    type="tel"
                    value={editFormData.nominee_mobile}
                    onChange={e => setEditFormData({ ...editFormData, nominee_mobile: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => updateCustomerMutation.mutate({ ...editingCustomer, ...editFormData })}
                disabled={updateCustomerMutation.isPending || !editFormData.full_name || !editFormData.mobile_number}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                {updateCustomerMutation.isPending ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
