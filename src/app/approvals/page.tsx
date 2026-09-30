"use client";

import { useState } from 'react'
import { CheckCircle2, XCircle, MapPin, MessageSquare } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/store/appStore'
import { useTable } from '@/hooks/useTable'
import { Pagination } from '@/components/ui/Pagination'
import { formatPostCollectionMessage, getWhatsAppClickToChatUrl } from '@/lib/whatsapp'

export default function Approvals() {
  const [activeTab, setActiveTab] = useState<'collections' | 'disbursements' | 'reversals'>('collections')
  
  // Inspection & Approval Modals
  const [inspectModalOpen, setInspectModalOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [selectedDisbursement, setSelectedDisbursement] = useState<any | null>(null)
  const [selectedCollection, setSelectedCollection] = useState<any | null>(null)
  
  // Action form states
  const [rejectionReason, setRejectionReason] = useState('')
  const [firstEmiDate, setFirstEmiDate] = useState('')

  const user = useAppStore(state => state.user)
  const queryClient = useQueryClient()

  // 1. Pending Collections Query
  const { data: collections } = useQuery({
    queryKey: ['pending-collections'],
    queryFn: async () => {
      const { data } = await supabase
        .from('collections')
        .select('*, customers(full_name, client_id, mobile_number), loans(loan_id, principal_amount, emi_amount)')
        .eq('status', 'Pending Approval')
        .order('created_at', { ascending: false })
      return data || []
    }
  })

  // 2. Pending Disbursements Query
  const { data: disbursements } = useQuery({
    queryKey: ['pending-disbursements'],
    queryFn: async () => {
      const { data } = await supabase
        .from('loans')
        .select('*, customers(full_name, client_id, mobile_number, address, nominee_name, nominee_relationship, nominee_mobile, gps_location, photo_url), loan_products(name, type, interest_rate)')
        .eq('status', 'Pending Approval')
        .order('created_at', { ascending: false })
      return data || []
    }
  })

  // 3. Approved Collections (for Reversal / Audit tab)
  const { data: approvedCollections } = useQuery({
    queryKey: ['approved-collections-reversal'],
    queryFn: async () => {
      const { data } = await supabase
        .from('collections')
        .select('*, customers(full_name, client_id), loans(loan_id)')
        .eq('status', 'Approved')
        .order('created_at', { ascending: false })
        .limit(20)
      return data || []
    },
    enabled: activeTab === 'reversals'
  })

  // Approve / Reject Collection Mutation
  const updateCollection = useMutation({
    mutationFn: async ({ id, status, rejection_reason }: { id: string; status: string; rejection_reason?: string }) => {
      const payload: any = {
        status,
        approved_by: user?.id || null,
        approved_at: new Date().toISOString()
      }
      if (rejection_reason) payload.rejection_reason = rejection_reason
      const { error } = await supabase.from('collections').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-collections'] })
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      setRejectModalOpen(false)
      setInspectModalOpen(false)
      setRejectionReason('')
      setSelectedCollection(null)
    }
  })

  // Reverse Approved Collection Mutation (Section 9: Authorized Reversal Process)
  const reverseCollection = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const payload: any = {
        status: 'Reversed',
        rejection_reason: `Reversed: ${reason}`,
        approved_at: new Date().toISOString()
      }
      const { error } = await supabase.from('collections').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approved-collections-reversal'] })
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      setSelectedCollection(null)
      alert('Voucher successfully reversed.')
    }
  })

  // Approve / Reject Disbursement Mutation (Section 14 & 15: Manager First EMI Control)
  const updateDisbursement = useMutation({
    mutationFn: async ({ id, status, rejection_reason, confirmedFirstEmi }: { id: string; status: string; rejection_reason?: string; confirmedFirstEmi?: string }) => {
      const payload: any = {
        status: status === 'Approved' ? 'Active' : 'Rejected',
        approved_by: user?.id || null,
        approved_at: new Date().toISOString()
      }
      if (status === 'Approved') {
        payload.disbursement_date = new Date().toISOString().split('T')[0]
      }
      if (rejection_reason) payload.rejection_reason = rejection_reason
      if (confirmedFirstEmi) payload.first_emi_date = confirmedFirstEmi

      const { error } = await supabase.from('loans').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-disbursements'] })
      queryClient.invalidateQueries({ queryKey: ['loans'] })
      setRejectModalOpen(false)
      setInspectModalOpen(false)
      setRejectionReason('')
      setFirstEmiDate('')
      setSelectedDisbursement(null)
    }
  })

  // Pagination & Sorting hooks
  const {
    paginatedData: paginatedCollections,
    currentPage: colPage,
    totalPages: colTotalPages,
    setCurrentPage: setColPage,
    requestSort: reqColSort,
    getSortDirection: getColSort,
    totalItems: colTotalItems
  } = useTable(collections || [], { itemsPerPage: 10, initialSort: { key: 'created_at', direction: 'desc' } })

  const {
    paginatedData: paginatedDisbursements,
    currentPage: disPage,
    totalPages: disTotalPages,
    setCurrentPage: setDisPage,
    requestSort: reqDisSort,
    getSortDirection: getDisSort,
    totalItems: disTotalItems
  } = useTable(disbursements || [], { itemsPerPage: 10, initialSort: { key: 'created_at', direction: 'desc' } })

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Maker–Checker Approvals</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Manager verification gate for Loan Disbursements and Field Collection Vouchers.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-bold text-slate-600">
          <button
            onClick={() => setActiveTab('collections')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'collections' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Collections ({collections?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('disbursements')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'disbursements' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Disbursements ({disbursements?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('reversals')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'reversals' ? 'bg-white text-rose-700 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Reversal Control
          </button>
        </div>
      </div>

      {/* Tab 1: Pending Collections */}
      {activeTab === 'collections' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="font-bold text-slate-800 text-sm">Pending Collection Vouchers ({colTotalItems})</h2>
            <span className="text-xs text-slate-500">Requires Maker–Checker Verification</span>
          </div>

          {/* Native Mobile Cards View (< md) */}
          <div className="divide-y divide-slate-100 md:hidden">
            {paginatedCollections.map((col: any) => (
              <div key={col.id} className="p-3.5 space-y-2.5 bg-white">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 text-sm">{col.customers?.full_name}</span>
                      <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                        {col.customers?.client_id}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">Loan: {col.loans?.loan_id}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-slate-900 block">₹{col.amount.toLocaleString()}</span>
                    <span className={`inline-block px-2 py-0.2 rounded text-[10px] font-bold ${
                      col.payment_mode === 'Cash' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-purple-50 text-purple-700 border border-purple-200'
                    }`}>
                      {col.payment_mode}
                    </span>
                  </div>
                </div>

                {col.utr_number && (
                  <p className="text-[11px] text-slate-500 font-mono bg-slate-50 p-1.5 rounded border border-slate-100">
                    Ref / UTR: {col.utr_number}
                  </p>
                )}

                {/* Touch Action Buttons */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    onClick={() => {
                      setSelectedCollection(col)
                      setInspectModalOpen(true)
                    }}
                    className="py-2 rounded-xl bg-slate-100 active:bg-slate-200 text-slate-700 font-bold text-xs transition-colors active-press text-center"
                  >
                    Inspect
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCollection(col)
                      setRejectModalOpen(true)
                    }}
                    className="py-2 rounded-xl bg-rose-50 active:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition-colors active-press text-center"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => updateCollection.mutate({ id: col.id, status: 'Approved' })}
                    className="py-2 rounded-xl bg-emerald-600 active:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors active-press text-center"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
            {!paginatedCollections.length && (
              <div className="p-8 text-center text-slate-400 text-xs">
                No pending collections requiring approval. All vouchers up to date!
              </div>
            )}
          </div>

          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-3">Client ID</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Loan ID</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Mode & Proof</th>
                  <th className="px-5 py-3">Submitted</th>
                  <th className="px-5 py-3 text-right">Verification Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedCollections.map((col: any) => (
                  <tr key={col.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-800">{col.customers?.client_id}</td>
                    <td className="px-5 py-3.5 font-medium text-slate-800">{col.customers?.full_name}</td>
                    <td className="px-5 py-3.5 font-mono text-indigo-700 font-semibold">{col.loans?.loan_id}</td>
                    <td className="px-5 py-3.5 font-black text-slate-900">₹{col.amount.toLocaleString()}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        col.payment_mode === 'Cash' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-purple-50 text-purple-700 border border-purple-200'
                      }`}>
                        {col.payment_mode}
                      </span>
                      {col.utr_number && <p className="text-[10px] text-slate-500 font-mono mt-0.5">Ref: {col.utr_number}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{new Date(col.created_at).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5 text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedCollection(col)
                          setInspectModalOpen(true)
                        }}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
                      >
                        Inspect
                      </button>
                      <button
                        onClick={() => updateCollection.mutate({ id: col.id, status: 'Approved' })}
                        className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCollection(col)
                          setRejectModalOpen(true)
                        }}
                        className="px-3 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs transition-colors"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
                {!paginatedCollections.length && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      No pending collections requiring approval. All vouchers up to date!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={colPage} totalPages={colTotalPages} onPageChange={setColPage} totalItems={colTotalItems} />
        </div>
      )}

      {/* Tab 2: Pending Disbursements */}
      {activeTab === 'disbursements' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="font-bold text-slate-800 text-sm">Pending Loan Disbursements ({disTotalItems})</h2>
            <span className="text-xs text-slate-500">Requires Manager Verification & First EMI Setup</span>
          </div>

          {/* Native Mobile Cards View (< md) */}
          <div className="divide-y divide-slate-100 md:hidden">
            {paginatedDisbursements.map((loan: any) => (
              <div key={loan.id} className="p-3.5 space-y-2.5 bg-white">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 text-sm">{loan.customers?.full_name}</span>
                      <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                        {loan.customers?.client_id}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-500 font-mono mt-0.5">
                      <span className="font-bold text-indigo-700">{loan.loan_id}</span>
                      <span>•</span>
                      <span>{loan.loan_products?.name || 'Loan'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-slate-900 block">₹{loan.principal_amount?.toLocaleString()}</span>
                    <span className="text-[10px] text-indigo-600 font-bold">EWI: ₹{loan.emi_amount || 'N/A'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                  <span>Tenure: <strong className="text-slate-700">{loan.tenure_weeks ? `${loan.tenure_weeks} Weeks` : 'N/A'}</strong></span>
                  <span>1st Due: <strong className="text-slate-700">{loan.first_emi_date || 'Pending Setup'}</strong></span>
                </div>

                {/* Touch Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => {
                      setSelectedDisbursement(loan)
                      setRejectModalOpen(true)
                    }}
                    className="py-2 rounded-xl bg-rose-50 active:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition-colors active-press text-center"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => {
                      setSelectedDisbursement(loan)
                      setFirstEmiDate(loan.first_emi_date || '')
                      setInspectModalOpen(true)
                    }}
                    className="py-2 rounded-xl bg-indigo-600 active:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors active-press text-center"
                  >
                    Inspect & Approve
                  </button>
                </div>
              </div>
            ))}
            {!paginatedDisbursements.length && (
              <div className="p-8 text-center text-slate-400 text-xs">
                No pending loan disbursements requiring approval.
              </div>
            )}
          </div>

          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-3">Loan ID</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Principal</th>
                  <th className="px-5 py-3">Tenure / EMI</th>
                  <th className="px-5 py-3">First Due Date</th>
                  <th className="px-5 py-3 text-right">Approval Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedDisbursements.map((loan: any) => (
                  <tr key={loan.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-indigo-700">{loan.loan_id}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-slate-800">{loan.customers?.full_name}</p>
                      <p className="text-[11px] font-mono text-slate-500">{loan.customers?.client_id}</p>
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 font-medium">{loan.loan_products?.name || 'Loan'}</td>
                    <td className="px-5 py-3.5 font-extrabold text-slate-900">₹{loan.principal_amount.toLocaleString()}</td>
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-indigo-600">₹{loan.emi_amount || 'N/A'}</span>
                      <span className="text-[11px] text-slate-500 block">{loan.tenure_weeks ? `${loan.tenure_weeks} Weeks` : 'N/A'}</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 text-xs">{loan.first_emi_date || 'Pending Setup'}</td>
                    <td className="px-5 py-3.5 text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedDisbursement(loan)
                          setFirstEmiDate(loan.first_emi_date || '')
                          setInspectModalOpen(true)
                        }}
                        className="px-3 py-1.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs border border-indigo-200 transition-colors"
                      >
                        Inspect & Approve
                      </button>
                      <button
                        onClick={() => {
                          setSelectedDisbursement(loan)
                          setRejectModalOpen(true)
                        }}
                        className="px-3 py-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs border border-rose-200 transition-colors"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
                {!paginatedDisbursements.length && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      No pending loan disbursements requiring approval.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={disPage} totalPages={disTotalPages} onPageChange={setDisPage} totalItems={disTotalItems} />
        </div>
      )}

      {/* Tab 3: Reversal Control (SRS Section 9) */}
      {activeTab === 'reversals' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h2 className="font-bold text-slate-800 text-sm">Authorized Voucher Reversal & Correction</h2>
              <p className="text-xs text-slate-500">
                Approved vouchers cannot be deleted; execute an authorized reversal with mandatory audit note.
              </p>
            </div>
            <span className="text-xs font-mono bg-rose-50 text-rose-700 px-2.5 py-1 rounded border border-rose-200">
              Audit Guard Active
            </span>
          </div>

          {/* Native Mobile Cards View (< md) */}
          <div className="divide-y divide-slate-100 md:hidden">
            {approvedCollections?.map((col: any) => (
              <div key={col.id} className="p-3.5 space-y-2 bg-white">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 text-sm">{col.customers?.full_name}</span>
                      <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {col.customers?.client_id}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">Loan: {col.loans?.loan_id}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-emerald-700 block">₹{col.amount.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-400">{new Date(col.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    onClick={() => {
                      const reason = prompt(`Enter mandatory reversal reason for voucher of ₹${col.amount}:`)
                      if (reason && reason.trim()) {
                        reverseCollection.mutate({ id: col.id, reason: reason.trim() })
                      }
                    }}
                    className="w-full py-2 rounded-xl bg-rose-50 active:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition-colors active-press text-center"
                  >
                    Authorize Reversal
                  </button>
                </div>
              </div>
            ))}
            {!approvedCollections?.length && (
              <div className="p-8 text-center text-slate-400 text-xs">No approved transactions.</div>
            )}
          </div>

          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-5 py-3">Client ID</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Loan ID</th>
                  <th className="px-5 py-3">Approved Amount</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3 text-right">Reversal Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {approvedCollections?.map((col: any) => (
                  <tr key={col.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-3 font-mono font-bold">{col.customers?.client_id}</td>
                    <td className="px-5 py-3 font-medium">{col.customers?.full_name}</td>
                    <td className="px-5 py-3 font-mono text-indigo-700">{col.loans?.loan_id}</td>
                    <td className="px-5 py-3 font-bold text-emerald-700">₹{col.amount.toLocaleString()}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{new Date(col.created_at).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => {
                          const reason = prompt(`Enter mandatory reversal reason for voucher of ₹${col.amount}:`)
                          if (reason && reason.trim()) {
                            reverseCollection.mutate({ id: col.id, reason: reason.trim() })
                          }
                        }}
                        className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs"
                      >
                        Authorize Reversal
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* INSPECTION MODAL: Disbursement Checker & First EMI Setup */}
      {inspectModalOpen && selectedDisbursement && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Verify Loan Disbursement</h3>
                <span className="text-xs font-mono text-indigo-700 font-bold">
                  {selectedDisbursement.loan_id} (Cycle {selectedDisbursement.cycle_number})
                </span>
              </div>
              <button onClick={() => setInspectModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">
                ×
              </button>
            </div>

            {/* Customer & Nominee Details */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
              <div>
                <span className="text-slate-500 block text-[10px]">Customer Name</span>
                <span className="font-bold text-slate-800 text-sm">{selectedDisbursement.customers?.full_name}</span>
                <span className="text-slate-500 block mt-0.5">{selectedDisbursement.customers?.mobile_number}</span>
                <span className="text-slate-600 block mt-1">{selectedDisbursement.customers?.address}</span>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px]">Nominee & Relation</span>
                <span className="font-bold text-slate-800 text-sm">{selectedDisbursement.customers?.nominee_name || 'N/A'}</span>
                <span className="text-slate-600 block mt-0.5">
                  Relation: {selectedDisbursement.customers?.nominee_relationship || 'N/A'} • Mobile: {selectedDisbursement.customers?.nominee_mobile || 'N/A'}
                </span>
              </div>

              {selectedDisbursement.customers?.gps_location && (
                <div className="col-span-2 flex items-center text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                  <MapPin size={14} className="mr-1.5 shrink-0" />
                  <span className="font-mono text-[11px]">Field Location: {selectedDisbursement.customers?.gps_location}</span>
                </div>
              )}
            </div>

            {/* Financial Terms */}
            <div className="grid grid-cols-4 gap-3 text-center bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 mb-5">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500">Principal</span>
                <p className="text-base font-black text-slate-800">₹{selectedDisbursement.principal_amount.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500">Product</span>
                <p className="text-xs font-bold text-slate-700 mt-1">{selectedDisbursement.loan_products?.name || 'Loan'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500">Tenure</span>
                <p className="text-base font-black text-slate-800">{selectedDisbursement.tenure_weeks} Weeks</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500">Installment</span>
                <p className="text-base font-black text-indigo-700">₹{selectedDisbursement.emi_amount}</p>
              </div>
            </div>

            {/* Manager First EMI Control (SRS Section 15) */}
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 mb-6">
              <label className="block text-xs font-bold text-amber-900 mb-1">
                First EMI Date Confirmation & Setup (Manager Control) *
              </label>
              <p className="text-[11px] text-amber-700 mb-2">
                Manager confirms or updates the start date for future automated weekly demand generation.
              </p>
              <input
                type="date"
                required
                value={firstEmiDate}
                onChange={e => setFirstEmiDate(e.target.value)}
                className="w-full bg-white rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-600"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setInspectModalOpen(false)}
                className="px-4 py-2 rounded-lg text-slate-600 font-semibold text-xs hover:bg-slate-100 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  if (!firstEmiDate) {
                    alert('Please select the First EMI Date before approving.')
                    return
                  }
                  updateDisbursement.mutate({
                    id: selectedDisbursement.id,
                    status: 'Approved',
                    confirmedFirstEmi: firstEmiDate
                  })
                }}
                disabled={updateDisbursement.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-bold text-xs shadow-md transition-all active:scale-95"
              >
                {updateDisbursement.isPending ? 'Activating...' : 'Approve & Activate Loan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSPECTION MODAL: Collection Voucher Inspector & WhatsApp Dispatch */}
      {inspectModalOpen && selectedCollection && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-800">Verify Collection Voucher</h3>
              <button onClick={() => setInspectModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">
                ×
              </button>
            </div>

            <div className="space-y-3 text-xs mb-6">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Customer:</span>
                <span className="font-bold text-slate-800">{selectedCollection.customers?.full_name} ({selectedCollection.customers?.client_id})</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Loan Account:</span>
                <span className="font-mono font-bold text-indigo-700">{selectedCollection.loans?.loan_id}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Amount Collected:</span>
                <span className="font-black text-base text-slate-900">₹{selectedCollection.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Payment Mode:</span>
                <span className="font-bold text-slate-800">{selectedCollection.payment_mode}</span>
              </div>
              {selectedCollection.utr_number && (
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">UTR Reference:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedCollection.utr_number}</span>
                </div>
              )}
            </div>

            {/* Quick WhatsApp Dispatch Helper */}
            {selectedCollection.customers?.mobile_number && (
              <a
                href={getWhatsAppClickToChatUrl(
                  selectedCollection.customers.mobile_number,
                  formatPostCollectionMessage({
                    customerName: selectedCollection.customers.full_name,
                    mobileNumber: selectedCollection.customers.mobile_number,
                    loanId: selectedCollection.loans?.loan_id || 'N/A',
                    voucherNumber: selectedCollection.id.slice(0, 8).toUpperCase(),
                    amountPaid: selectedCollection.amount,
                    paymentDate: new Date().toISOString().split('T')[0],
                    paymentMode: selectedCollection.payment_mode,
                    utrNumber: selectedCollection.utr_number,
                    remainingOutstanding: Math.max(0, (selectedCollection.loans?.principal_amount || 0) - selectedCollection.amount)
                  })
                )}
                target="_blank"
                rel="noreferrer"
                className="w-full mb-4 inline-flex items-center justify-center bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 py-2 rounded-lg text-xs font-bold transition-colors"
              >
                <MessageSquare size={16} className="mr-1.5 text-emerald-600" />
                Send WhatsApp Receipt to Customer ({selectedCollection.customers.mobile_number})
              </a>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setInspectModalOpen(false)}
                className="px-4 py-2 rounded-lg text-slate-600 font-semibold text-xs hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => updateCollection.mutate({ id: selectedCollection.id, status: 'Approved' })}
                disabled={updateCollection.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-bold text-xs shadow-md"
              >
                {updateCollection.isPending ? 'Posting...' : 'Approve & Post to Ledger'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL (SRS Section 9 & 14: Mandatory Rejection Reason) */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-rose-700 flex items-center mb-2">
              <XCircle size={18} className="mr-2" /> Mandatory Rejection Reason
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Specify the reason for defect or rejection. This will be recorded and returned to the field staff.
            </p>

            <textarea
              required
              rows={3}
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="e.g. Cash denomination mismatch / Incomplete KYC document"
              className="w-full border border-slate-300 rounded-lg p-3 text-xs outline-none focus:border-rose-600 mb-4"
            />

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setRejectModalOpen(false)
                  setRejectionReason('')
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!rejectionReason.trim()) {
                    alert('Rejection reason is mandatory.')
                    return
                  }
                  if (selectedDisbursement) {
                    updateDisbursement.mutate({
                      id: selectedDisbursement.id,
                      status: 'Rejected',
                      rejection_reason: rejectionReason.trim()
                    })
                  } else if (selectedCollection) {
                    updateCollection.mutate({
                      id: selectedCollection.id,
                      status: 'Rejected',
                      rejection_reason: rejectionReason.trim()
                    })
                  }
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-lg text-xs font-bold"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
