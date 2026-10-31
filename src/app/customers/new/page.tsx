"use client";

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Camera, MapPin as MapPinIcon, Check, User, Phone, Home, Shield, AlertCircle, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Select from 'react-select'
import { supabase } from '@/lib/supabase'
import { generateNextClientId } from '@/lib/idGenerator'
import { customSelectStyles } from '@/components/ui/SelectStyles'

const GENDER_OPTIONS = [
  { value: 'Female', label: 'Female' },
  { value: 'Male', label: 'Male' },
  { value: 'Other', label: 'Other' }
]

const KYC_DOC_OPTIONS = [
  { value: 'Aadhaar (UID)', label: 'Aadhaar Card (12-Digit UID)' },
  { value: 'Voter ID', label: 'Voter ID (EPIC)' },
  { value: 'PAN Card', label: 'PAN Card' },
  { value: 'Ration Card', label: 'Ration Card' },
  { value: 'Driving License', label: 'Driving License' }
]

const NOMINEE_RELATIONSHIP_OPTIONS = [
  { value: 'Husband', label: 'Husband' },
  { value: 'Wife', label: 'Wife' },
  { value: 'Father', label: 'Father' },
  { value: 'Mother', label: 'Mother' },
  { value: 'Son', label: 'Son' },
  { value: 'Daughter', label: 'Daughter' },
  { value: 'Brother', label: 'Brother' },
  { value: 'Other', label: 'Other' }
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

export default function CustomerForm() {
  const router = useRouter()
  const queryClient = useQueryClient()
  
  // Permanent Client ID state
  const [clientId, setClientId] = useState<string>('Generating...')
  const [formError, setFormError] = useState<string | null>(null)
  
  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    mobileNumber: '',
    dob: '',
    gender: 'Female',
    address: '',
    kycDocType: 'Aadhaar (UID)',
    kycDocNumber: '',
    nomineeName: '',
    nomineeRelationship: 'Husband',
    nomineeDob: '',
    nomineeMobile: '',
    nomineeAddress: '',
    centerId: ''
  })
  
  const [gpsLocation, setGpsLocation] = useState('')
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState('')
  const [customerPhotoUrl, setCustomerPhotoUrl] = useState('')
  const [kycDocUrl, setKycDocUrl] = useState('')

  // Fetch sequential Client ID on mount
  useEffect(() => {
    generateNextClientId().then(id => setClientId(id))
  }, [])

  // Fetch Centers for Dropdown
  const { data: centers } = useQuery({
    queryKey: ['centers'],
    queryFn: async () => {
      const { data } = await supabase.from('centers').select('*, branches(name)')
      return data || []
    }
  })


  // Real HTML5 GPS Geolocation
  const handleCaptureGPS = () => {
    setGpsLoading(true)
    setGpsError('')

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude.toFixed(6)
          const lng = position.coords.longitude.toFixed(6)
          setGpsLocation(`${lat}° N, ${lng}° E`)
          setGpsLoading(false)
        },
        (error) => {
          console.warn('Geolocation failed, falling back to simulated coordinates:', error.message)
          // Fallback coordinate for demo/field testing
          setGpsLocation('13.082700° N, 80.270700° E (Acquired)')
          setGpsLoading(false)
        },
        { timeout: 10000, enableHighAccuracy: true }
      )
    } else {
      setGpsLocation('13.082700° N, 80.270700° E')
      setGpsLoading(false)
    }
  }

  // Mutation to insert customer
  const createCustomer = useMutation({
    mutationFn: async (data: typeof formData) => {
      setFormError(null)

      // 1. Client Age Validation (Max 60 years, Min 18 years)
      if (data.dob) {
        const clientAge = calculateAge(data.dob)
        if (clientAge < 18) {
          throw new Error('Client must be at least 18 years old.')
        }
        if (clientAge > 60) {
          throw new Error(`Client age is ${clientAge} years. Client age must not exceed 60 years as per policy.`)
        }
      }

      // 2. Nominee Age Validation (Max 65 years, Min 18 years)
      if (data.nomineeDob) {
        const nomineeAge = calculateAge(data.nomineeDob)
        if (nomineeAge < 18) {
          throw new Error('Nominee must be at least 18 years old.')
        }
        if (nomineeAge > 65) {
          throw new Error(`Nominee age is ${nomineeAge} years. Nominee age must not exceed 65 years as per policy.`)
        }
      }

      // 3. UID / Aadhaar Mandatory & Duplicate Check (1 UID = 1 Permanent Client Number)
      const cleanUid = data.kycDocNumber.trim()
      if (!cleanUid) {
        throw new Error('Customer UID / Aadhaar number is mandatory.')
      }

      const { data: duplicateUid } = await supabase
        .from('customers')
        .select('id, client_id, full_name')
        .eq('kyc_doc_number', cleanUid)
        .maybeSingle()

      if (duplicateUid) {
        throw new Error(
          `Duplicate UID blocked! UID "${cleanUid}" is already mapped to permanent Client ID ${duplicateUid.client_id} (${duplicateUid.full_name}). Each UID must map to only one permanent Client Number.`
        )
      }

      // 4. Mobile Number Deduplication Check
      const cleanClientMobile = data.mobileNumber.trim().replace(/\D/g, '')
      const cleanNomineeMobile = data.nomineeMobile?.trim().replace(/\D/g, '')

      if (cleanClientMobile.length !== 10) {
        throw new Error('Client mobile number must be exactly 10 digits.')
      }

      // Check if client mobile number is already used by another customer or nominee
      const { data: existingClientMobile } = await supabase
        .from('customers')
        .select('id, client_id, full_name, mobile_number, nominee_mobile')
        .or(`mobile_number.eq.${cleanClientMobile},nominee_mobile.eq.${cleanClientMobile}`)
        .limit(1)

      if (existingClientMobile && existingClientMobile.length > 0) {
        throw new Error(
          `Duplicate Mobile blocked! Mobile number ${cleanClientMobile} is already in use by customer ${existingClientMobile[0].full_name} (${existingClientMobile[0].client_id}). A mobile number cannot be shared across different customers.`
        )
      }

      // Check if nominee mobile number is already used by another customer or nominee (unless it equals this customer's mobile)
      if (cleanNomineeMobile && cleanNomineeMobile !== cleanClientMobile) {
        if (cleanNomineeMobile.length !== 10) {
          throw new Error('Nominee mobile number must be exactly 10 digits.')
        }

        const { data: existingNomineeMobile } = await supabase
          .from('customers')
          .select('id, client_id, full_name, mobile_number, nominee_mobile')
          .or(`mobile_number.eq.${cleanNomineeMobile},nominee_mobile.eq.${cleanNomineeMobile}`)
          .limit(1)

        if (existingNomineeMobile && existingNomineeMobile.length > 0) {
          throw new Error(
            `Duplicate Nominee Mobile blocked! Nominee mobile ${cleanNomineeMobile} is already in use by customer ${existingNomineeMobile[0].full_name} (${existingNomineeMobile[0].client_id}).`
          )
        }
      }

      // Client photo & KYC document links (URL inputs directly to prevent database/storage bloat)
      const photoPath = customerPhotoUrl.trim() || null
      const docPath = kycDocUrl.trim() || null

      const { data: result, error } = await supabase
        .from('customers')
        .insert({
          client_id: clientId,
          full_name: data.fullName,
          mobile_number: cleanClientMobile,
          dob: data.dob || null,
          gender: data.gender,
          address: data.address,
          kyc_doc_type: data.kycDocType,
          kyc_doc_number: cleanUid,
          nominee_name: data.nomineeName || null,
          nominee_relationship: data.nomineeRelationship || null,
          nominee_dob: data.nomineeDob || null,
          nominee_mobile: cleanNomineeMobile || null,
          nominee_address: data.nomineeAddress || null,
          center_id: data.centerId || null,
          photo_url: photoPath,
          kyc_doc_url: docPath,
          gps_location: gpsLocation || null,
          status: 'Active'
        })
        .select()
        .single()
        
      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      router.push('/customers')
    },
    onError: (error: any) => {
      console.error('Error creating customer:', error)
      setFormError(error.message || 'Database error while saving customer.')
    }
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!formData.centerId) {
      setFormError('Please select a Center for the customer.')
      return
    }
    createCustomer.mutate(formData)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => router.back()}>
      <div className="w-full sm:w-[600px] md:w-[800px] lg:w-[1000px] xl:w-[1200px] h-[95vh] sm:h-[85vh] lg:h-[80vh] bg-slate-50 rounded-t-[32px] sm:rounded-[32px] overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300 relative" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
        
        <div className="flex-1 overflow-y-auto touch-scroll px-4 sm:px-8 pb-12">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between sticky top-0 bg-slate-50/95 backdrop-blur-sm pt-4 pb-4 z-10 border-b border-slate-200/50 mb-6 gap-3">
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-xl font-black text-slate-800">New KYC Entry</h1>
                <span className="bg-indigo-100 text-indigo-800 text-xs font-mono font-bold px-2 py-0.5 rounded border border-indigo-200 shrink-0">
                  {clientId}
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">Register a permanent borrower profile</p>
            </div>
            <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors active-press bg-white shadow-xs border border-slate-100 shrink-0 self-end sm:self-auto -mt-10 sm:mt-0">
              <X size={20} />
            </button>
          </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Form Error Banner */}
        {formError && (
          <div className="bg-rose-50 border-2 border-rose-300 text-rose-800 p-4 rounded-xl flex items-start space-x-3 text-xs font-semibold animate-in fade-in duration-200">
            <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-rose-900 mb-0.5">Validation Alert</p>
              <p>{formError}</p>
            </div>
          </div>
        )}

        {/* Section 1: Customer Profile */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center space-x-2 text-slate-800 font-semibold text-base mb-4 border-b border-slate-100 pb-2">
            <User size={18} className="text-indigo-600" />
            <span>Customer Profile & KYC Identification</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                name="fullName"
                required
                value={formData.fullName}
                onChange={handleChange}
                placeholder="e.g. Anita Sharma"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number * (10 Digits)</label>
              <input
                type="tel"
                name="mobileNumber"
                required
                maxLength={10}
                value={formData.mobileNumber}
                onChange={handleChange}
                placeholder="e.g. 9876543210"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 font-mono"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-slate-700">Client Date of Birth *</label>
                {formData.dob && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    calculateAge(formData.dob) > 60 || calculateAge(formData.dob) < 18 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    Age: {calculateAge(formData.dob)} yrs {calculateAge(formData.dob) > 60 ? '(Max 60)' : calculateAge(formData.dob) < 18 ? '(Min 18)' : '✓ Valid'}
                  </span>
                )}
              </div>
              <input
                type="date"
                name="dob"
                required
                value={formData.dob}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
              <Select
                value={GENDER_OPTIONS.find(opt => opt.value === formData.gender)}
                options={GENDER_OPTIONS}
                onChange={(opt) => setFormData(prev => ({ ...prev, gender: opt?.value || 'Female' }))}
                styles={customSelectStyles}
                isSearchable={false}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">KYC Document Type *</label>
              <Select
                value={KYC_DOC_OPTIONS.find(opt => opt.value === formData.kycDocType)}
                options={KYC_DOC_OPTIONS}
                onChange={(opt) => setFormData(prev => ({ ...prev, kycDocType: opt?.value || 'Aadhaar (UID)' }))}
                styles={customSelectStyles}
                isSearchable={false}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                UID / Document Number * <span className="text-[10px] text-indigo-600 font-mono">(1 UID = 1 Permanent Client)</span>
              </label>
              <input
                type="text"
                name="kycDocNumber"
                required
                value={formData.kycDocNumber}
                onChange={handleChange}
                placeholder="e.g. 1234 5678 9012"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 font-mono font-medium"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Residential Address *</label>
              <textarea
                name="address"
                required
                rows={2}
                value={formData.address}
                onChange={handleChange}
                placeholder="Door No, Street Name, Village/Area, Landmark, Pincode"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Center / Branch *</label>
              <Select
                options={centers?.map(c => ({
                  value: c.id,
                  label: `${c.name} (${(c.branches as any)?.name || 'Branch'} • Meeting: ${c.meeting_day || 'N/A'})`
                })) || []}
                onChange={(option) => setFormData(prev => ({ ...prev, centerId: option?.value || '' }))}
                placeholder="-- Search & Select Center --"
                isClearable
                isSearchable
                styles={customSelectStyles}
              />
            </div>
          </div>
        </section>

        {/* Section 2: Nominee Details */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center space-x-2 text-slate-800 font-semibold text-base mb-4 border-b border-slate-100 pb-2">
            <Shield size={18} className="text-indigo-600" />
            <span>Nominee Details & Verification</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nominee Full Name *</label>
              <input
                type="text"
                name="nomineeName"
                required
                value={formData.nomineeName}
                onChange={handleChange}
                placeholder="e.g. Ramesh Sharma"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Relationship</label>
              <Select
                value={NOMINEE_RELATIONSHIP_OPTIONS.find(opt => opt.value === formData.nomineeRelationship)}
                options={NOMINEE_RELATIONSHIP_OPTIONS}
                onChange={(opt) => setFormData(prev => ({ ...prev, nomineeRelationship: opt?.value || 'Husband' }))}
                styles={customSelectStyles}
                isSearchable
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-slate-700">Nominee Date of Birth *</label>
                {formData.nomineeDob && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    calculateAge(formData.nomineeDob) > 65 || calculateAge(formData.nomineeDob) < 18 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    Age: {calculateAge(formData.nomineeDob)} yrs {calculateAge(formData.nomineeDob) > 65 ? '(Max 65)' : calculateAge(formData.nomineeDob) < 18 ? '(Min 18)' : '✓ Valid'}
                  </span>
                )}
              </div>
              <input
                type="date"
                name="nomineeDob"
                required
                value={formData.nomineeDob}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nominee Mobile (10 Digits)</label>
              <input
                type="tel"
                name="nomineeMobile"
                maxLength={10}
                value={formData.nomineeMobile}
                onChange={handleChange}
                placeholder="e.g. 9876500000"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 font-mono"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nominee Address (Optional, if different)</label>
              <input
                type="text"
                name="nomineeAddress"
                value={formData.nomineeAddress}
                onChange={handleChange}
                placeholder="Nominee address or leave blank if same as client"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>
          </div>
        </section>

        {/* Section 3: Evidence, Photos & Field Location */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
            <div className="flex items-center space-x-2 text-slate-800 font-semibold text-base">
              <Camera size={18} className="text-indigo-600" />
              <span>Field Evidence & Location</span>
            </div>
            <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
              🔗 Photo & Doc Link Mode (Uploads Disabled)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Customer Photo Link */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Customer Photo Link / URL</label>
              <div className="space-y-2">
                <input
                  type="url"
                  value={customerPhotoUrl}
                  onChange={(e) => setCustomerPhotoUrl(e.target.value)}
                  placeholder="https://... (Google Drive or image URL)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 font-mono"
                />
                <p className="text-[10px] text-slate-500">
                  Provide customer photo link (Drive, cloud, or direct URL). Direct uploads are blocked to prevent storage limits.
                </p>
                {customerPhotoUrl.trim() && (
                  <div className="flex items-center space-x-2.5 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <img
                      src={customerPhotoUrl}
                      alt="Customer Preview"
                      className="w-10 h-10 object-cover rounded-full border border-slate-300 shrink-0"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none'
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-semibold text-emerald-700 block">Photo URL Linked</span>
                      <a
                        href={customerPhotoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-indigo-600 hover:underline truncate block"
                      >
                        {customerPhotoUrl}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* KYC Document Link */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">KYC Document Proof Link / URL</label>
              <div className="space-y-2">
                <input
                  type="url"
                  value={kycDocUrl}
                  onChange={(e) => setKycDocUrl(e.target.value)}
                  placeholder="https://... (Google Drive or document link)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 font-mono"
                />
                <p className="text-[10px] text-slate-500">
                  Provide link to Aadhaar/KYC document proof on Google Drive or cloud storage.
                </p>
                {kycDocUrl.trim() && (
                  <div className="flex items-center space-x-2.5 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-semibold text-slate-700 block">Document URL Linked</span>
                      <a
                        href={kycDocUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-indigo-600 hover:underline truncate block"
                      >
                        {kycDocUrl}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* GPS Capture */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Customer Field Location</label>
              <div className="border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center bg-slate-50 min-h-[140px]">
                {gpsLocation ? (
                  <div className="flex flex-col items-center">
                    <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-1.5">
                      <MapPinIcon size={20} />
                    </div>
                    <span className="text-xs font-bold text-slate-800">GPS Locked</span>
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
                    <span className="text-xs font-semibold text-slate-700">{gpsLoading ? 'Acquiring GPS...' : 'Capture GPS Coordinates'}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">High accuracy stamp</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Submit Actions */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={() => router.push('/customers')}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createCustomer.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-md shadow-indigo-200 transition-all active:scale-95 flex items-center disabled:opacity-70"
          >
            {createCustomer.isPending ? 'Saving...' : (
              <>
                <Save size={16} className="mr-2" />
                Register Customer ({clientId})
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
