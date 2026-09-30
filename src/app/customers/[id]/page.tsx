"use client";

import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { User, Phone, MapPin, Calendar, FileText, Shield, PlusCircle, CreditCard, ExternalLink, CheckCircle2 } from 'lucide-react'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'

export default function CustomerDetails() {
  const { id } = useParams()
  const router = useRouter()

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*, centers(name, meeting_day, branches(name))')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    }
  })

  const { data: loans } = useQuery({
    queryKey: ['customer-loans', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loans')
        .select('*, loan_products(name, type, interest_rate)')
        .eq('customer_id', id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    }
  })

  if (isLoading) return <div className="p-8 text-center text-slate-500">Loading customer profile...</div>
  if (!customer) return <div className="p-8 text-center text-rose-500">Customer profile not found.</div>

  const activeLoanCount = loans?.filter(l => l.status === 'Active').length || 0
  const totalCycles = loans?.length || 0

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <Breadcrumbs
            items={[
              { label: 'Customers', href: '/customers' },
              { label: customer.full_name }
            ]}
          />
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">{customer.full_name}</h1>
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
              {customer.client_id}
            </span>
            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${customer.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
              {customer.status}
            </span>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">Permanent Borrower Account • {totalCycles} Loan Cycle(s) Recorded</p>
        </div>

        <Link
          href={`/loans/new?customerId=${customer.id}`}
          className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all active:scale-95"
        >
          <PlusCircle size={16} className="mr-1.5" />
          Disburse New Cycle (Cycle {totalCycles + 1})
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Details & Nominee */}
        <div className="space-y-6 col-span-1">
          {/* Main Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex flex-col items-center text-center pb-5 border-b border-slate-100">
              <div className="h-20 w-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-3 shadow-inner">
                <User size={36} />
              </div>
              <h2 className="text-lg font-bold text-slate-800">{customer.full_name}</h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">Permanent ID: {customer.client_id}</p>
            </div>

            <div className="pt-4 space-y-3.5 text-xs">
              <div className="flex items-start">
                <Phone size={15} className="text-slate-400 mt-0.5 mr-2.5 shrink-0" />
                <div>
                  <span className="text-slate-500 block text-[10px]">Mobile</span>
                  <span className="text-slate-800 font-semibold">{customer.mobile_number}</span>
                </div>
              </div>

              <div className="flex items-start">
                <Calendar size={15} className="text-slate-400 mt-0.5 mr-2.5 shrink-0" />
                <div>
                  <span className="text-slate-500 block text-[10px]">DOB & Gender</span>
                  <span className="text-slate-800">{customer.dob || 'Not specified'} ({customer.gender})</span>
                </div>
              </div>

              <div className="flex items-start">
                <MapPin size={15} className="text-slate-400 mt-0.5 mr-2.5 shrink-0" />
                <div>
                  <span className="text-slate-500 block text-[10px]">Residential Address</span>
                  <span className="text-slate-700">{customer.address}</span>
                </div>
              </div>

              {customer.centers && (
                <div className="flex items-start">
                  <FileText size={15} className="text-slate-400 mt-0.5 mr-2.5 shrink-0" />
                  <div>
                    <span className="text-slate-500 block text-[10px]">Center & Branch</span>
                    <span className="text-slate-800 font-medium">
                      {customer.centers.name} ({customer.centers.branches?.name})
                    </span>
                    <span className="text-[10px] text-slate-500 block">Meeting: {customer.centers.meeting_day}</span>
                  </div>
                </div>
              )}

              {customer.gps_location && (
                <div className="flex items-start bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <MapPin size={14} className="text-emerald-600 mt-0.5 mr-2 shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold text-slate-600 uppercase">GPS Location</span>
                    <p className="text-slate-700 font-mono text-[11px]">{customer.gps_location}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Nominee Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center space-x-2 text-slate-800 font-semibold text-sm mb-3 border-b border-slate-100 pb-2">
              <Shield size={16} className="text-indigo-600" />
              <span>Nominee Information</span>
            </div>
            
            <div className="space-y-2.5 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] block">Full Name</span>
                <span className="font-semibold text-slate-800">{customer.nominee_name || 'N/A'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 text-[10px] block">Relationship</span>
                  <span className="text-slate-700">{customer.nominee_relationship || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Mobile</span>
                  <span className="text-slate-700">{customer.nominee_mobile || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Complete Loan Cycles History */}
        <div className="col-span-1 lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800">Complete Loan History</h3>
                <p className="text-xs text-slate-500">Track all loan cycles under permanent ID {customer.client_id}</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md">
                {activeLoanCount} Active / {totalCycles} Total
              </span>
            </div>

            <div className="space-y-4">
              {loans?.length ? (
                loans.map((loan, idx) => (
                  <div key={loan.id} className="border border-slate-200 rounded-xl p-4 hover:border-indigo-400 hover:shadow-xs transition-all bg-white group">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center">
                          {totalCycles - idx}
                        </span>
                        <div>
                          <h4 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors font-mono">
                            {loan.loan_id}
                          </h4>
                          <span className="text-xs text-slate-500">{loan.loan_products?.name || 'Loan'}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          loan.status === 'Active' ? 'bg-emerald-100 text-emerald-800' :
                          loan.status === 'Pending Approval' ? 'bg-amber-100 text-amber-800' :
                          loan.status === 'Closed' ? 'bg-slate-100 text-slate-700' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {loan.status}
                        </span>
                        <Link
                          href={`/loans/${loan.id}`}
                          className="text-xs text-indigo-600 font-semibold hover:underline flex items-center ml-2"
                        >
                          View <ExternalLink size={12} className="ml-1" />
                        </Link>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Principal</span>
                        <span className="font-bold text-slate-800">₹{loan.principal_amount?.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Tenure</span>
                        <span className="font-semibold text-slate-700">{loan.tenure_weeks ? `${loan.tenure_weeks} Weeks` : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">EMI / EWI</span>
                        <span className="font-semibold text-slate-700">{loan.emi_amount ? `₹${loan.emi_amount}` : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">First EMI Date</span>
                        <span className="font-semibold text-slate-700">{loan.first_emi_date || 'Pending Setup'}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <CreditCard size={32} className="mx-auto text-slate-400 mb-2" />
                  <p className="text-slate-600 text-sm font-semibold">No loans disbursed for this customer yet.</p>
                  <p className="text-slate-400 text-xs mt-1">Start the first loan cycle (PPRA0001) using the button above.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
