"use client";

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Banknote, UploadCloud, AlertCircle, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Select from 'react-select'
import { supabase } from '@/lib/supabase'
import { DENOMINATION_VALUES, CashDenominations, calculateDenominationTotal } from '@/lib/cashManagement'
import { calculateLoanDemand } from '@/lib/installments'

export default function CollectionForm() {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Hierarchy selections
  const [selectedCenterId, setSelectedCenterId] = useState('')
  const [selectedLoanId, setSelectedLoanId] = useState('')

  // Payment details
  const [amount, setAmount] = useState('')
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Bank Transfer'>('Cash')
  const [utrNumber, setUtrNumber] = useState('')
  const [paymentProof, setPaymentProof] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState<string | null>(null)

  // Denominations State
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

  // Selected Loan Object
  const currentLoan = useMemo(() => {
    return activeLoans?.find(l => l.id === selectedLoanId)
  }, [activeLoans, selectedLoanId])

  // Collections for this loan to calculate demand
  const { data: pastCollections } = useQuery({
    queryKey: ['loan-collections-count', selectedLoanId],
    queryFn: async () => {
      if (!selectedLoanId) return []
      const { data } = await supabase.from('collections').select('amount, status').eq('loan_id', selectedLoanId)
      return data || []
    },
    enabled: !!selectedLoanId
  })

  // Demand Metrics Calculation
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

  // Calculate Cash Denomination Total
  const cashDenominationTotal = useMemo(() => {
    return calculateDenominationTotal(denominations)
  }, [denominations])

  // Update Denomination Count
  const handleDenomChange = (val: number, countStr: string) => {
    const count = parseInt(countStr) || 0
    setDenominations(prev => {
      const updated = { ...prev, [val]: Math.max(0, count) }
      const newTotal = calculateDenominationTotal(updated)
      if (paymentMode === 'Cash') {
        setAmount(newTotal.toString())
      }
      return updated
    })
  }

  // Handle Proof upload
  const handleProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPaymentProof(file)
      setProofPreview(URL.createObjectURL(file))
    }
  }

  // Submit Mutation
  const createCollection = useMutation({
    mutationFn: async () => {
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
      const proofPath = paymentProof ? `proofs/${voucherCode}_${paymentProof.name}` : null

      const { data, error } = await supabase
        .from('collections')
        .insert({
          loan_id: selectedLoanId,
          customer_id: currentLoan?.customer_id,
          amount: numAmount,
          payment_mode: paymentMode,
          utr_number: utrNumber || null,
          proof_url: proofPath,
          status: 'Pending Approval' // Maker-Checker verification gate
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
    onError: (err: any) => alert(err.message)
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createCollection.mutate()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => router.back()}>
      <div className="w-full sm:w-[600px] md:w-[800px] lg:w-[1000px] xl:w-[1200px] h-[95vh] sm:h-[85vh] lg:h-[80vh] bg-slate-50 rounded-t-[32px] sm:rounded-[32px] overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300 relative" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto my-3 sm:hidden shrink-0" />
        
        <div className="flex-1 overflow-y-auto touch-scroll px-4 sm:px-8 pb-12">
          {/* Header */}
          <div className="flex items-center justify-between sticky top-0 bg-slate-50/95 backdrop-blur-sm pt-2 pb-4 z-10 border-b border-slate-200/50 mb-6">
            <div>
              <h1 className="text-xl font-bold text-slate-900">New Field Collection</h1>
              <p className="text-slate-500 text-xs mt-0.5">Record a new payment</p>
            </div>
            <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors active-press bg-white shadow-xs border border-slate-100">
              <X size={20} />
            </button>
          </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Center & Loan Selection Hierarchy */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <h2 className="text-base font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">
            1. Operational Hierarchy (Center $\rightarrow$ Loan)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Filter by Center</label>
              <Select
                options={centers?.map(c => ({
                  value: c.id,
                  label: `${c.name} (${(c.branches as any)?.name} • Meeting: ${c.meeting_day || 'N/A'})`
                })) || []}
                onChange={(opt) => {
                  setSelectedCenterId(opt?.value || '')
                  setSelectedLoanId('')
                }}
                isClearable
                placeholder="-- All Centers --"
                styles={{
                  control: (base) => ({ ...base, borderColor: '#cbd5e1', borderRadius: '0.5rem', fontSize: '0.875rem' })
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Active Loan *</label>
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
          </div>

          {/* Current Loan Demand Snapshot */}
          {currentLoan && demandInfo && (
            <div className="bg-indigo-50/70 p-4 rounded-xl border border-indigo-100 mt-4">
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
        </section>

        {/* Step 2: Payment Details & Mode */}
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
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-lg font-black text-slate-800 outline-none focus:border-indigo-600"
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

          {/* Cash Denominations Section (Mandatory for Cash collections) */}
          {paymentMode === 'Cash' && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Banknote size={18} className="text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800">Cash Denomination Breakdown</span>
                </div>
                <div className="text-xs">
                  Tally: <strong className={cashDenominationTotal === parseFloat(amount || '0') ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                    ₹{cashDenominationTotal.toLocaleString()}
                  </strong> / ₹{parseFloat(amount || '0').toLocaleString()}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                {DENOMINATION_VALUES.map(val => (
                  <div key={val} className="flex items-center space-x-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                    <span className="text-xs font-bold text-slate-700 w-12 text-right">₹{val}:</span>
                    <input
                      type="number"
                      min="0"
                      value={denominations[val] || ''}
                      onChange={e => handleDenomChange(val, e.target.value)}
                      placeholder="0"
                      className="w-full text-center text-xs font-semibold py-1 border border-slate-200 rounded outline-none focus:border-indigo-500"
                    />
                  </div>
                ))}
              </div>

              {cashDenominationTotal !== parseFloat(amount || '0') && parseFloat(amount || '0') > 0 && (
                <p className="text-[11px] text-rose-500 mt-2 flex items-center">
                  <AlertCircle size={14} className="mr-1 shrink-0" />
                  Denomination total (₹{cashDenominationTotal}) does not match collection amount (₹{amount}). Please balance notes.
                </p>
              )}
            </div>
          )}

          {/* Digital UPI / Bank Transfer Fields */}
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Proof / Screenshot</label>
                <div className="border border-slate-300 rounded-lg p-2 flex items-center justify-between text-xs bg-slate-50 relative cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProofChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <span className="text-slate-600 truncate">{paymentProof ? paymentProof.name : 'Select receipt screenshot'}</span>
                  <UploadCloud size={16} className="text-slate-400 shrink-0 ml-2" />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Action Controls */}
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
            disabled={createCollection.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-7 py-2.5 rounded-lg text-sm font-semibold shadow-md shadow-indigo-200 transition-all active:scale-95 flex items-center disabled:opacity-70"
          >
            {createCollection.isPending ? 'Generating Voucher...' : (
              <>
                <Save size={16} className="mr-2" />
                Generate Voucher & Submit for Approval
              </>
            )}
          </button>
        </div>
      </form>
        </div>
      </div>
    </div>
  )
}
