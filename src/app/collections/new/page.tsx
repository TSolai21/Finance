"use client";

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Banknote, AlertCircle, X, Users, CheckCircle2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Select from 'react-select'
import { supabase } from '@/lib/supabase'
import { CashDenominations, calculateDenominationTotal } from '@/lib/cashManagement'
import { calculateLoanDemand } from '@/lib/installments'

interface CenterClientRow {
  loanId: string
  loanNumber: string
  customerId: string
  clientNumber: string
  customerName: string
  mobileNumber: string
  dueAmount: number
  collectedAmount: number
  paymentMode: 'Cash' | 'UPI'
  utrNumber: string
  status: 'Collected' | 'Not Collected'
}

export default function CollectionForm() {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Entry Mode: Center Bulk Collection Sheet vs Single Loan
  const [entryMode, setEntryMode] = useState<'center-bulk' | 'single'>('center-bulk')

  // Hierarchy selections
  const [selectedCenterId, setSelectedCenterId] = useState('')
  const [selectedLoanId, setSelectedLoanId] = useState('')

  // Single Entry details
  const [amount, setAmount] = useState('')
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Bank Transfer'>('Cash')
  const [utrNumber, setUtrNumber] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // Bulk Center Clients State
  const [clientRows, setClientRows] = useState<CenterClientRow[]>([])

  // Denominations State (for Cash collections)
  const [denominations, setDenominations] = useState<CashDenominations>({
    2000: 0,
    500: 0,
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    2: 0,
    1: 0
  })

  // Centers query
  const { data: centers } = useQuery({
    queryKey: ['centers-collections'],
    queryFn: async () => {
      const { data } = await supabase.from('centers').select('id, name, meeting_day, branches(name)')
      return data || []
    }
  })

  // Active Loans query with customers and centers
  const { data: activeLoans } = useQuery({
    queryKey: ['active-loans-full'],
    queryFn: async () => {
      const { data } = await supabase
        .from('loans')
        .select(`
          id,
          loan_id,
          cycle_number,
          principal_amount,
          tenure_weeks,
          emi_amount,
          first_emi_date,
          status,
          customer_id,
          customers (
            id,
            client_id,
            full_name,
            mobile_number,
            center_id,
            centers (id, name)
          )
        `)
        .eq('status', 'Active')
      return data || []
    }
  })

  // Filtered Loans based on selected Center
  const filteredLoans = useMemo(() => {
    if (!activeLoans) return []
    return activeLoans.filter(l => {
      const cust = l.customers as any
      if (selectedCenterId && cust?.center_id !== selectedCenterId) return false
      return true
    })
  }, [activeLoans, selectedCenterId])

  // Sync client rows when selected center changes
  useEffect(() => {
    if (!selectedCenterId) {
      setClientRows([])
      return
    }

    const rows: CenterClientRow[] = filteredLoans.map(l => {
      const cust = l.customers as any
      const due = l.emi_amount || Math.round((l.principal_amount || 15000) / 25)
      return {
        loanId: l.id,
        loanNumber: l.loan_id,
        customerId: l.customer_id,
        clientNumber: cust?.client_id || 'RF0000',
        customerName: cust?.full_name || 'Borrower',
        mobileNumber: cust?.mobile_number || '',
        dueAmount: due,
        collectedAmount: due, // Default to due amount for fast entry
        paymentMode: 'Cash',
        utrNumber: '',
        status: 'Collected'
      }
    })
    setClientRows(rows)
  }, [selectedCenterId, filteredLoans])

  // Selected Loan Object for Single Mode
  const currentLoan = useMemo(() => {
    return activeLoans?.find(l => l.id === selectedLoanId)
  }, [activeLoans, selectedLoanId])

  // Collections for this loan to calculate demand in Single Mode
  const { data: pastCollections } = useQuery({
    queryKey: ['loan-collections-count', selectedLoanId],
    queryFn: async () => {
      if (!selectedLoanId) return []
      const { data } = await supabase.from('collections').select('amount, status').eq('loan_id', selectedLoanId)
      return data || []
    },
    enabled: !!selectedLoanId
  })

  // Demand Metrics Calculation in Single Mode
  const demandInfo = useMemo(() => {
    if (!currentLoan) return null
    const approvedTotal = pastCollections?.filter(c => c.status === 'Approved').reduce((s, c) => s + c.amount, 0) || 0
    return calculateLoanDemand(
      currentLoan.principal_amount,
      currentLoan.emi_amount || (currentLoan.principal_amount / 25),
      approvedTotal,
      currentLoan.first_emi_date || undefined,
      currentLoan.tenure_weeks || undefined
    )
  }, [currentLoan, pastCollections])

  // Totals for Center Bulk Mode
  const bulkTotals = useMemo(() => {
    let totalDue = 0
    let totalCollected = 0
    let totalCash = 0
    let totalUpi = 0
    let collectedCount = 0
    let pendingCount = 0

    clientRows.forEach(row => {
      totalDue += row.dueAmount
      if (row.status === 'Collected' && row.collectedAmount > 0) {
        totalCollected += row.collectedAmount
        collectedCount++
        if (row.paymentMode === 'Cash') {
          totalCash += row.collectedAmount
        } else {
          totalUpi += row.collectedAmount
        }
      } else {
        pendingCount++
      }
    })

    return { totalDue, totalCollected, totalCash, totalUpi, collectedCount, pendingCount }
  }, [clientRows])

  // Calculate Cash Denomination Total
  const cashDenominationTotal = useMemo(() => {
    return calculateDenominationTotal(denominations)
  }, [denominations])

  // Expected Cash Total based on mode
  const targetCashAmount = entryMode === 'center-bulk' ? bulkTotals.totalCash : (paymentMode === 'Cash' ? parseFloat(amount || '0') : 0)

  // Update Denomination Count
  const handleDenomChange = (val: number, countStr: string) => {
    const count = parseInt(countStr) || 0
    setDenominations(prev => ({
      ...prev,
      [val]: Math.max(0, count)
    }))
  }

  // Auto-fill standard denominations for quick field entry
  const handleAutoFillDenominations = () => {
    let rem = targetCashAmount
    const newDenom: CashDenominations = { 2000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 }
    for (const val of [500, 200, 100, 50, 20, 10]) {
      if (rem >= val) {
        const count = Math.floor(rem / val)
        newDenom[val] = count
        rem %= val
      }
    }
    setDenominations(newDenom)
  }

  // Row update handlers for Center Bulk Sheet
  const updateRow = (index: number, updates: Partial<CenterClientRow>) => {
    setClientRows(prev => {
      const next = [...prev]
      next[index] = { ...next[index], ...updates }
      return next
    })
  }

  // Bulk Center Collection Submission Mutation
  const submitCenterBulkCollections = useMutation({
    mutationFn: async () => {
      setFormError(null)
      if (clientRows.length === 0) {
        throw new Error('No active loans found for this center.')
      }

      const activeCollectedRows = clientRows.filter(r => r.status === 'Collected' && r.collectedAmount > 0)
      if (activeCollectedRows.length === 0) {
        throw new Error('Please enter collection amounts for at least one client.')
      }

      // Check UPI UTR numbers
      for (const row of activeCollectedRows) {
        if (row.paymentMode === 'UPI' && !row.utrNumber.trim()) {
          throw new Error(`Please enter the UPI UTR / Transaction number for client ${row.customerName} (${row.clientNumber}).`)
        }
      }

      // Check Cash Denominations
      if (bulkTotals.totalCash > 0 && cashDenominationTotal !== bulkTotals.totalCash) {
        throw new Error(
          `Center Cash Denomination total (₹${cashDenominationTotal}) does not match Total Cash Collections (₹${bulkTotals.totalCash}). Please reconcile physical cash notes.`
        )
      }

      const voucherTimestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const insertPayloads = activeCollectedRows.map((row, idx) => ({
        loan_id: row.loanId,
        customer_id: row.customerId,
        amount: row.collectedAmount,
        payment_mode: row.paymentMode,
        utr_number: row.paymentMode === 'UPI' ? row.utrNumber.trim() : null,
        voucher_number: `VCH-${voucherTimestamp}-${Math.floor(1000 + idx * 10 + Math.random() * 9)}`,
        denominations: row.paymentMode === 'Cash' ? denominations : null,
        status: 'Pending Approval' // Maker-Checker gate
      }))

      const { data, error } = await supabase.from('collections').insert(insertPayloads).select()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      queryClient.invalidateQueries({ queryKey: ['pending-collections'] })
      alert(`Success! Successfully recorded collections for ${data.length} clients in this center. Submitted for Manager approval.`)
      router.push('/collections')
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to submit center collections.')
    }
  })

  // Single Collection Submission Mutation
  const createSingleCollection = useMutation({
    mutationFn: async () => {
      setFormError(null)
      if (!selectedLoanId) throw new Error('Please select an active loan.')
      const numAmount = parseFloat(amount)
      if (!numAmount || numAmount <= 0) throw new Error('Please enter a valid collection amount.')

      if (paymentMode === 'Cash' && cashDenominationTotal !== numAmount) {
        throw new Error(`Denomination tally (₹${cashDenominationTotal}) must match Collection Amount (₹${numAmount}).`)
      }

      if (paymentMode !== 'Cash' && !utrNumber.trim()) {
        throw new Error('Please enter the UTR / Transaction Reference Number.')
      }

      const voucherCode = `VCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`

      const { data, error } = await supabase
        .from('collections')
        .insert({
          loan_id: selectedLoanId,
          customer_id: currentLoan?.customer_id,
          amount: numAmount,
          payment_mode: paymentMode,
          utr_number: utrNumber || null,
          denominations: paymentMode === 'Cash' ? denominations : null,
          status: 'Pending Approval'
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      queryClient.invalidateQueries({ queryKey: ['pending-collections'] })
      router.push(`/collections/${data.id}`)
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to submit collection.')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (entryMode === 'center-bulk') {
      submitCenterBulkCollections.mutate()
    } else {
      createSingleCollection.mutate()
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => router.back()}>
      <div className="w-full sm:w-[600px] md:w-[900px] lg:w-[1100px] xl:w-[1250px] h-[95vh] sm:h-[90vh] bg-slate-50 rounded-t-[32px] sm:rounded-[32px] overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300 relative" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto my-3 sm:hidden shrink-0" />
        
        <div className="flex-1 overflow-y-auto touch-scroll px-4 sm:px-8 pb-12">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between sticky top-0 bg-slate-50/95 backdrop-blur-sm pt-4 pb-4 z-20 border-b border-slate-200/60 mb-6 gap-3">
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-xl font-black text-slate-800">Field Collection Entry</h1>
                <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-0.5 rounded border border-indigo-200 shrink-0">
                  RO Field Module
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">Enter meeting collections across center clients in a single page</p>
            </div>

            {/* Entry Mode Switcher */}
            <div className="flex items-center space-x-2">
              <div className="bg-slate-200/80 p-1 rounded-xl flex items-center text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setEntryMode('center-bulk')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    entryMode === 'center-bulk' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Center Bulk Sheet (All Clients)
                </button>
                <button
                  type="button"
                  onClick={() => setEntryMode('single')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    entryMode === 'single' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Single Loan Entry
                </button>
              </div>

              <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors active-press bg-white shadow-xs border border-slate-100">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Form Error Banner */}
          {formError && (
            <div className="mb-6 bg-rose-50 border-2 border-rose-300 text-rose-800 p-4 rounded-xl flex items-start space-x-3 text-xs font-semibold animate-in fade-in duration-200">
              <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-rose-900 mb-0.5">Validation Error</p>
                <p>{formError}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Center Selection */}
            <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                <h2 className="text-base font-bold text-slate-800">
                  {entryMode === 'center-bulk' ? '1. Select Center for Group Collection' : '1. Operational Hierarchy (Center & Loan)'}
                </h2>
                {selectedCenterId && (
                  <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    {filteredLoans.length} Active Borrowers in Center
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select Center *</label>
                  <Select
                    options={centers?.map(c => ({
                      value: c.id,
                      label: `${c.name} (${(c.branches as any)?.name || 'Branch'} • Meeting: ${c.meeting_day || 'N/A'})`
                    })) || []}
                    onChange={(opt) => {
                      setSelectedCenterId(opt?.value || '')
                      setSelectedLoanId('')
                    }}
                    isClearable
                    placeholder="-- Select Center to Load All Clients --"
                    styles={{
                      control: (base) => ({ ...base, borderColor: '#cbd5e1', borderRadius: '0.5rem', fontSize: '0.875rem' })
                    }}
                  />
                </div>

                {entryMode === 'single' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Select Borrower Loan *</label>
                    <Select
                      value={currentLoan ? {
                        value: currentLoan.id,
                        label: `${currentLoan.loan_id} • ${(currentLoan.customers as any)?.full_name} (${(currentLoan.customers as any)?.client_id})`
                      } : null}
                      options={filteredLoans.map(l => ({
                        value: l.id,
                        label: `${l.loan_id} • ${(l.customers as any)?.full_name} (${(l.customers as any)?.client_id}) • EWI: ₹${l.emi_amount || 'N/A'}`
                      }))}
                      onChange={(opt) => {
                        setSelectedLoanId(opt?.value || '')
                        if (opt) {
                          const l = activeLoans?.find(item => item.id === opt.value)
                          if (l?.emi_amount) setAmount(l.emi_amount.toString())
                        }
                      }}
                      placeholder="-- Search & Select Borrower Loan --"
                      isSearchable
                      styles={{
                        control: (base) => ({ ...base, borderColor: '#cbd5e1', borderRadius: '0.5rem', fontSize: '0.875rem' })
                      }}
                    />
                  </div>
                )}
              </div>
            </section>

            {/* CENTER BULK SHEET: ALL CLIENTS IN SINGLE PAGE */}
            {entryMode === 'center-bulk' && (
              <>
                <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/70">
                    <div>
                      <h2 className="text-base font-bold text-slate-800">
                        2. Center Collection Sheet ({clientRows.length} Clients)
                      </h2>
                      <p className="text-xs text-slate-500">Enter collection amounts, toggle Cash/UPI, and capture UTR numbers</p>
                    </div>

                    <div className="flex items-center space-x-2 text-xs">
                      <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md font-bold border border-emerald-200">
                        Collecting: {bulkTotals.collectedCount}
                      </span>
                      <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md font-medium">
                        Pending/Skip: {bulkTotals.pendingCount}
                      </span>
                    </div>
                  </div>

                  {clientRows.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-xs">
                      {selectedCenterId ? 'No active loan accounts found for this center.' : 'Please select a Center above to display all assigned borrowers.'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3">#</th>
                            <th className="px-4 py-3">Client & ID</th>
                            <th className="px-4 py-3">Loan ID</th>
                            <th className="px-4 py-3">Due Demand</th>
                            <th className="px-4 py-3 w-36">Collected Amount (₹)</th>
                            <th className="px-4 py-3">Mode</th>
                            <th className="px-4 py-3">UPI / UTR Number</th>
                            <th className="px-4 py-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-sans">
                          {clientRows.map((row, idx) => (
                            <tr key={row.loanId} className={row.status === 'Not Collected' ? 'bg-slate-50/70 opacity-60' : 'hover:bg-slate-50/50'}>
                              <td className="px-4 py-3 font-mono text-slate-400 font-medium">{idx + 1}</td>
                              <td className="px-4 py-3">
                                <p className="font-bold text-slate-800 text-sm">{row.customerName}</p>
                                <span className="font-mono text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                                  {row.clientNumber}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono font-bold text-slate-700">{row.loanNumber}</td>
                              <td className="px-4 py-3 font-mono font-bold text-slate-600">₹{row.dueAmount.toLocaleString()}</td>
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  min="0"
                                  value={row.collectedAmount || ''}
                                  onChange={e => updateRow(idx, { collectedAmount: parseFloat(e.target.value) || 0 })}
                                  disabled={row.status === 'Not Collected'}
                                  className="w-full font-mono font-black text-sm px-3 py-1.5 rounded-lg border border-slate-300 focus:border-indigo-600 outline-none bg-white text-slate-800"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                                  <button
                                    type="button"
                                    onClick={() => updateRow(idx, { paymentMode: 'Cash' })}
                                    className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all ${
                                      row.paymentMode === 'Cash' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500'
                                    }`}
                                  >
                                    Cash
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateRow(idx, { paymentMode: 'UPI' })}
                                    className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all ${
                                      row.paymentMode === 'UPI' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500'
                                    }`}
                                  >
                                    UPI
                                  </button>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {row.paymentMode === 'UPI' ? (
                                  <input
                                    type="text"
                                    value={row.utrNumber}
                                    onChange={e => updateRow(idx, { utrNumber: e.target.value })}
                                    placeholder="Enter UPI UTR #"
                                    className="w-full text-xs font-mono px-2.5 py-1.5 rounded-lg border border-indigo-300 focus:border-indigo-600 outline-none bg-indigo-50/30"
                                  />
                                ) : (
                                  <span className="text-slate-400 font-mono text-[11px]">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => updateRow(idx, {
                                    status: row.status === 'Collected' ? 'Not Collected' : 'Collected',
                                    collectedAmount: row.status === 'Collected' ? 0 : row.dueAmount
                                  })}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                                    row.status === 'Collected'
                                      ? 'bg-emerald-100 text-emerald-800 hover:bg-rose-50 hover:text-rose-700'
                                      : 'bg-slate-200 text-slate-700 hover:bg-emerald-100 hover:text-emerald-800'
                                  }`}
                                >
                                  {row.status === 'Collected' ? '✓ Collected' : '✕ Not Collected'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Center Financial Summary Footer */}
                  {clientRows.length > 0 && (
                    <div className="bg-slate-50 border-t border-slate-200 p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Center Demand</span>
                        <p className="text-lg font-black text-slate-800 font-mono mt-0.5">₹{bulkTotals.totalDue.toLocaleString()}</p>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-emerald-600 uppercase font-bold block">Total Cash Collected</span>
                        <p className="text-lg font-black text-emerald-700 font-mono mt-0.5">₹{bulkTotals.totalCash.toLocaleString()}</p>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-indigo-600 uppercase font-bold block">Total UPI Collected</span>
                        <p className="text-lg font-black text-indigo-700 font-mono mt-0.5">₹{bulkTotals.totalUpi.toLocaleString()}</p>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-indigo-200 bg-indigo-50/50">
                        <span className="text-[10px] text-indigo-900 uppercase font-bold block">Net Center Collection</span>
                        <p className="text-xl font-black text-indigo-950 font-mono mt-0.5">₹{bulkTotals.totalCollected.toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                </section>

                {/* TOTAL CENTER CASH DENOMINATION CALCULATOR */}
                {bulkTotals.totalCash > 0 && (
                  <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-slate-100 pb-3 gap-2">
                      <div className="flex items-center space-x-2">
                        <Banknote size={20} className="text-emerald-600" />
                        <div>
                          <h2 className="text-base font-bold text-slate-800">
                            3. Total Center Cash Denomination Breakdown
                          </h2>
                          <p className="text-xs text-slate-500">Reconcile physical cash notes collected across all center clients</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <button
                          type="button"
                          onClick={handleAutoFillDenominations}
                          className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200 hover:bg-indigo-100 transition-colors"
                        >
                          Auto-Tally Notes
                        </button>

                        <div className="text-xs font-mono">
                          Tally: <strong className={cashDenominationTotal === bulkTotals.totalCash ? 'text-emerald-600 font-bold text-sm' : 'text-rose-600 font-bold text-sm'}>
                            ₹{cashDenominationTotal.toLocaleString()}
                          </strong> / ₹{bulkTotals.totalCash.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                      {[500, 200, 100, 50, 20, 10].map(val => (
                        <div key={val} className="flex items-center space-x-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-xs">
                          <span className="text-xs font-bold text-slate-700 w-12 text-right">₹{val}:</span>
                          <input
                            type="number"
                            min="0"
                            value={denominations[val] || ''}
                            onChange={e => handleDenomChange(val, e.target.value)}
                            placeholder="0"
                            className="w-full text-center text-xs font-semibold py-1 border border-slate-200 rounded outline-none focus:border-indigo-500 font-mono"
                          />
                        </div>
                      ))}
                    </div>

                    {cashDenominationTotal !== bulkTotals.totalCash && (
                      <p className="text-xs text-rose-600 mt-3 flex items-center font-semibold">
                        <AlertCircle size={15} className="mr-1.5 shrink-0" />
                        Denomination total (₹{cashDenominationTotal.toLocaleString()}) does not match Total Cash Collections (₹{bulkTotals.totalCash.toLocaleString()}). Please balance cash count before submitting.
                      </p>
                    )}
                  </section>
                )}
              </>
            )}

            {/* SINGLE CLIENT ENTRY MODE */}
            {entryMode === 'single' && (
              <>
                {currentLoan && demandInfo && (
                  <div className="bg-indigo-50/70 p-4 rounded-xl border border-indigo-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-indigo-100 pb-2 mb-3">
                      <span className="text-xs font-bold text-indigo-900">
                        Customer: {(currentLoan.customers as any)?.full_name} ({(currentLoan.customers as any)?.client_id})
                      </span>
                      <span className="text-xs text-indigo-700 font-mono">
                        Cycle {currentLoan.cycle_number} • Loan ID: {currentLoan.loan_id}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                        <span className="text-[10px] text-slate-500 font-semibold block uppercase">Current EWI</span>
                        <span className="text-base font-bold text-slate-800">₹{demandInfo.currentDemand.toLocaleString()}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                        <span className="text-[10px] text-slate-500 font-semibold block uppercase">Arrears</span>
                        <span className={`text-base font-bold ${demandInfo.arrears > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                          ₹{demandInfo.arrears.toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                        <span className="text-[10px] text-slate-500 font-semibold block uppercase">Total Demand</span>
                        <span className="text-base font-extrabold text-indigo-700">₹{demandInfo.totalDemand.toLocaleString()}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                        <span className="text-[10px] text-slate-500 font-semibold block uppercase">Outstanding</span>
                        <span className="text-base font-bold text-slate-800">₹{demandInfo.outstandingBalance.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}

                <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                  <h2 className="text-base font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">
                    2. Payment Mode & Collection Details
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Collection Amount (₹) *</label>
                      <input
                        type="number"
                        required
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder="e.g. 750"
                        className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-lg font-black text-slate-800 outline-none focus:border-indigo-600 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Payment Mode</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['Cash', 'UPI', 'Bank Transfer'] as const).map(mode => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setPaymentMode(mode)}
                            className={`py-2 px-3 rounded-lg text-xs font-bold border-2 transition-all ${
                              paymentMode === mode
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-xs'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {paymentMode === 'Cash' && (
                    <div className="mt-6 pt-5 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <Banknote size={18} className="text-emerald-600" />
                          <span className="text-xs font-bold text-slate-800">Cash Denomination Breakdown</span>
                        </div>
                        <div className="text-xs font-mono">
                          Tally: <strong className={cashDenominationTotal === parseFloat(amount || '0') ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                            ₹{cashDenominationTotal.toLocaleString()}
                          </strong> / ₹{parseFloat(amount || '0').toLocaleString()}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        {[500, 200, 100, 50, 20, 10].map(val => (
                          <div key={val} className="flex items-center space-x-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                            <span className="text-xs font-bold text-slate-700 w-12 text-right">₹{val}:</span>
                            <input
                              type="number"
                              min="0"
                              value={denominations[val] || ''}
                              onChange={e => handleDenomChange(val, e.target.value)}
                              placeholder="0"
                              className="w-full text-center text-xs font-semibold py-1 border border-slate-200 rounded outline-none focus:border-indigo-500 font-mono"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {paymentMode !== 'Cash' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-5 border-t border-slate-100">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">UTR / Transaction Number *</label>
                        <input
                          type="text"
                          required
                          value={utrNumber}
                          onChange={e => setUtrNumber(e.target.value)}
                          placeholder="e.g. 324109823482"
                          className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-indigo-600 font-mono"
                        />
                      </div>
                    </div>
                  )}
                </section>
              </>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => router.push('/collections')}
                className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitCenterBulkCollections.isPending || createSingleCollection.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl text-sm font-bold shadow-md shadow-indigo-200 transition-all active:scale-95 flex items-center disabled:opacity-70"
              >
                <Save size={16} className="mr-2" />
                {entryMode === 'center-bulk'
                  ? `Submit ${bulkTotals.collectedCount} Center Collections (₹${bulkTotals.totalCollected.toLocaleString()})`
                  : 'Generate Voucher & Submit for Approval'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
