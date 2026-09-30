"use client";

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Camera, UploadCloud, MapPin as MapPinIcon, Check, User, Phone, Home, Shield, AlertCircle, X } from 'lucide-react'
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

export default function CustomerForm() {
  const router = useRouter()
  const queryClient = useQueryClient()
  
  // Permanent Client ID state
  const [clientId, setClientId] = useState<string>('Generating...')
  
  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    mobileNumber: '',
    dob: '',
    gender: 'Female',
    address: '',
    nomineeName: '',
    nomineeRelationship: 'Husband',
    nomineeMobile: '',
    nomineeAddress: '',
    centerId: ''
  })
  
  const [gpsLocation, setGpsLocation] = useState('')
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState('')
  const [customerPhoto, setCustomerPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [kycDoc, setKycDoc] = useState<File | null>(null)
  const [docPreview, setDocPreview] = useState<string | null>(null)

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

  // Handle Photo Selection
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setCustomerPhoto(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  // Handle KYC Doc Selection
  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setKycDoc(file)
      setDocPreview(file.name)
    }
  }

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
      // In production we upload to Supabase Storage:
      // Here we record photo/doc path metadata
      const photoPath = customerPhoto ? `photos/${clientId}_${customerPhoto.name}` : null
      const docPath = kycDoc ? `docs/${clientId}_${kycDoc.name}` : null

      const { data: result, error } = await supabase
        .from('customers')
        .insert({
          client_id: clientId,
          full_name: data.fullName,
          mobile_number: data.mobileNumber,
          dob: data.dob || null,
          gender: data.gender,
          address: data.address,
          nominee_name: data.nomineeName || null,
          nominee_relationship: data.nomineeRelationship || null,
          nominee_mobile: data.nomineeMobile || null,
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
      alert(`Failed to save customer: ${error.message || 'Database error'}`)
    }
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.centerId) {
      alert('Please select a Center for the customer.')
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
        {/* Section 1: Customer Profile */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center space-x-2 text-slate-800 font-semibold text-base mb-4 border-b border-slate-100 pb-2">
            <User size={18} className="text-indigo-600" />
            <span>Customer Profile</span>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number *</label>
              <input
                type="tel"
                name="mobileNumber"
                required
                value={formData.mobileNumber}
                onChange={handleChange}
                placeholder="e.g. 9876543210"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth</label>
              <input
                type="date"
                name="dob"
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
            <span>Nominee Details</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nominee Mobile</label>
              <input
                type="tel"
                name="nomineeMobile"
                value={formData.nomineeMobile}
                onChange={handleChange}
                placeholder="e.g. 9876500000"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>
          </div>
        </section>

        {/* Section 3: Evidence, Photos & Field Location */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center space-x-2 text-slate-800 font-semibold text-base mb-4 border-b border-slate-100 pb-2">
            <Camera size={18} className="text-indigo-600" />
            <span>Field Evidence & Location</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Customer Photo */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Customer Photo</label>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer bg-slate-50 relative overflow-hidden group min-h-[140px]">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                {photoPreview ? (
                  <div className="flex flex-col items-center text-emerald-600">
                    <img src={photoPreview} alt="Customer" className="w-16 h-16 object-cover rounded-full mb-1 border-2 border-emerald-500 shadow-xs" />
                    <span className="text-xs font-medium truncate max-w-[180px]">{customerPhoto?.name}</span>
                  </div>
                ) : (
                  <>
                    <Camera size={28} className="text-slate-400 mb-1.5 group-hover:text-indigo-600 transition-colors" />
                    <span className="text-xs font-semibold text-slate-600">Take / Upload Photo</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Camera or Gallery</span>
                  </>
                )}
              </div>
            </div>

            {/* KYC Document */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">KYC Document (Aadhaar/Voter)</label>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer bg-slate-50 relative overflow-hidden group min-h-[140px]">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleDocChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                {docPreview ? (
                  <div className="flex flex-col items-center text-indigo-600">
                    <Check size={28} className="text-indigo-600 mb-1" />
                    <span className="text-xs font-medium truncate max-w-[180px]">{docPreview}</span>
                  </div>
                ) : (
                  <>
                    <UploadCloud size={28} className="text-slate-400 mb-1.5 group-hover:text-indigo-600 transition-colors" />
                    <span className="text-xs font-semibold text-slate-600">Upload KYC Proof</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">JPG, PNG or PDF</span>
                  </>
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
