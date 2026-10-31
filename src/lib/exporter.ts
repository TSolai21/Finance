import Papa from 'papaparse'
import ExcelJS from 'exceljs'

export interface ExcelSheetData {
  name: string
  data: Record<string, any>[]
}

/**
 * Export tabular data array to CSV file download
 */
export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    alert('No records available to export.')
    return
  }

  const csv = Papa.unparse(data)
  // Include UTF-8 BOM so Excel and Numbers on Mac properly render UTF-8 characters and currency
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export multiple datasets into a real binary Microsoft Excel Workbook (.xlsx)
 * Fully compatible with Apple Numbers (macOS), Microsoft Excel (Windows/Mac/iOS/Android), and Google Sheets.
 */
export async function exportToExcelWorkbook(sheets: ExcelSheetData[], filename: string) {
  if (!sheets || sheets.length === 0) {
    alert('No data available to export.')
    return
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'RAM Finance Ltd.'
  workbook.lastModifiedBy = 'RAM Finance Admin'
  workbook.created = new Date()
  workbook.modified = new Date()

  for (const sheet of sheets) {
    // Sheet name max 31 chars, strip invalid chars
    const cleanName = sheet.name.slice(0, 31).replace(/[\\/?*:[\]]/g, '')
    const worksheet = workbook.addWorksheet(cleanName || 'Sheet')

    const data = sheet.data || []
    if (data.length === 0) {
      worksheet.addRow(['No Records Available'])
      continue
    }

    const headers = Object.keys(data[0])

    // Setup columns with automatic width calculation
    worksheet.columns = headers.map(header => {
      let maxLen = header.length
      for (const row of data.slice(0, 50)) {
        const val = row[header]
        if (val !== null && val !== undefined) {
          maxLen = Math.max(maxLen, String(val).length)
        }
      }
      return {
        header,
        key: header,
        width: Math.min(Math.max(maxLen + 4, 12), 40)
      }
    })

    // Style the header row
    const headerRow = worksheet.getRow(1)
    headerRow.height = 26
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF312E81' } // Dark indigo brand color
      }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF1E1B4B' } }
      }
    })

    // Add all data rows with alternating vertical alignment
    for (const item of data) {
      const row = worksheet.addRow(item)
      row.height = 20
      row.alignment = { vertical: 'middle' }
    }
  }

  // Generate genuine binary .xlsx buffer
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Admin Master Function: Fetches entire RAM Finance database and compiles into
 * a complete, structured multi-sheet binary Microsoft Excel (.xlsx) Workbook.
 */
export async function downloadFullDatabaseAsExcel(supabase: any): Promise<{
  customersCount: number
  loansCount: number
  collectionsCount: number
  centersCount: number
  cashBookCount: number
  auditLogsCount: number
}> {
  // 1. Fetch Customers
  const { data: rawCustomers } = await supabase
    .from('customers')
    .select('*, centers(name, branches(name))')
    .order('created_at', { ascending: false })

  const customers = (rawCustomers || []).map((c: any) => ({
    'Client ID': c.client_id,
    'Customer Name': c.full_name,
    'Mobile Number': c.mobile_number,
    'Date of Birth': c.dob || 'N/A',
    'Gender': c.gender || 'Female',
    'KYC Doc Type': c.kyc_doc_type || 'Aadhaar (UID)',
    'UID / KYC Number': c.kyc_doc_number || '',
    'Residential Address': c.address || '',
    'Center Name': c.centers?.name || 'N/A',
    'Branch Name': c.centers?.branches?.name || '',
    'Nominee Name': c.nominee_name || '',
    'Nominee Relationship': c.nominee_relationship || '',
    'Nominee DOB': c.nominee_dob || '',
    'Nominee Mobile': c.nominee_mobile || '',
    'Nominee Address': c.nominee_address || '',
    'Photo Link': c.photo_url || '',
    'KYC Document Link': c.kyc_doc_url || '',
    'GPS Location': c.gps_location || '',
    'Account Status': c.status || 'Active',
    'Enrolled Date': c.created_at ? new Date(c.created_at).toLocaleDateString() : ''
  }))

  // 2. Fetch Loans
  const { data: rawLoans } = await supabase
    .from('loans')
    .select('*, loan_products(name, type, interest_rate), customers(client_id, full_name, mobile_number)')
    .order('created_at', { ascending: false })

  const loans = (rawLoans || []).map((l: any) => ({
    'Loan ID': l.loan_id,
    'Client ID': l.customers?.client_id || '',
    'Customer Name': l.customers?.full_name || '',
    'Customer Mobile': l.customers?.mobile_number || '',
    'Product Name': l.loan_products?.name || (l.loan_products?.type === 'LAP' ? 'LAP Loan' : l.loan_products?.type === 'Monthly Interest' ? 'Monthly Interest' : 'Micro Finance'),
    'Product Type': l.loan_products?.type || 'Micro Finance',
    'Cycle Number': l.cycle_number || 1,
    'Principal Amount (Rs)': l.principal_amount || 0,
    'Tenure': `${l.tenure_weeks || 0} ${l.loan_products?.type === 'Micro Finance' ? 'Weeks' : 'Months'}`,
    'EMI / EWI Amount (Rs)': l.emi_amount || 0,
    'Interest Rate (% / mo)': l.loan_products?.interest_rate || 2.0,
    'Processing Fee (Rs)': l.processing_fee || 0,
    'Disbursement Date': l.disbursement_date || 'Pending',
    'First EMI Date': l.first_emi_date || 'N/A',
    'Collection Day': l.collection_day || 'N/A',
    'Co-Applicant UID': l.co_applicant_uid || 'N/A',
    'Co-Applicant Photo Link': l.co_applicant_photo_url || '',
    'Property Photo Link': l.property_photo_url || '',
    'Disbursement Photo Link': l.disbursement_photo_url || '',
    'Field GPS Location': l.gps_location || '',
    'Loan Status': l.status || 'Pending Approval',
    'Application Date': l.created_at ? new Date(l.created_at).toLocaleDateString() : ''
  }))

  // 3. Fetch Collections
  const { data: rawCollections } = await supabase
    .from('collections')
    .select('*, customers(client_id, full_name), loans(loan_id)')
    .order('created_at', { ascending: false })

  const collections = (rawCollections || []).map((col: any) => ({
    'Voucher Number': col.voucher_number || `VCH-${col.id.slice(0, 8)}`,
    'Client ID': col.customers?.client_id || '',
    'Customer Name': col.customers?.full_name || '',
    'Loan ID': col.loans?.loan_id || '',
    'Amount Collected (Rs)': col.amount || 0,
    'Payment Mode': col.payment_mode || 'Cash',
    'UTR / UPI Reference': col.utr_number || (col.payment_mode === 'Cash' ? 'Cash' : 'N/A'),
    'Approval Status': col.status || 'Approved',
    'Collection Date': col.created_at ? new Date(col.created_at).toLocaleDateString() : '',
    'Rejection / Reversal Reason': col.rejection_reason || ''
  }))

  // 4. Fetch Centers & Branches
  const { data: rawCenters } = await supabase
    .from('centers')
    .select('*, branches(name, code)')
    .order('name', { ascending: true })

  const centers = (rawCenters || []).map((cen: any) => ({
    'Center Name': cen.name,
    'Branch Name': cen.branches?.name || '',
    'Branch Code': cen.branches?.code || '',
    'Meeting Day': cen.meeting_day || '',
    'Center ID': cen.id
  }))

  // 5. Fetch Branch Cash Daily Ledger
  const { data: rawCashDaily } = await supabase
    .from('branch_cash_daily')
    .select('*, branches(name)')
    .order('record_date', { ascending: false })

  const cashBook = (rawCashDaily || []).map((cb: any) => ({
    'Record Date': cb.record_date,
    'Branch': cb.branches?.name || '',
    'Opening Cash (Rs)': cb.opening_cash || 0,
    'Cash Collections (Rs)': cb.cash_collections || 0,
    'Digital Collections (Rs)': cb.digital_collections || 0,
    'Disbursements Paid (Rs)': cb.disbursements_paid || 0,
    'Branch Expenses (Rs)': cb.branch_expenses || 0,
    'Other Receipts (Rs)': cb.other_receipts || 0,
    'Other Payments (Rs)': cb.other_payments || 0,
    'Staff Handover (Rs)': cb.staff_handover || 0,
    'HO Remittance (Rs)': cb.ho_handover || 0,
    'Closing Cash System (Rs)': cb.closing_cash_system || 0,
    'Physical Cash Counted (Rs)': cb.physical_cash_counted || 0,
    'Difference / Variance (Rs)': cb.difference_amount || 0,
    'Reconciliation Status': cb.status || 'Reconciled'
  }))

  // 6. Fetch Audit Logs
  let auditLogs: any[] = []
  try {
    const { data: rawAudit } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000)

    if (rawAudit && rawAudit.length > 0) {
      auditLogs = rawAudit.map((a: any) => ({
        'Timestamp': a.created_at ? new Date(a.created_at).toLocaleString() : '',
        'Action': a.action,
        'Entity Type': a.entity_type,
        'Entity ID': a.entity_id || '',
        'Reason': a.reason || '',
        'Details': typeof a.details === 'object' ? JSON.stringify(a.details) : String(a.details || '')
      }))
    }
  } catch (err) {
    console.warn('Could not fetch audit_logs:', err)
  }

  // Compile sheets for Master Excel Workbook
  const sheets: ExcelSheetData[] = [
    { name: 'Customers', data: customers },
    { name: 'Loans', data: loans },
    { name: 'Collections', data: collections },
    { name: 'Centers & Branches', data: centers },
    { name: 'Daily Cash Book', data: cashBook }
  ]

  if (auditLogs.length > 0) {
    sheets.push({ name: 'Audit Logs', data: auditLogs })
  }

  // Trigger genuine binary XLSX Download
  await exportToExcelWorkbook(sheets, 'RAM_Finance_Complete_Database_Master')

  return {
    customersCount: customers.length,
    loansCount: loans.length,
    collectionsCount: collections.length,
    centersCount: centers.length,
    cashBookCount: cashBook.length,
    auditLogsCount: auditLogs.length
  }
}


