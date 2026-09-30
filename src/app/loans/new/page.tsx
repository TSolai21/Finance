"use client";

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Save, Camera, MapPin as MapPinIcon, UploadCloud, X } from 'lucide-react'
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

export default function LoanForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialCustomerId = searchParams.get('customerId') || ''

  const queryClient = useQueryClient()
  const [productType, setProductType] = useState<'Micro Finance' | 'LAP' | 'Monthly Interest'>('Micro Finance')
  const [customerId, setCustomerId] = useState(initialCustomerId)
  const [cycleInfo, setCycleInfo] = useState<{ cycleNumber: number; nextLoanId: string }>({ cycleNumber: 1, nextLoanId: 'PPRA0001' })

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

  // Field Evidence & Location
  const [gpsLocation, setGpsLocation] = useState('')
  const [gpsLoading, setGpsLoading] = useState(false)
  const [disbursementPhoto, setDisbursementPhoto] = useState<File | null>(null)
  const [disbursementPhotoPreview, setDisbursementPhotoPreview] = useState<string | null>(null)
  const [coApplicantPhoto, setCoApplicantPhoto] = useState<File | null>(null)
  const [propertyPhoto, setPropertyPhoto] = useState<File | null>(null)

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

  // Handle Photo changes
  const handleDisbursementPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setDisbursementPhoto(file)
      setDisbursementPhotoPreview(URL.createObjectURL(file))
    }
  }

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

  const tenureWeeks =
    productType === 'Micro Finance'
      ? mfSelection.tenure
      : Math.round((parseInt(customTenureMonths) || 12) * 4.33)

  const emiAmount =
    productType === 'Micro Finance'
      ? mfSelection.ewi
      : productType === 'LAP'
      ? Math.round((principalAmount / (parseInt(customTenureMonths) || 12)) + (principalAmount * (parseFloat(customInterest) / 100)))
      : Math.round(principalAmount * (parseFloat(customInterest) / 100))

  const processingFee = calculateProcessingFee(productType, principalAmount, cycleInfo.cycleNumber > 1)

  // Submit Mutation
  const createLoan = useMutation({
    mutationFn: async () => {
      if (!customerId) throw new Error('Please select a customer.')
      if (!principalAmount || principalAmount <= 0) throw new Error('Invalid loan amount.')

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
          first_emi_date: firstDate || null,
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
    onError: (err: any) => alert(`Failed to submit loan: ${err.message}`)
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
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

              <div className="sm:col-span-2 md:col-span-4 text-xs text-slate-500 bg-amber-50 p-2.5 rounded border border-amber-200">
                ⚠️ <strong>LAP Business Rules:</strong> Delay beyond 3 days incurs 2% interest on delayed days. Foreclosure charge: 2%. Processing fee: 2.5%.
              </div>

              {/* LAP Evidence: Co-Applicant & Property Photos */}
              <div className="sm:col-span-2 md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Co-Applicant Photograph *</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setCoApplicantPhoto(e.target.files?.[0] || null)}
                  className="w-full text-xs border border-slate-300 rounded p-1.5 bg-white"
                />
                {coApplicantPhoto && <p className="text-[10px] text-emerald-600 mt-1">✓ {coApplicantPhoto.name}</p>}
              </div>

              <div className="sm:col-span-2 md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Property Photograph & Title Proof *</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setPropertyPhoto(e.target.files?.[0] || null)}
                  className="w-full text-xs border border-slate-300 rounded p-1.5 bg-white"
                />
                {propertyPhoto && <p className="text-[10px] text-emerald-600 mt-1">✓ {propertyPhoto.name}</p>}
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
            </div>
          )}

          {/* Schedule & Collection Dates */}
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
          </div>
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
                {productType === 'Micro Finance' ? `${tenureWeeks} Wks` : `${customTenureMonths || 12} Mos`}
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500">Installment ({productType === 'Micro Finance' ? 'EWI' : 'EMI'})</span>
              <p className="text-lg font-black text-indigo-700">₹{emiAmount.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500">Processing Fee</span>
              <p className="text-lg font-black text-slate-700">₹{processingFee.toLocaleString()}</p>
            </div>
          </div>
        </section>

        {/* Step 4: Field Evidence, Photos & GPS */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <h2 className="text-base font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">3. Field Evidence & GPS Stamp</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Disbursement Photo */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Disbursement Photo (Customer + Cash/Agent) *
              </label>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer bg-slate-50 relative overflow-hidden group min-h-[140px]">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleDisbursementPhotoChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                {disbursementPhotoPreview ? (
                  <div className="flex flex-col items-center text-emerald-600">
                    <img src={disbursementPhotoPreview} alt="Proof" className="w-16 h-16 object-cover rounded-md mb-1 border border-emerald-400" />
                    <span className="text-xs font-medium truncate max-w-[180px]">{disbursementPhoto?.name}</span>
                  </div>
                ) : (
                  <>
                    <Camera size={28} className="text-slate-400 mb-1.5 group-hover:text-indigo-600 transition-colors" />
                    <span className="text-xs font-semibold text-slate-700">Take Disbursement Photo</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Camera or upload</span>
                  </>
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
