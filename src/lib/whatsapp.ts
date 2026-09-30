// RAM Finance WhatsApp Communication Helper

export interface PreDemandPayload {
  customerName: string
  mobileNumber: string
  loanId: string
  dueDate: string
  dueAmount: number
  arrearAmount: number
  totalDemand: number
  centerName?: string
}

export interface PostCollectionPayload {
  customerName: string
  mobileNumber: string
  loanId: string
  voucherNumber: string
  amountPaid: number
  paymentDate: string
  paymentMode: string
  utrNumber?: string
  remainingOutstanding: number
  staffName?: string
}

/**
 * Format Pre-Demand WhatsApp Message
 */
export function formatPreDemandMessage(payload: PreDemandPayload): string {
  return `📢 *RAM FINANCE — PAYMENT REMINDER*
Dear ${payload.customerName},
Your loan *${payload.loanId}* installment is due on *${payload.dueDate}*.

📌 *Current Due:* ₹${payload.dueAmount.toLocaleString()}
${payload.arrearAmount > 0 ? `⚠️ *Arrears:* ₹${payload.arrearAmount.toLocaleString()}\n` : ''}💰 *Total Demand:* ₹${payload.totalDemand.toLocaleString()}

Please keep cash ready for your center collection meeting.
Thank you,
*RAM Finance Ltd.*`
}

/**
 * Format Post-Collection Approval Confirmation Message
 */
export function formatPostCollectionMessage(payload: PostCollectionPayload): string {
  return `✅ *RAM FINANCE — PAYMENT CONFIRMATION*
Dear ${payload.customerName},
We have received your payment for Loan Account *${payload.loanId}*.

🧾 *Voucher No:* ${payload.voucherNumber}
💵 *Amount Paid:* ₹${payload.amountPaid.toLocaleString()}
📅 *Payment Date:* ${payload.paymentDate}
💳 *Mode:* ${payload.paymentMode} ${payload.utrNumber ? `(Ref: ${payload.utrNumber})` : ''}
💼 *Current Outstanding:* ₹${payload.remainingOutstanding.toLocaleString()}

Thank you for your prompt repayment!
*RAM Finance Ltd.*`
}

/**
 * Generate WhatsApp Click-to-Chat URL
 */
export function getWhatsAppClickToChatUrl(mobileNumber: string, message: string): string {
  // Clean mobile number (strip spaces, dashes, ensure country code)
  let cleanMobile = mobileNumber.replace(/\D/g, '')
  if (cleanMobile.length === 10) {
    cleanMobile = `91${cleanMobile}` // Default to India prefix
  }
  return `https://wa.me/${cleanMobile}?text=${encodeURIComponent(message)}`
}
