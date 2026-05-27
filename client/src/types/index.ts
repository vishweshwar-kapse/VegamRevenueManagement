// ─── Shared Types ────────────────────────────────────────────────────────────

export type Currency = 'USD' | 'INR' | 'EUR' | 'GBP' | 'SGD' | 'AED';

export type UserRole = 'finance_admin' | 'management' | 'am_pm' | 'read_only_pm';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

// ─── Customer ─────────────────────────────────────────────────────────────────

export interface ContactPerson {
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  isPrimary?: boolean;
}

export interface Customer {
  _id: string;
  code: string;
  name: string;
  displayName?: string;
  industry?: string;
  country?: string;
  defaultCurrency: Currency;
  creditPeriodDays: number;
  billingAddress?: string;
  contacts: ContactPerson[];
  gstin?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Forecast ─────────────────────────────────────────────────────────────────

export type ForecastStatus = 'projected' | 'signed' | 'closed';

export interface ForecastDistribution {
  fy: string;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  total: number;
}

export interface Forecast {
  _id: string;
  forecastId: string;
  customerId: string | Customer;
  description: string;
  fy: string;
  totalValue: number;
  currency: Currency;
  status: ForecastStatus;
  ownerId: string | User;
  distributions: ForecastDistribution[];
  signedValue: number;
  projectedValue: number;
  linkedSOWIds: string[];
  linkedPOIds: string[];
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── SOW ──────────────────────────────────────────────────────────────────────

export type SOWStatus = 'draft' | 'submitted' | 'linked' | 'closed' | 'archived';

export interface SOWDocument {
  _id: string;
  originalName: string;
  filePath: string;
  version: number;
  isActive: boolean;
  uploadedBy: string | User;
  uploadedAt: string;
  remarks?: string;
}

export interface SOW {
  _id: string;
  sowId: string;
  customerId: string | Customer;
  forecastId?: string | Forecast;
  title: string;
  description?: string;
  scope?: string;
  startDate?: string;
  endDate?: string;
  totalValue?: number;
  currency?: Currency;
  currentVersion: number;
  status: SOWStatus;
  ownerId: string | User;
  documents: SOWDocument[];
  linkedPOIds: string[];
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── PO ───────────────────────────────────────────────────────────────────────

export type POStatus = 'open' | 'partial' | 'closed' | 'cancelled';

export interface POAmendment {
  amendmentNumber: number;
  previousValue: number;
  newValue: number;
  effectiveDate: string;
  remarks?: string;
  uploadedBy: string | User;
  uploadedAt: string;
}

export interface PO {
  _id: string;
  poNumber: string;
  customerId: string | Customer;
  linkedSOWIds: string[];
  poDate: string;
  poValue: number;
  effectivePOValue: number;
  currency: Currency;
  invoicedValue: number;
  remainingValue: number;
  status: POStatus;
  ownerId: string | User;
  amendments: POAmendment[];
  milestones?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Invoice ──────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'issued' | 'partial' | 'paid' | 'cancelled' | 'overdue';

export interface InvoiceRequest {
  requestedBy: string | User;
  requestedAt: string;
  requestedAmount: number;
  description: string;
  remarks?: string;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  customerId: string | Customer;
  poId: string | PO;
  sowId?: string | SOW;
  invoiceDate: string;
  payByDate: string;
  invoiceValue: number;
  currency: Currency;
  status: InvoiceStatus;
  description: string;
  milestoneDescription?: string;
  taxAmount?: number;
  taxDescription?: string;
  totalAmount: number;
  request: InvoiceRequest;
  issuedBy?: string | User;
  issuedAt?: string;
  realizedAmount: number;
  outstandingAmount: number;
  overdueDays: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Payment ──────────────────────────────────────────────────────────────────

export interface Payment {
  _id: string;
  invoiceId: string | Invoice;
  customerId: string | Customer;
  realizationDate: string;
  realizedAmount: number;
  currency: Currency;
  invoiceCurrency: Currency;
  invoiceAmount: number;
  fxDifference: number;
  fxRate?: number;
  paymentReference?: string;
  remarks?: string;
  recordedBy: string | User;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Expense ──────────────────────────────────────────────────────────────────

export type ExpenseCategory =
  | 'payroll'
  | 'infrastructure'
  | 'travel'
  | 'vendor_payments'
  | 'investments'
  | 'miscellaneous'
  | 'other';

export interface ExpenseLineItem {
  category: ExpenseCategory;
  description?: string;
  amount: number;
}

export interface Expense {
  _id: string;
  month: number;
  year: number;
  monthYear: string;
  currency: Currency;
  lineItems: ExpenseLineItem[];
  totalAmount: number;
  isBudgeted: boolean;
  notes?: string;
  recordedBy: string | User;
  createdAt: string;
  updatedAt: string;
}

// ─── Commercial Reference ─────────────────────────────────────────────────────

export type ReferenceDocType =
  | 'msa'
  | 'global_agreement'
  | 'nda'
  | 'pricing_sheet'
  | 'rate_card'
  | 'commercial_annexure'
  | 'governance_document'
  | 'legal_addendum'
  | 'other';

export type ReferenceStatus = 'active' | 'archived' | 'expired';

export interface CommercialReference {
  _id: string;
  customerId: string | Customer;
  documentType: ReferenceDocType;
  title: string;
  description?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  currentVersion: number;
  status: ReferenceStatus;
  tags?: string[];
  notes?: string;
  uploadedBy: string | User;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Dashboard KPIs ───────────────────────────────────────────────────────────

export interface DashboardKPIs {
  revenueInvoiced: number;
  revenueRealized: number;
  revenueOutlook: number;
  outstandingReceivables: number;
  overdueReceivables: number;
  cashRunway: {
    status: 'green' | 'red' | 'warning';
    greenTill?: string;     // e.g. "Feb-27"
    redFrom?: string;       // e.g. "Mar-27"
  };
  currency: Currency;
  fy: string;
}

export interface ActionAlert {
  type: 'overdue_invoice' | 'pending_invoice_request' | 'sow_without_po' | 'missing_document' | 'draft_invoice' | 'red_cashflow';
  severity: 'critical' | 'warning' | 'info';
  count: number;
  message: string;
  link?: string;
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: unknown;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
}
