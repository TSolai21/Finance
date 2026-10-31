"use client";

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Save, MapPin as MapPinIcon, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Select from 'react-select'
import { supabase } from '@/lib/supabase'
import { customSelectStyles } from '@/components/ui/SelectStyles'
import {
  STANDARD_MICRO_FINANCE_PRODUCTS,
  MicroFinanceProduct,
  calculateProcessingFee
} from '@/lib/products'
import { generateNextLoanId, getCustomerNextCycle } from '@/lib/idGenerator'

const LAP_EMI_DATE_OPTIONS = [
  { value: '5th', label: '5th of every month' },
  { value: '10th', label: '10th of every month' }
]

const MONTHLY_REPAYMENT_OPTIONS = [
  { value: 'Monthly Interest', label: 'Monthly Interest + Part Payment' },
  { value: 'Bullet', label: 'Bullet Payment at Maturity' }
]

const MEETING_DAY_OPTIONS = [
  { value: 'Monday', label: 'Monday' },
  { value: 'Tuesday', label: 'Tuesday' },
  { value: 'Wednesday', label: 'Wednesday' },
  { value: 'Thursday', label: 'Thursday' },
  { value: 'Friday', label: 'Friday' },
  { value: 'Saturday', label: 'Saturday' },
  { value: 'Sunday', label: 'Sunday' }
]

function calculateAge(dobStr: string): number {
  if (!dobStr) return 0
  const birth = new Date(dobStr)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

export default function LoanForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialCustomerId = searchParams.get('customerId') || ''

  const queryClient = useQueryClient()
  const [productType, setProductType] = useState<'Micro Finance' | 'LAP' | 'Monthly Interest'>('Micro Finance')
  const [customerId, setCustomerId] = useState(initialCustomerId)
  const [cycleInfo, setCycleInfo] = useState<{ cycleNumber: number; nextLoanId: string }>({ cycleNumber: 1, nextLoanId: 'PPRA0001' })
  const [coApplicantUid, setCoApplicantUid] = useState('')
  const [loanFormError, setLoanFormError] = useState<string | null>(null)

  // Micro Finance Selected Config
  const [mfSelection, setMfSelection] = useState<MicroFinanceProduct>(STANDARD_MICRO_FINANCE_PRODUCTS[2]) // ₹15,000 / 25w / ₹750

  // LAP & Monthly Interest Fields
  const [customAmount, setCustomAmount] = useState('')
  const [customInterest, setCustomInterest] = useState('2.0')
  const [customTenureMonths, setCustomTenureMonths] = useState('12')
  const [lapEmiDate, setLapEmiDate] = useState('5th')
  const [monthlyRepaymentMode, setMonthlyRepaymentMode] = useState<'Monthly Interest' | 'Bullet'>('Monthly Interest')

  // Common Loan Fields
  const [firstDate, setFirstDate] = useState('')
  const [collectionDay, setCollectionDay] = useState('Monday')

  // Field Evidence & Location (URL / Links only - file uploads disabled)
  const [gpsLocation, setGpsLocation] = useState('')
  const [gpsLoading, setGpsLoading] = useState(false)
  const [disbursementPhotoUrl, setDisbursementPhotoUrl] = useState('')
  const [coApplicantPhotoUrl, setCoApplicantPhotoUrl] = useState('')
  const [propertyPhotoUrl, setPropertyPhotoUrl] = useState('')

  // Fetch customers for the dropdown
  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('*').eq('status', 'Active')
      return data || []
    }
  })

  // Fetch product master from DB
  const { data: dbProducts } = useQuery({
    queryKey: ['loan_products'],
    queryFn: async () => {
      const { data } = await supabase.from('loan_products').select('*')
      return data || []
    }
  })

  // Whenever customerId changes, calculate next cycle & loan ID
  useEffect(() => {
    if (!customerId) return
    let active = true

    getCustomerNextCycle(customerId).then(cycleNum => {
      if (!active) return
      generateNextLoanId(cycleNum).then(nextId => {
        if (!active) return
        setCycleInfo({ cycleNumber: cycleNum, nextLoanId: nextId })
      })
    })

    return () => {
      active = false
    }
  }, [customerId])


  // Geolocation
  const handleCaptureGPS = () => {
    setGpsLoading(true)
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsLocation(`${pos.coords.latitude.toFixed(6)}° N, ${pos.coords.longitude.toFixed(6)}° E`)
          setGpsLoading(false)
        },
        () => {
          setGpsLocation('13.082700° N, 80.270700° E (Acquired)')
          setGpsLoading(false)
        },
        { timeout: 10000 }
      )
    } else {
      setGpsLocation('13.082700° N, 80.270700° E')
      setGpsLoading(false)
    }
  }

  // Derived Financial Calculations
  const principalAmount =
    productType === 'Micro Finance'
      ? mfSelection.amount
      : parseFloat(customAmount) || 0

  // For Micro Finance: tenure is in weeks.
  // For LAP: tenure is in months (e.g. 20 months). We store 20, NOT 20 * 4.33!
  // For Monthly Interest: tenure is in months (e.g. 12 months).
  const tenureWeeks =
    productType === 'Micro Finance'
      ? mfSelection.tenure
      : parseInt(customTenureMonths) || 12

  const emiAmount =
    productType === 'Micro Finance'
      ? mfSelection.ewi
      : productType === 'LAP'
      ? Math.round((principalAmount / (parseInt(customTenureMonths) || 12)) + (principalAmount * (parseFloat(customInterest) / 100)))
      : monthlyRepaymentMode === 'Bullet'
      ? 0
      : Math.round(principalAmount * (parseFloat(customInterest) / 100))

  const processingFee = calculateProcessingFee(
    productType,
    principalAmount,
    cycleInfo.cycleNumber > 1,
    monthlyRepaymentMode
  )

  // Submit Mutation
  const createLoan = useMutation({
    mutationFn: async () => {
      setLoanFormError(null)
      if (!customerId) throw new Error('Please select a customer.')
      if (!principalAmount || principalAmount <= 0) throw new Error('Invalid loan amount.')

      // 1. Client & Nominee Age Checks (Client max 60, Nominee max 65)
      if (selectedCustomerObj?.dob) {
        const clientAge = calculateAge(selectedCustomerObj.dob)
        if (clientAge > 60) {
          throw new Error(`Customer age is ${clientAge} years. Client age must not exceed 60 years at loan entry.`)
        }
      }
      if (selectedCustomerObj?.nominee_dob) {
        const nomineeAge = calculateAge(selectedCustomerObj.nominee_dob)
        if (nomineeAge > 65) {
          throw new Error(`Nominee age is ${nomineeAge} years. Nominee age must not exceed 65 years.`)
        }
      }

      // 2. Co-Applicant Active Loan Validation (1 active loan per Co-Applicant UID)
      if (productType === 'LAP' && coApplicantUid.trim()) {
        const { data: existingCoAppLoans } = await supabase
          .from('loans')
          .select('id, loan_id')
          .eq('status', 'Active')
          .eq('co_applicant_uid', coApplicantUid.trim())
          .limit(1)

        if (existingCoAppLoans && existingCoAppLoans.length > 0) {
          throw new Error(
            `Co-Applicant UID "${coApplicantUid}" is already linked to active loan ${existingCoAppLoans[0].loan_id}. A co-applicant UID can be linked to only one active loan.`
          )
        }
      }

      // 3. Duplicate Loan Prevention
      const { data: activeLoansForCust } = await supabase
        .from('loans')
        .select('id, loan_id, principal_amount, status, loan_products(type)')
        .eq('customer_id', customerId)
        .eq('status', 'Active')

      if (activeLoansForCust && activeLoansForCust.length > 0) {
        const activeMfi = activeLoansForCust.find((l: any) => l.loan_products?.type === 'Micro Finance')
        if (productType === 'Micro Finance' && activeMfi) {
          throw new Error(
            `Duplicate Loan Warning: Customer already has active Micro Finance loan (${activeMfi.loan_id}). Multiple active Micro Finance loans are restricted per customer.`
          )
        }
      }

      // Find matching loan product or default
      const matchedProduct = dbProducts?.find(p => p.type === productType)
      const productId = matchedProduct?.id || null

      const { data, error } = await supabase
        .from('loans')
        .insert({
          loan_id: cycleInfo.nextLoanId,
          customer_id: customerId,
          product_id: productId,
          cycle_number: cycleInfo.cycleNumber,
          principal_amount: principalAmount,
          tenure_weeks: tenureWeeks,
          emi_amount: emiAmount,
          first_emi_date: (productType === 'Monthly Interest' && monthlyRepaymentMode === 'Bullet') ? null : (firstDate || null),
          processing_fee: processingFee,
          collection_day: productType === 'Micro Finance' ? collectionDay : null,
          gps_location: gpsLocation || null,
          co_applicant_uid: coApplicantUid.trim() || null,
          co_applicant_photo_url: productType === 'LAP' ? (coApplicantPhotoUrl.trim() || null) : null,
          property_photo_url: productType === 'LAP' ? (propertyPhotoUrl.trim() || null) : null,
          disbursement_photo_url: disbursementPhotoUrl.trim() || null,
          status: 'Pending Approval' // Maker-Checker gate
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] })
      queryClient.invalidateQueries({ queryKey: ['pending-disbursements'] })
      router.push('/loans')
    },
    onError: (err: any) => {
      setLoanFormError(err.message || 'Failed to submit loan')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoanFormError(null)
    createLoan.mutate()
  }

  const selectedCustomerObj = customers?.find(c => c.id === customerId)

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => router.back()}>
      <div className="w-full sm:w-[600px] md:w-[800px] lg:w-[1000px] xl:w-[1200px] h-[95vh] sm:h-[85vh] lg:h-[80vh] bg-slate-50 rounded-t-[32px] sm:rounded-[32px] overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300 relative" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
        
        <div className="flex-1 overflow-y-auto touch-scroll px-4 sm:px-8 pb-12">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between sticky top-0 bg-slate-50/95 backdrop-blur-sm pt-4 pb-4 z-10 border-b border-slate-200/50 mb-6 gap-3">
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-xl font-black text-slate-800">New Loan Disbursement</h1>
                <span className="bg-indigo-100 text-indigo-800 text-xs font-mono font-bold px-2 py-0.5 rounded border border-indigo-200 shrink-0">
                  {cycleInfo.nextLoanId} (Cycle {cycleInfo.cycleNumber})
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">Maker Entry • Submits to Branch Manager for Verification</p>
            </div>
            <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors active-press bg-white shadow-xs border border-slate-100 shrink-0 self-end sm:self-auto -mt-10 sm:mt-0">
              <X size={20} />
            </button>
          </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Form Error Banner */}
        {loanFormError && (
          <div className="bg-rose-50 border-2 border-rose-300 text-rose-800 p-4 rounded-xl flex items-start space-x-3 text-xs font-semibold animate-in fade-in duration-200">
            <X size={18} className="text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-rose-900 mb-0.5">Disbursement Validation Alert</p>
              <p>{loanFormError}</p>
            </div>
          </div>
        )}

        {/* Step 1: Customer Selection */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
            <h2 className="text-base font-bold text-slate-800">1. Select Verified Customer</h2>
            {selectedCustomerObj && (
              <span className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                Permanent Client ID: {selectedCustomerObj.client_id}
              </span>
            )}
          </div>
          
          <Select
            value={selectedCustomerObj ? { value: selectedCustomerObj.id, label: `${selectedCustomerObj.full_name} (${selectedCustomerObj.client_id}) • ${selectedCustomerObj.mobile_number}` } : null}
            options={customers?.map(c => ({
              value: c.id,
              label: `${c.full_name} (${c.client_id}) • ${c.mobile_number}`
            })) || []}
            onChange={(opt) => setCustomerId(opt?.value || '')}
            placeholder="-- Search Customer by Name, Mobile, or Permanent Client ID --"
            isClearable
            isSearchable
            styles={customSelectStyles}
          />

          {selectedCustomerObj && (
            <div className="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600 flex justify-between items-center">
              <span>Customer: <strong className="text-slate-800">{selectedCustomerObj.full_name}</strong></span>
              <span>Nominee: <strong className="text-slate-800">{selectedCustomerObj.nominee_name || 'N/A'} ({selectedCustomerObj.nominee_relationship || 'Relation'})</strong></span>
              <span>Next Loan Cycle: <strong className="text-indigo-600">Cycle {cycleInfo.cycleNumber} ({cycleInfo.nextLoanId})</strong></span>
            </div>
          )}
        </section>

        {/* Step 2: Loan Product Configuration */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <h2 className="text-base font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">2. Loan Product Configuration</h2>
          
          {/* Product Type Selector */}
          <div className="mb-6">
            <label className="block text-xs font-semibold text-slate-700 mb-2">Loan Product</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { type: 'Micro Finance', label: 'Micro Finance', sub: 'Weekly Fixed EWI' },
                { type: 'LAP', label: 'LAP (Loan Against Property)', sub: 'Monthly EMI / Property Collateral' },
                { type: 'Monthly Interest', label: 'Monthly Interest Loan', sub: 'Bullet / Part-payment support' }
              ].map(item => (
                <label key={item.type} className="cursor-pointer">
                  <input
                    type="radio"
                    name="productType"
                    value={item.type}
                    checked={productType === item.type}
                    onChange={(e) => setProductType(e.target.value as any)}
                    className="peer sr-only"
                  />
                  <div className="p-3 border-2 border-slate-200 rounded-xl hover:border-indigo-300 peer-checked:border-indigo-600 peer-checked:bg-indigo-50/70 transition-all text-center">
                    <p className="font-bold text-sm text-slate-800 peer-checked:text-indigo-800">{item.label}</p>
                    <p className="text-[11px] text-slate-500 peer-checked:text-indigo-600 mt-0.5">{item.sub}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Micro Finance Matrix: 15 Options from SRS */}
          {productType === 'Micro Finance' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Select Approved Micro Finance Configuration (Amount • Tenure • EWI)
                </label>
                <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  Admin Configured Master
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                {STANDARD_MICRO_FINANCE_PRODUCTS.map((opt, idx) => {
                  const isSelected = mfSelection.amount === opt.amount && mfSelection.tenure === opt.tenure
                  return (
                    <label key={idx} className="cursor-pointer">
                      <input
                        type="radio"
                        name="mfProduct"
                        checked={isSelected}
                        onChange={() => setMfSelection(opt)}
                        className="peer sr-only"
                      />
                      <div className="p-2.5 text-center border-2 border-slate-200 rounded-lg hover:border-indigo-300 peer-checked:border-indigo-600 peer-checked:bg-indigo-50 transition-all">
                        <p className="font-extrabold text-sm text-slate-800 peer-checked:text-indigo-900">
                          ₹{opt.amount.toLocaleString()}
                        </p>
                        <p className="text-xs font-bold text-indigo-600 mt-0.5">
                          ₹{opt.ewi} <span className="font-normal text-[10px] text-slate-500">/wk</span>
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{opt.tenure} Weeks</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* LAP Configuration */}
          {productType === 'LAP' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Approved Loan Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={customAmount}
                  onChange={e => setCustomAmount(e.target.value)}
                  placeholder="e.g. 500000"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Interest Rate (% / month)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={customInterest}
                  onChange={e => setCustomInterest(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tenure (Months)</label>
                <input
                  type="number"
                  required
                  value={customTenureMonths}
                  onChange={e => setCustomTenureMonths(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Configured EMI Date</label>
                <Select
                  value={LAP_EMI_DATE_OPTIONS.find(o => o.value === lapEmiDate)}
                  options={LAP_EMI_DATE_OPTIONS}
                  onChange={(opt) => setLapEmiDate(opt?.value || '5th')}
                  styles={customSelectStyles}
                  isSearchable={false}
                />
              </div>

              <div className="sm:col-span-2 md:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Co-Applicant UID / Aadhaar Number <span className="text-[10px] text-indigo-600 font-mono">(Can be linked to max 1 active loan)</span>
                </label>
                <input
                  type="text"
                  value={coApplicantUid}
                  onChange={e => setCoApplicantUid(e.target.value)}
                  placeholder="e.g. 1234 5678 9012"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-600 font-mono"
                />
              </div>

              <div className="sm:col-span-2 md:col-span-4 text-xs text-slate-500 bg-amber-50 p-2.5 rounded border border-amber-200">
                ⚠️ <strong>LAP Business Rules:</strong> Monthly collection only. Interest starts from disbursement date. Delay beyond 3 days incurs 2% interest on delayed days. Foreclosure charge: 2%. Processing fee: 2.5%.
              </div>

              {/* LAP Evidence: Co-Applicant & Property Photo Links (Uploads Disabled) */}
              <div className="sm:col-span-2 md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Co-Applicant Photo Link / URL</label>
                <input
                  type="url"
                  value={coApplicantPhotoUrl}
                  onChange={e => setCoApplicantPhotoUrl(e.target.value)}
                  placeholder="https://... (Google Drive or cloud photo link)"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white outline-none focus:border-indigo-600 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">Uploads disabled. Enter external photo URL or Drive link.</p>
                {coApplicantPhotoUrl.trim() && (
                  <p className="text-[10px] text-emerald-600 mt-0.5 truncate font-medium">✓ Linked: {coApplicantPhotoUrl}</p>
                )}
              </div>

              <div className="sm:col-span-2 md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Property Photo & Title Proof Link / URL</label>
                <input
                  type="url"
                  value={propertyPhotoUrl}
                  onChange={e => setPropertyPhotoUrl(e.target.value)}
                  placeholder="https://... (Drive link for property photo/docs)"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white outline-none focus:border-indigo-600 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">Uploads disabled. Enter external document URL or Drive link.</p>
                {propertyPhotoUrl.trim() && (
                  <p className="text-[10px] text-emerald-600 mt-0.5 truncate font-medium">✓ Linked: {propertyPhotoUrl}</p>
                )}
              </div>
            </div>
          )}

          {/* Monthly Interest Configuration */}
          {productType === 'Monthly Interest' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Principal Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={customAmount}
                  onChange={e => setCustomAmount(e.target.value)}
                  placeholder="e.g. 200000"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={customInterest}
                  onChange={e => setCustomInterest(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Repayment Mode</label>
                <Select
                  value={MONTHLY_REPAYMENT_OPTIONS.find(o => o.value === monthlyRepaymentMode)}
                  options={MONTHLY_REPAYMENT_OPTIONS}
                  onChange={(opt) => setMonthlyRepaymentMode((opt?.value || 'Monthly Interest') as any)}
                  styles={customSelectStyles}
                  isSearchable={false}
                />
              </div>

              <div className="sm:col-span-3 text-xs text-slate-500 bg-purple-50 p-2.5 rounded border border-purple-200">
                ℹ️ <strong>Bullet / Monthly Interest Policy:</strong> No first EMI date or processing fee. Interest generated from disbursement date; interest automatically recalculates on remaining principal upon part-payment.
              </div>
            </div>
          )}

          {/* Schedule & Collection Dates */}
          {(productType !== 'Monthly Interest' || monthlyRepaymentMode !== 'Bullet') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Expected First Due / EMI Date *</label>
                <input
                  type="date"
                  required
                  value={firstDate}
                  onChange={e => setFirstDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-600"
                />
              </div>

              {productType === 'Micro Finance' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Center Collection Meeting Day</label>
                  <Select
                    value={MEETING_DAY_OPTIONS.find(o => o.value === collectionDay)}
                    options={MEETING_DAY_OPTIONS}
                    onChange={(opt) => setCollectionDay(opt?.value || 'Monday')}
                    styles={customSelectStyles}
                    isSearchable={false}
                  />
                </div>
              )}
            </div>
          )}
        </section>

        {/* Step 3: Financial Summary Card */}
        <section className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500">Disbursement Amount</span>
              <p className="text-lg font-black text-slate-800">₹{principalAmount.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500">Tenure</span>
              <p className="text-lg font-black text-slate-800">
                {productType === 'Micro Finance' ? `${tenureWeeks} Weeks` : `${customTenureMonths || 12} Months`}
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500">Installment ({productType === 'Micro Finance' ? 'EWI' : 'EMI'})</span>
              <p className="text-lg font-black text-indigo-700">
                {productType === 'Monthly Interest' && monthlyRepaymentMode === 'Bullet' ? '₹0 (Bullet Maturity)' : `₹${emiAmount.toLocaleString()}`}
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500">Processing Fee</span>
              <p className="text-lg font-black text-slate-700">
                {processingFee > 0 ? `₹${processingFee.toLocaleString()} (${productType === 'Micro Finance' ? (cycleInfo.cycleNumber > 1 ? '2.5% Subsequent' : '3% 1st Cycle') : '2.5%'})` : '₹0 (0% Excluded)'}
              </p>
            </div>
          </div>
        </section>

        {/* Step 4: Field Evidence, Photos & GPS */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <h2 className="text-base font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">3. Field Evidence & GPS Stamp</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Disbursement Photo Link */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Disbursement Photo Link / URL (Customer + Cash/Agent)
              </label>
              <div className="space-y-2">
                <input
                  type="url"
                  value={disbursementPhotoUrl}
                  onChange={e => setDisbursementPhotoUrl(e.target.value)}
                  placeholder="https://... (Google Drive or cloud photo link)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 font-mono"
                />
                <p className="text-[10px] text-slate-500">
                  Provide photo link (Drive, cloud, or URL). Direct uploads are blocked to eliminate storage limits.
                </p>
                {disbursementPhotoUrl.trim() && (
                  <div className="flex items-center space-x-2.5 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <img
                      src={disbursementPhotoUrl}
                      alt="Disbursement Proof"
                      className="w-10 h-10 object-cover rounded border border-slate-300 shrink-0"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none'
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-semibold text-emerald-700 block">Disbursement Link Linked</span>
                      <a
                        href={disbursementPhotoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-indigo-600 hover:underline truncate block"
                      >
                        {disbursementPhotoUrl}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* GPS Location Stamp */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Disbursement Field GPS Stamp *</label>
              <div className="border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center bg-slate-50 min-h-[140px]">
                {gpsLocation ? (
                  <div className="flex flex-col items-center">
                    <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-1.5">
                      <MapPinIcon size={20} />
                    </div>
                    <span className="text-xs font-bold text-slate-800">Disbursement Location Stamped</span>
                    <span className="text-[11px] text-slate-500 font-mono mt-0.5">{gpsLocation}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleCaptureGPS}
                    disabled={gpsLoading}
                    className="flex flex-col items-center text-slate-500 hover:text-indigo-600 transition-colors group disabled:opacity-50"
                  >
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center mb-1.5 ${gpsLoading ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 group-hover:bg-indigo-100'}`}>
                      {gpsLoading ? <div className="animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full" /> : <MapPinIcon size={20} />}
                    </div>
                    <span className="text-xs font-semibold text-slate-700">{gpsLoading ? 'Acquiring GPS...' : 'Acquire Live Location'}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Mandatory field verification</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Action Controls */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={() => router.push('/loans')}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createLoan.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-7 py-2.5 rounded-lg text-sm font-semibold shadow-md shadow-indigo-200 transition-all active:scale-95 flex items-center disabled:opacity-70"
          >
            {createLoan.isPending ? 'Submitting...' : (
              <>
                <Save size={16} className="mr-2" />
                Submit to Manager for Approval
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
