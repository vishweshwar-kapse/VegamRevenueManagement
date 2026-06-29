# Revenue Management Portal - Low Level Technical Specification

## 1. Purpose
This document translates `Revenue Mgmt - Spec v1.docx` into a Phase-1 screen-level technical specification for the web application.

The goal is to define:
- the complete page inventory from login onward,
- the role-based visibility model,
- the primary user journeys,
- the expected sections/components on each screen,
- and the key business rules that must be enforced in the UI.

## 2. Scope and assumptions
This specification covers the Phase-1 web product only.

### 2.1 In scope
- Username/password authentication
- Role-based web application shell
- Dashboard and operational drill-downs
- Forecast, SOW, PO, Invoice, Payment, Cashflow modules
- Bulk upload, repository, notifications, reports, administration

### 2.2 Out of scope
- SSO, MFA, Microsoft Entra
- ERP/accounting/bank integrations
- Advanced approval workflows
- Tax automation
- Enterprise IAM complexity
- Predictive AI automation beyond lightweight recommendations

### 2.3 Derived implementation assumptions
The source spec is strong on business behavior and lighter on enabling master-data screens. To make the product implementable, this document includes the following derived Phase-1 pages:
- Customer Master maintenance
- System Configuration
- Audit Log viewer
- Access denied / session expired states

## 3. Roles used in this document
- `FIN`: Finance
- `ADM`: Admin
- `MGMT`: Management
- `AMPM`: Account Manager / Project Manager
- `ROPM`: Read-Only PM

## 4. Global product structure

### 4.1 Primary navigation
Authenticated users should see a persistent application shell with:
- left navigation or top navigation,
- global search,
- notifications bell,
- role switcher where allowed,
- user profile menu,
- FY selector,
- currency toggle where applicable.

### 4.2 Proposed route map
- `/login`
- `/dashboard`
- `/forecasts`
- `/forecasts/new`
- `/forecasts/:id`
- `/sows`
- `/sows/new`
- `/sows/:id`
- `/pos`
- `/pos/new`
- `/pos/:id`
- `/invoices`
- `/invoices/requests/new`
- `/invoices/:id`
- `/payments`
- `/payments/:invoiceId`
- `/cashflow`
- `/cashflow/scenarios`
- `/uploads`
- `/uploads/:batchId`
- `/repository`
- `/repository/:docId`
- `/notifications`
- `/reports`
- `/reports/:reportKey`
- `/admin/users`
- `/admin/customers`
- `/admin/config`
- `/admin/audit-logs`
- `/access-denied`
- `/session-expired`

### 4.3 Core shared UI behaviors
- All list pages must support search, filter, sort, export, and drill-down.
- All money views must consistently show currency.
- Liquidity-sensitive views must be hidden for `AMPM` and `ROPM` as per role rules.
- Documents must support open, preview, download, and history where applicable.
- Alerts must use severity colors: Red = critical, Amber = important, Blue = informational.

## 5. End-to-end business flow
1. User logs in.
2. User lands on role-appropriate dashboard.
3. `AMPM` creates and maintains Forecasts.
4. `AMPM` creates/uploads SOWs and revisions.
5. Customer PO is uploaded and linked to SOW(s).
6. `AMPM` raises invoice request when milestone/commercial condition is ready.
7. `FIN` prepares draft invoice, validates against effective PO value, previews, and issues.
8. Issued invoice creates revenue recognition and receivable.
9. `FIN` records payment realizations; invoice status becomes Outstanding / Partial / Paid.
10. Realizations feed receivables, dashboard KPIs, cashflow, and runway views.
11. `MGMT` uses dashboard, cashflow, alerts, and reports for decision support.

## 6. Role visibility summary by module
| Module/Page | FIN | ADM | MGMT | AMPM | ROPM |
|---|---|---|---|---|---|
| Login | Y | Y | Y | Y | Y |
| Dashboard | Y | Y | Y | Y | Y-limited |
| Forecast | Full | View | Full | Full | Read |
| SOW | Full | View | Full | Full | Read |
| PO | Full | View | Full | View/Link | Read |
| Invoice | Full | View | Full | Request + View | Read |
| Payment/Receivables | Full | View | Full | Limited View | Restricted |
| Cashflow/Runway | Full | Full | Full | Restricted | No |
| Bulk Upload | Full | Full | Optional View | View imported data | No |
| Repository | Full | Full | Full | View/Download | Read |
| Notifications | Full | Full | Strategic | Operational | Limited |
| Reports | Full | Full | Full | Limited Financial | Restricted |
| Admin | No | Full | No | No | No |

## 7. Detailed screen specification

### 7.1 Login screen
**Route:** `/login`  
**Roles:** all users

**Purpose**
- Authenticate organization-managed users using username/password.

**UI sections**
- Company/product branding
- Username field
- Password field
- Sign In button
- Validation/error area

**Rules**
- Only standard username/password in Phase-1.
- No self-service SSO/MFA.
- Failed attempts should surface a generic error and be audit logged.
- Repeated failed attempts should trigger governance alerts.

**Post-login behavior**
- Redirect to `/dashboard`.
- Load role-based navigation from user profile.

### 7.2 Session expired / access denied
**Routes:** `/session-expired`, `/access-denied`

**Purpose**
- Provide controlled UX for auth timeout and unauthorized access.

**Actions**
- Re-login
- Return to dashboard if allowed

### 7.3 Dashboard / landing screen
**Route:** `/dashboard`

**Purpose**
- Main operational cockpit and decision-support landing page.

**UI sections**
- Top KPI strip: Revenue Invoiced, Revenue Realized, Revenue Outlook, Outstanding Receivables, Overdue Receivables, Cash Runway
- Action Required panel
- Forecast snapshot
- SOW snapshot
- PO/Invoice snapshot
- Receivables & collections section
- Cashflow snapshot / runway status

**Controls**
- FY selector for FY-bound KPIs
- Currency toggle (USD/INR initially)
- Role-aware visibility

**Drill-down links**
- Revenue Outlook -> Forecasts
- Outstanding / Overdue -> Invoices or Payments filtered view
- Open SOW -> SOW list
- Pending Invoice Requests -> Invoice module
- RED runway month -> Cashflow module

### 7.4 Forecast list/workbench
**Routes:** `/forecasts`, `/forecasts/new`

**Purpose**
- Operational planning view for future revenue expectations.

**List columns**
- Forecast ID
- Customer
- Forecast Description
- FY
- Forecast Value
- Currency
- Status (`Projected`, `Signed`)
- Owner
- Distribution Summary
- Signed Value
- Remaining Value

**Filters**
- FY, Customer, Status, Owner, Currency, Open Historical Items

**Primary actions**
- Create forecast
- Edit forecast
- Update distribution
- Mark revised outlook
- Open conversion detail

**Business rules**
- Partial conversion is allowed.
- `PO Value < Forecast Value` keeps remaining value projected.
- `PO Value > Forecast Value` is allowed and must remain visible as operational flexibility.
- Forecasts can remain active across long durations; avoid hard closure logic.

### 7.5 Forecast detail page
**Route:** `/forecasts/:id`

**Sections**
- Header summary
- Distribution view by FY/quarter
- Linked SOW / PO conversion panel
- History / update log
- Alerts panel

**Key behaviors**
- Show Signed vs Projected composition.
- Display conversion percentage and remaining value.
- Show stale forecast / delayed conversion warnings.

### 7.6 SOW list/workbench
**Routes:** `/sows`, `/sows/new`

**Purpose**
- Manage SOW records, revisions, document linkage, and commercial traceability.

**List columns**
- SOW ID
- Customer
- SOW Description
- Version
- Status (`Draft`, `Submitted`, `Linked`)
- Forecast Linkage
- Linked PO Value
- Owner
- Last Updated

**Filters**
- Customer, Status, Owner, FY, Open SOWs, Linked PO Status

**Primary actions**
- Create SOW record
- Upload document
- Upload revised version
- Link/unlink forecast
- Open repository/history
- Archive/inactivate

**Business rules**
- SOW content is created externally; platform manages metadata and files.
- Deletion should be restricted; archive preferred over delete.
- Active version must be clearly identifiable.

### 7.7 SOW detail page
**Route:** `/sows/:id`

**Sections**
- SOW summary
- Version history
- Document repository pane
- Linked Forecast / PO view
- Invoice readiness / uninvoiced value indicators
- Alerts panel

**Alerts**
- SOW without PO
- Draft SOW pending submission
- Missing SOW document
- Revised SOW pending linkage

### 7.8 PO list/workbench
**Routes:** `/pos`, `/pos/new`

**Purpose**
- Govern customer commercial commitment and billing eligibility.

**List columns**
- PO Number
- Customer
- Linked SOW
- PO Value
- Currency
- Invoiced Value
- Remaining Value
- Status (`Open`, `Partial`, `Closed`, `Cancelled`)
- Owner

**Primary actions**
- Create/upload PO
- Link SOW(s)
- Upload amendment
- Cancel/close PO with remarks
- Open repository and amendment history

**Business rules**
- PO is customer-issued commitment, not an internal artifact.
- One-to-many and many-to-one SOW/PO linkage must be supported.
- Effective PO value must consider amendments.
- Remaining eligible value = effective PO value - already invoiced value.

### 7.9 PO detail page
**Route:** `/pos/:id`

**Sections**
- PO summary
- Linked SOWs
- Amendment history
- Invoice eligibility view
- Document repository
- Alert panel

**Eligibility panel must show**
- Eligible invoice value
- Invoiced amount
- Uninvoiced balance
- Milestone linkage
- Billing readiness notes

### 7.10 Invoice request creation
**Route:** `/invoices/requests/new`
**Primary roles:** `AMPM`, `FIN`

**Purpose**
- Raise billing initiation request before formal invoice generation.

**Form fields**
- Customer
- Linked PO
- Linked SOW / milestone
- Requested invoice amount
- Currency
- Requested invoice date
- Description / billing note
- Supporting remarks

**Rules**
- Invoice request is not an invoice.
- AM/PM can initiate request but cannot issue invoice.
- Missing linkage or billing info must be flagged.

### 7.11 Invoice operations workbench
**Route:** `/invoices`

**Suggested tabs**
- Requests
- Drafts
- Issued
- Partial / Overdue
- Cancelled / Reversed

**List columns**
- Invoice Number
- Customer
- PO Reference
- Invoice Value
- Currency
- Invoice Date
- Pay-by Date
- Status (`Draft`, `Issued`, `Partial`, `Paid`)
- Outstanding Amount
- Overdue Days

**Primary actions**
- Review request
- Generate draft
- Edit draft
- Validate against PO
- Issue invoice
- Email invoice
- Cancel draft / reverse issued invoice

**Core validations**
- Total invoiced value must be `<= Effective PO Value`.
- Pay-by date derives from customer credit period.
- Draft remains editable until issued.
- Issued invoice becomes immutable.

### 7.12 Invoice detail / draft preview
**Route:** `/invoices/:id`

**Sections**
- Invoice header and commercial references
- Draft preview / PDF preview
- Billing line summary
- Delivery/email log
- Payment / realization tab
- Audit trail

**Auto-populated fields**
- Invoice Number
- Invoice Date
- Pay-by Date
- Customer Details
- Billing Address
- PO Reference
- Invoice Amount
- Currency
- Amount in words

**Alerts**
- Overdue invoice
- Draft pending issue
- Invoice exceeding PO
- Missing PO linkage
- Partial payment follow-up

### 7.13 Payment / receivables workbench
**Route:** `/payments`

**Purpose**
- Main collection monitoring and realization tracking screen.

**Summary metrics**
- Outstanding Receivables
- Overdue Receivables
- Paid Invoices
- Partial Settlements
- Collection Efficiency

**List columns**
- Invoice Number
- Customer
- Invoice Value
- Outstanding Amount
- Due Date
- Aging
- Status (`Outstanding`, `Partial`, `Paid`)
- Last Realization Date

**Primary actions**
- Open realization entry
- Filter overdue accounts
- Review payment history
- Export aging / collection view

### 7.14 Realization entry screen
**Route:** `/payments/:invoiceId`
**Primary role:** `FIN`

**Purpose**
- Record actual cash realization against an invoice.

**Fields**
- Realization Date
- Realized Amount
- Currency
- FX Difference
- Payment Reference
- Remarks

**Rules**
- Multiple realization entries per invoice must be supported.
- Remaining outstanding = invoice value - total realized amount.
- Status auto-calculates to Outstanding / Partial / Paid.

### 7.15 Payment history panel
**Embedded in:** `/payments/:invoiceId` and `/invoices/:id`

**Shows**
- Settlement history
- Partial payment entries
- FX variance visibility
- Remaining balance after each realization
- User/date traceability

### 7.16 Cashflow & runway dashboard
**Route:** `/cashflow`

**Purpose**
- Financial intelligence and future liquidity planning.

**Summary metrics**
- Cash Runway
- Expected Future Inflows
- Monthly Burn Rate
- Collection Dependency
- Liquidity Health

**Sections**
- Future cashflow table by month name
- Cumulative balance graph/table
- Alerts & risks panel
- AI recommendations panel

**Monthly view columns**
- Month
- Expected collections
- Forecast contribution
- Planned expenses
- Net cash position
- Cumulative balance
- Status color

**Rules**
- Use month names, not accounting period codes.
- Highlight RED liquidity months.
- `AMPM` and `ROPM` must not access sensitive runway planning.

### 7.17 Scenario planning page
**Route:** `/cashflow/scenarios`

**Purpose**
- Compare baseline and management scenarios.

**Scenario types**
- Baseline
- Optimistic
- Conservative
- Stress Case
- Delayed Collections
- Reduced Forecast Conversion
- Expense Increase
- Accelerated Billing

**Outputs**
- Revised runway month
- RED month movement
- Inflow/outflow variance
- Recommended operational actions

### 7.18 Bulk upload dashboard
**Route:** `/uploads`

**Purpose**
- Historical onboarding and controlled transaction imports.

**Main sections**
- Upload template guidance
- File upload control
- Validation preview grid
- Error/warning summary
- Commit confirmation
- Upload history list

**Rules**
- XLS is primary upload mechanism.
- Import preview is mandatory before commit.
- Partial success and reprocessing must be supported.

### 7.19 Upload result detail
**Route:** `/uploads/:batchId`

**Shows**
- Upload date
- Uploaded by
- Batch status
- Successful rows
- Failed rows
- Reprocessed rows
- Downloadable error report

### 7.20 Commercial repository landing
**Route:** `/repository`

**Purpose**
- Customer-centric reference repository for non-transactional commercial documents.

**Summary metrics**
- Total Customers
- Active Agreements
- Archived Agreements
- Pending Renewals
- Latest Uploaded Documents

**List columns**
- Customer
- Document Type
- Document Name
- Version
- Status
- Uploaded By
- Last Updated

**Primary actions**
- Upload
- Preview
- Open
- Download
- View version history
- Archive

### 7.21 Repository document detail
**Route:** `/repository/:docId`

**Sections**
- Document viewer
- Metadata panel
- Version history
- Related customer/account info
- Alerts panel

**Alerts**
- Missing agreement
- Expiring commercial reference
- Updated pricing sheet
- Archived agreement accessed

### 7.22 Notifications center
**Route:** `/notifications`

**Purpose**
- Consolidated in-app notification and alert center.

**Tabs / filters**
- Informational
- Warning
- Critical
- Module
- Assigned to me
- Unread

**Must support notifications for**
- Forecast aging / delayed conversion
- Draft SOW pending submission
- PO uploaded / amended / without SOW
- Invoice request pending / draft pending / invoice issued / invoice exceeds PO
- Overdue receivables / partial realization / large outstanding balance
- RED liquidity months
- Upload failures / duplicates / reprocessing results
- Governance alerts like inactive user or failed login attempts

### 7.23 Reports & KPI hub
**Routes:** `/reports`, `/reports/:reportKey`

**Purpose**
- Operational and management reporting with exportability.

**Report groups**
- Forecast reports
- SOW/commercial reports
- PO & billing reports
- Receivables / aging reports
- Cashflow / runway reports
- Customer-level reports
- Alert & risk reports

**Common report controls**
- Customer filter
- FY filter
- Month filter
- Owner filter
- Status filter
- Module filter
- Search
- Export to XLS/PDF
- Print view

### 7.24 Administration - users and roles
**Route:** `/admin/users`
**Primary role:** `ADM`

**Purpose**
- Manage user lifecycle and access.

**List columns**
- User name
- Email / login ID
- Assigned role
- Status
- Last login
- Created by
- Updated at

**Actions**
- Create user
- Assign role
- Change role
- Deactivate user
- Reset access

**Special behavior**
- Finance/Admin role switcher must also be available in header when applicable.

### 7.25 Administration - customer master
**Route:** `/admin/customers`
**Primary role:** `ADM`

**Purpose**
- Maintain customer data required by invoicing, due-date logic, and reporting.

**Suggested fields**
- Customer name
- Legal entity name
- Billing address
- Default currency
- Credit period
- Invoice recipient emails
- Account owner
- Active/inactive flag

### 7.26 Administration - system configuration
**Route:** `/admin/config`
**Primary role:** `ADM`

**Purpose**
- Maintain Phase-1 configuration required for governance and consistency.

**Suggested config areas**
- Financial year definitions
- Currency defaults and dashboard reporting currency
- Invoice numbering pattern
- Notification rules / recipients
- Upload template versions
- Expense categories for cashflow planning
- Alert thresholds

### 7.27 Administration - audit log viewer
**Route:** `/admin/audit-logs`
**Primary role:** `ADM`

**Purpose**
- Provide operational traceability for important actions.

**Must log at minimum**
- Invoice issuance
- Realization updates
- SOW version upload
- PO amendment upload
- Bulk upload execution
- User/role changes
- Failed login / unauthorized access attempts

## 8. Cross-screen business rules
- Forecast, invoice, receivable, realization, and cashflow are separate concepts and must not be merged in UI wording.
- Outstanding and Overdue are operational live-state values and are not FY-bound.
- Revenue Outlook is FY-bound and should combine invoiced plus expected recognized revenue.
- Invoice issue is finance-controlled only.
- Revenue recognition occurs on issued invoice, not on payment realization.
- Payment realization updates cash position, receivables, and cashflow views.
- Document deletion should generally be replaced by archive/inactive behavior.
- Every important transaction should show `created by`, `updated by`, and timestamp metadata.

## 9. Recommended Phase-1 delivery sequence
1. Authentication + app shell + role guards
2. Dashboard
3. Forecast
4. SOW
5. PO
6. Invoice request + invoice operations
7. Payment / receivables
8. Cashflow + runway
9. Notifications
10. Reports
11. Repository
12. Bulk upload
13. Administration

## 10. Open product questions to confirm before development
- Should invoice requests be a separate page or the first tab inside the Invoice module?
- Does Phase-1 require self-service password reset, or only admin-driven reset access?
- Should customer master also support multiple billing contacts per customer/legal entity?
- Should cashflow scenario results be saved, or remain ad-hoc simulations only?
- What exact export formats are mandatory per module in Phase-1?

## 11. Conclusion
This screen specification converts the source business spec into a build-ready page inventory and workflow design for the Revenue Management Portal. It preserves the source principles of operational realism, financial clarity, governance visibility, and decision-support orientation while keeping Phase-1 implementation practical.