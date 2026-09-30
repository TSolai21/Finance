"use client";

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Printer, CheckCircle, ShieldCheck, MessageSquare, AlertCircle, QrCode } from 'lucide-react'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { formatPostCollectionMessage, getWhatsAppClickToChatUrl } from '@/lib/whatsapp'

export default function CollectionVoucher() {
  const { id } = useParams()
  const router = useRouter()
  const [thermalMode, setThermalMode] = useState(false)

  const { data: voucher, isLoading } = useQuery({
    queryKey: ['voucher', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collections')
        .select(`
          *,
          loans (
            id,
            loan_id,
            principal_amount,
            emi_amount
          ),
          customers (
            id,
            full_name,
            client_id,
            mobile_number,
            centers (name)
          )
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    }
  })

  if (isLoading) return <div className="p-8 text-center text-slate-500">Loading payment voucher...</div>
  if (!voucher) return <div className="p-8 text-center text-rose-500">Payment voucher not found.</div>

  const voucherCode = `VCH-${new Date(voucher.created_at).toISOString().slice(0, 10).replace(/-/g, '')}-${voucher.id.slice(0, 4).toUpperCase()}`
  const remainingBalance = Math.max(0, (voucher.loans?.principal_amount || 0) - voucher.amount)

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <Breadcrumbs
            items={[
              { label: 'Collections', href: '/collections' },
              { label: `Voucher ${voucherCode}` }
            ]}
          />
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Collection Bill & Voucher</h1>
          <p className="text-slate-500 text-xs font-mono mt-0.5">{voucherCode}</p>
        </div>

        <div className="flex items-center space-x-2">
          {/* WhatsApp Direct Dispatch */}
          {voucher.customers?.mobile_number && (
            <a
              href={getWhatsAppClickToChatUrl(
                voucher.customers.mobile_number,
                formatPostCollectionMessage({
                  customerName: voucher.customers.full_name,
                  mobileNumber: voucher.customers.mobile_number,
                  loanId: voucher.loans?.loan_id || 'N/A',
                  voucherNumber: voucherCode,
                  amountPaid: voucher.amount,
                  paymentDate: new Date(voucher.created_at).toLocaleDateString(),
                  paymentMode: voucher.payment_mode,
                  utrNumber: voucher.utr_number || undefined,
                  remainingOutstanding: remainingBalance
                })
              )}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-2 rounded-lg text-xs font-bold transition-colors"
            >
              <MessageSquare size={15} className="mr-1.5 text-emerald-600" />
              WhatsApp Receipt
            </a>
          )}

          {/* Toggle Thermal / Standard */}
          <button
            onClick={() => setThermalMode(!thermalMode)}
            className="px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
          >
            {thermalMode ? 'Standard Layout' : '80mm Thermal'}
          </button>

          <button
            onClick={() => window.print()}
            className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center shadow-xs"
          >
            <Printer size={15} className="mr-1.5" /> Print
          </button>
        </div>
      </div>

      {/* Printable Receipt Area */}
      <div
        id="print-area"
        className={`bg-white rounded-xl border border-slate-200 shadow-xs relative overflow-hidden transition-all mx-auto ${
          thermalMode ? 'max-w-sm p-5 font-mono text-xs' : 'p-8'
        }`}
      >
        {/* Receipt Header */}
        <div className="text-center pb-5 border-b border-slate-200 border-dashed mb-5">
          <ShieldCheck size={36} className="mx-auto text-indigo-600 mb-1" />
          <h2 className="text-xl font-black text-slate-800 tracking-tight">RAM FINANCE LTD.</h2>
          <p className="text-slate-500 text-xs">Official Field Collection Bill & Receipt</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Micro Finance • LAP • Monthly Interest</p>
        </div>

        {/* Voucher Meta */}
        <div className="grid grid-cols-2 gap-4 mb-5 text-xs">
          <div>
            <span className="text-slate-400 text-[10px] block uppercase">Voucher Number</span>
            <span className="font-mono font-bold text-slate-800">{voucherCode}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-400 text-[10px] block uppercase">Date & Time</span>
            <span className="font-semibold text-slate-800">{new Date(voucher.created_at).toLocaleString()}</span>
          </div>
        </div>

        {/* Amount Box */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-5 flex justify-between items-center">
          <div>
            <span className="text-xs text-slate-500 font-semibold block uppercase">Amount Received</span>
            <span className="text-2xl font-black text-slate-900">₹{voucher.amount.toLocaleString()}</span>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500 font-semibold block uppercase">Payment Mode</span>
            <span className="text-sm font-bold text-slate-800">{voucher.payment_mode}</span>
            {voucher.utr_number && <p className="text-[10px] text-slate-500 font-mono mt-0.5">Ref: {voucher.utr_number}</p>}
          </div>
        </div>

        {/* Customer & Loan Details */}
        <div className="space-y-2.5 text-xs border-b border-slate-200 border-dashed pb-5 mb-5">
          <div className="flex justify-between">
            <span className="text-slate-500">Customer Name:</span>
            <span className="font-bold text-slate-800">{voucher.customers?.full_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Permanent Client ID:</span>
            <span className="font-mono font-bold text-indigo-700">{voucher.customers?.client_id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Loan Account ID:</span>
            <span className="font-mono font-bold text-slate-800">{voucher.loans?.loan_id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Center:</span>
            <span className="text-slate-800 font-medium">{(voucher.customers?.centers as any)?.name || 'Branch Center'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Remaining Balance:</span>
            <span className="font-bold text-slate-900">₹{remainingBalance.toLocaleString()}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-1 text-xs">
          <div className="flex items-center">
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
              voucher.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
              voucher.status === 'Pending Approval' ? 'bg-amber-100 text-amber-800' :
              'bg-rose-100 text-rose-800'
            }`}>
              {voucher.status}
            </span>
          </div>
          <div className="text-right text-[10px] text-slate-400">
            <p>System Generated Voucher</p>
            <p className="font-mono">RAM-FIN-ID: {voucher.id.slice(0, 8)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
