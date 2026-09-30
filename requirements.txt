RAM FINANCE
LOAN MANAGEMENT MOBILE & WEB APPLICATION
1. Purpose and Scope
RAM Finance requires a loan-management system covering customer onboarding, three loan products, field operations,
disbursement, collection, approval controls, WhatsApp communication, documents/photos, loan cards, bills/receipts,
reporting, portfolio monitoring and administration.
The application should be mobile-first for field staff, with a web dashboard for Managers and Admin. The system must
use a Maker–Checker workflow so that important transactions are verified before final posting.
2. Loan Products
Product Repayment Core requirement
Micro Finance Loan Weekly EWI/EMI Fixed EWI for selected loan amount
and tenure.
LAP – Loan Against Property Monthly
Interest/EMI terms configured by
authorized Manager/BRM.
Monthly Interest Loan
Monthly interest / bullet / part
payment
Monthly interest generated from
disbursement date; supports part
payment and closure.
3. Micro Finance Product
Micro Finance is a weekly loan with a fixed EWI for the selected tenure. Product values must be configurable by Admin
and must not be hard-coded.
Loan Amount Tenure (Weeks) EWI
₹10,000 20 ₹630
₹10,000 15 ₹820
₹15,000 25 ₹750
₹15,000 30 ₹630
₹20,000 25 ₹990
₹20,000 30 ₹830
₹20,000 40 ₹630
₹25,000 25 ₹1,230
₹25,000 30 ₹1,030
₹25,000 40 ₹790
₹30,000 25 ₹1,450
₹30,000 30 ₹1,230
₹30,000 40 ₹930
₹30,000 52 ₹730
₹30,000 60 ₹640
4. Client ID and Loan ID
4.1 Permanent Client ID
Each customer must have one permanent Client ID. Example: RF0001, RF0002, RF0003. The Client ID must never
change across loan cycles.
RAM FINANCE – Loan Management Application SRS | Confidential
Loan Cycle Prefix Examples
1st Cycle PPRA PPRA0001, PPRA0002, PPRA0003
2nd Cycle PPRB PPRB0001, PPRB0002, PPRB0003
3rd Cycle PPRC PPRC0001, PPRC0002, PPRC0003
Future cycles Next configured cycle prefix Must remain unique and sequential.
4.2 Loan ID by Cycle
 System must prevent duplicate Client IDs and Loan IDs.
 Existing customers must retain the same Client ID.
 When a repeat customer receives a new cycle, the system must link the new Loan ID to the permanent Client ID and
display complete loan history.
 Loan numbering must be generated automatically and must not reset unexpectedly.
.PROCESSING FEE
New customer 3%
Exisiting 3%
5. Customer Master / KYC
 Client ID and customer profile.
 Customer name, DOB, gender where required, mobile number and address.
 Nominee name, DOB, mobile number, address and relationship.
 KYC/document details and document uploads.
 Customer photograph.
 Customer/field location and GPS where required.
 Complete loan history under the permanent Client ID.
 Search by Client ID, Loan ID, customer name, mobile number, center, staff or UTR.
Role Primary responsibility Access
Staff – Maker Field entry and operational work Mobile-first; assigned
customers/centers only.
Manager – Checker Verification and approval Branch/assigned portfolio; approvals
and reports.
Admin – Control Full system administration
All branches, products, users,
reports, settings and exports.
6. User Roles and Access
The permission architecture should support adding future roles such as Branch Manager, Regional Manager, Accounts,
HO and Auditor/Viewer without redesigning the core system.
7. Staff Mobile App
7.1 Customer/KYC Entry
 New customer entry
 Customer photo
 Nominee details
RAM FINANCE – Loan Management Application SRS | Confidential
 KYC/document upload
 GPS/location
 Customer search
 Existing customer history
7.2 Disbursement Entry
 Select customer and loan product.
 Enter loan amount, tenure, rate/terms and first due date as applicable.
 Micro Finance: select approved amount/tenure/EWI.
 LAP: enter approved interest/EMI terms.
 Monthly Interest: enter principal, interest terms and repayment mode.
 Upload customer photo, location, nominee confirmation photo/call recording where required.
 Submit to Manager for approval.
8. Collection Module
 Staff selects Center → Customer → Loan → Collection.
 Payment modes: Cash, Digital/UPI/Bank transfer and other configured modes.
 Cash collection must capture amount and denomination.
 Digital collection must capture UTR/transaction number and screenshot/proof where required.
 System calculates current demand, arrear, total collection, advance, outstanding and repayment status.
 Collection should remain pending until Manager approval where Maker–Checker is required.
 Approved collection must update the loan account and customer history.
9. Collection Voucher
 Staff generates collection voucher after entry.
 Voucher contains Client ID, Loan ID, customer, amount, date, payment mode and reference/UTR.
 Manager verifies voucher, cash/denomination and digital proof.
 Approved voucher posts to the customer account.
 Rejected vouchers must record rejection reason and return to Staff for correction.
 Approved transactions must not be freely deleted by Staff; corrections must use an authorized reversal/correction
process.
10. Demand Management
10.1 Micro Finance Demand
 Weekly demand generation
 Current EWI
 Arrear EWI
 Total demand
 Collection day
 Center
 Staff
 Customer and Loan ID
10.2 LAP Demand
Monthly demand. Current business rule specifies LAP EMI dates of the 5th and 10th; these dates must be configurable.
RAM FINANCE – Loan Management Application SRS | Confidential
10.3 Monthly Interest Demand
Monthly interest must be generated from the loan's disbursement date according to the configured interest rules.
11. WhatsApp / Customer Communication
 Before-demand WhatsApp reminder.
 Post-collection WhatsApp confirmation after Manager approval.
 Message should include customer name, Loan ID, amount, payment date, payment mode, UTR/reference and
balance/outstanding where applicable.
 Admin should be able to configure message templates.
 Vendor must state whether WhatsApp/API charges are included or additional.
12. LAP – Loan Against Property
 Interest/EMI rate and terms configured by authorized Manager/BRM.
 Interest is calculated from the time of disbursement.
 Delay must calculate according to the approved business rule.
 Current stated rule: if EMI is delayed beyond 3 days, an additional 2% applies to delayed days only. The exact
mathematical formula must be finalized and approved before development.
 Capture client photo, co-applicant photo, property photo and property GPS/location.
 Store required property/KYC documents.
 Manager approval for loan and disbursement.
 First EMI date/selection/update by Manager.
 Loan card and bill/receipt printing.
 Monthly demand and WhatsApp reminder.
 Lap forclose chanrges 2%
.PROCESSING FEE
New customer 2.5%
13. Monthly Interest Loan
 Supports bullet payment.
 Supports monthly interest payment.
 Supports part payment of principal.
 Supports full closure.
 Monthly interest is generated from the disbursement date.
 Interest should be recalculated after part payment according to the approved business rule.
 Closure amount should include principal outstanding, current interest, arrears and applicable charges.
 Manager approval is required for closure.
 Capture customer photo and security/property/bike photo as applicable.
 Capture location and required documents.
14. Disbursement Workflow
Recommended workflow:
Staff Entry → Manager Verification → Manager Approval → Disbursement → Loan Active
RAM FINANCE – Loan Management Application SRS | Confidential
 Approval screen must show customer, Client ID, Loan ID, product, amount, tenure, EMI/EWI, interest rate, nominee,
documents, photos, GPS and required confirmations.
 Manager can approve or reject with mandatory rejection reason.
 System must record who approved, date and time.
15. First EMI Control
 Manager can confirm/select first EMI date.
 Manager can confirm collection day.
 System generates future demand dates automatically.
 Changes after approval require authorized correction and audit trail.
16. Loan Card and Bill/Receipt Printing
Document Required information
Loan Card Client ID, Loan ID, customer, loan amount, tenure,
EMI/EWI, due dates, collection history, outstanding.
Collection Bill/Receipt Customer, Loan ID, collection amount, date, payment
mode, UTR, balance, Staff and approval status.
17. Manager Dashboard
 Today's demand, collection and arrear.
 Pending collection approvals.
 Pending disbursement approvals.
 Daily/weekly/monthly disbursement.
 Active, closed and overdue loans.
 Staff-wise and center-wise collection.
 Cash and digital collection.
 Rejected/pending transactions.
 Portfolio and OD monitoring.
BRANCH CASH MANAGEMENT
The system should maintain a daily branch-level financial position covering:
1. Opening cash balance
2. Cash collection
3. Digital collection
4. Approved disbursement payments
5. Branch expenses
6. Other cash receipts/payments
7. Staff cash handover
8. Admin/HO handover
9. Closing cash balance
10.Digital balance reconciliation
The system should show expected balance vs actual balance.RAM FINANCE – Loan Management Application SRS | Confidential
18. Admin Dashboard and Reports
18.1 Portfolio Reports
 Total active customers
 Total active loans
 Total outstanding
 Product-wise outstanding
 Branch-wise outstanding
18.2 Demand Reports
 Total demand
 Current EMI
 Arrear
 Collection
 Collection percentage
 Staff-wise
 Center-wise
 Branch-wise
18.3 Disbursement Reports
 Daily
 Weekly
 Monthly
 Staff-wise
 Product-wise
 Branch-wise
18.4 Collection Reports
 Cash
 Digital
 UTR
 Staff-wise
 Center-wise
 Product-wise
 EMI-wise
 Approved/pending/rejected
18.5 OD / Arrear Reports
 OD amount
 OD days
 Customer
 Loan
 Center
 Staff
 Ageing
18.6 Profit & Loss
 Interest income
RAM FINANCE – Loan Management Application SRS | Confidential
 Processing/document charges
 Late charges
 Other income
 Staff expenses
 Branch expenses
 Other expenses
 Daily P&L
 Monthly P&L
 Product-wise P&L
 Branch-wise P&L
Accounting treatment and P&L formulas must be approved by RAM Finance management/accounting team before
implementation.
19. Branch, Center and Staff Management
 Branch master.
 Center master.
 Staff master.
 Manager master.
 Staff-to-center assignment.
 Manager-to-branch/portfolio assignment.
 Staff must only see assigned customers/centers unless explicitly authorized.
 Manager must only see authorized branch/portfolio data.
 Admin has full access.
20. Controls and Security
 Duplicate Client ID prevention.
 Duplicate Loan ID prevention.
 Duplicate collection prevention.
 Maker–Checker approval.
 Role-based permissions.
 No unrestricted deletion of approved transactions.
 Correction/reversal workflow.
 Approval/rejection reason.
 User/date/time tracking for important actions.
 Session/login security and password controls.
 Secure document/photo storage.
 Data encryption in transit and at rest where supported.
21. Field Evidence and GPS
 Customer photograph where required.
 Disbursement photograph.
 Nominee confirmation photograph or call recording where required.
 Property/security photograph for LAP and Monthly Interest Loan.
 GPS/location capture.
 Prefer photo metadata/timestamp where technically possible.
 Vendor must specify storage limits, retention period and backup policy.
RAM FINANCE – Loan Management Application SRS | Confidential
22. Offline / Poor Network Requirement
Because field collection is mobile-based, vendor must confirm whether the app supports offline or low-connectivity entry.
If offline entry is supported, the vendor must explain synchronization, duplicate prevention and conflict handling.
23. Backup, Data Ownership and Export
 RAM Finance must own its business data.
 Full data export to Excel/CSV should be available.
 Automatic backup should be available.
25. Search and Customer History
 Search by Client ID.
 Search by Loan ID.
 Search by customer name.
 Search by mobile number.
 Search by UTR.
 Search by Center.
 Search by Staff.
 Open permanent Client ID to view all loan cycles, collections, arrears, documents and closure history.
26. Loan Lifecycle
The system should support the complete lifecycle:
Customer → KYC → Loan Entry → Verification → Approval → Disbursement → First EMI → Demand →
Collection → Manager Approval → Receipt/WhatsApp → Arrear/OD Monitoring → Part Payment (where
applicable) → Closure
27. Recommended Statuses
Module Suggested statuses
Loan
Draft / Submitted / Approved / Rejected / Disbursed /
Active / Closed / Cancelled
Collection
Draft / Submitted / Pending Approval / Approved /
Rejected / Reversed
Disbursement Draft / Submitted / Pending Approval / Approved /
Rejected / Disbursed
Customer Draft / Active / Inactive / Blocked
Document Pending / Uploaded / Verified / Rejected
28. Vendor Demo Acceptance Test
Before purchase, the vendor should demonstrate the following complete transaction flow using RAM Finance examples:
 New customer → permanent Client ID.
 First Micro Finance loan → PPRA Loan ID.
 Second cycle → PPRB Loan ID linked to the same Client ID.
 Manager approval → disbursement.
 First EMI setup → automatic weekly demand.
 Staff collection → cash denomination or UTR/screenshot.
RAM FINANCE – Loan Management Application SRS | Confidential
 Manager collection approval → account update and WhatsApp confirmation.
 LAP loan → property photos/GPS → approval → monthly demand.
 Monthly Interest Loan → monthly interest → part payment → recalculation → closure.
 Loan card and receipt/bill printing.
 Demand, arrear, disbursement and collection reports.
 OD report and P&L.
 Data export and backup demonstration.
RAM FINANCE – Loan Management Application SRS | Confidential