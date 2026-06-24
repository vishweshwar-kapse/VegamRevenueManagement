// ─── Shared Types ────────────────────────────────────────────────────────────

export type Currency = 'USD' | 'INR' | 'EUR' | 'GBP' | 'SGD' | 'AED';

export type UserRole =
  | 'finance_admin'
  | 'management'
  | 'account_manager'
  | 'project_manager'
  | 'am_pm'
  | 'read_only_pm';

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  finance_admin: 'Finance Admin',
  management: 'Management',
  account_manager: 'Account Manager',
  project_manager: 'Project Manager',
  am_pm: 'AM / PM (Legacy)',
  read_only_pm: 'Read-Only PM',
};

export const FORECAST_ROLES: UserRole[] = ['finance_admin', 'account_manager', 'project_manager', 'am_pm'];

export type SFSModule = 'goods_receipt' | 'staging' | 'manufacturing' | 'dispatch';

export const SFS_MODULE_LABELS: Record<SFSModule, string> = {
  goods_receipt: 'Goods Receipt',
  staging: 'Staging',
  manufacturing: 'Manufacturing',
  dispatch: 'Dispatch',
};

export const SFS_MODULES: SFSModule[] = ['goods_receipt', 'staging', 'manufacturing', 'dispatch'];

export interface User {
  _id: string;
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  assignedSites: string[] | CustomerPlant[];
  assignedCustomers: string[] | Customer[];
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

// ─── Business Entity (seller) ─────────────────────────────────────────────────

export interface Entity {
  _id: string;
  entityCode: string;
  name: string;
  legalName?: string;
  address?: string;
  country?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  gstin?: string;
  pan?: string;
  vatNumber?: string;
  taxId?: string;
  defaultCurrency: Currency;
  email?: string;
  phone?: string;
  website?: string;
  isDefault: boolean;
  isActive: boolean;
  createdBy?: string | User;
  createdAt: string;
  updatedAt: string;
}

// ─── Customer ─────────────────────────────────────────────────────────────────

export interface ContactPerson {
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  isPrimary?: boolean;
}

export interface ContractVersion {
  _id: string;
  version: number;
  originalName: string;
  storedName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  isLatest: boolean;
  uploadedBy: string | User;
  uploadedAt: string;
  remarks?: string;
}

export interface ManHourRate {
  roleType: string;
  ratePerHour: number;
}

export interface ModuleCost {
  moduleName: SFSModule;
  licenseCost: number;
  notes?: string;
}

export interface CostStructure {
  currency: Currency;
  manHourRates: ManHourRate[];
  sfsDeploymentCost?: number;
  sfsDeploymentNotes?: string;
  moduleCosts: ModuleCost[];
  lastUpdatedBy?: string | User;
  lastUpdatedAt?: string;
}

export interface Customer {
  _id: string;
  code: string;
  name: string;
  displayName?: string;
  industry?: string;
  parentGroup?: string;
  website?: string;
  pan?: string;
  defaultCurrency: Currency;
  defaultCreditPeriodDays: number;
  hqCountry?: string;
  hqCity?: string;
  corporateContacts: ContactPerson[];
  contractVersions: ContractVersion[];
  costStructure?: CostStructure;
  notes?: string;
  isActive: boolean;
  createdBy?: string | User;
  createdAt: string;
  updatedAt: string;
}

// ─── Customer Plant ───────────────────────────────────────────────────────────

export interface CustomerPlant {
  _id: string;
  plantCode: string;
  plantName: string;
  customerId: string | Customer;
  isDefault: boolean;
  country: string;
  city?: string;
  state?: string;
  region?: 'APAC' | 'EMEA' | 'Americas' | 'India' | 'Other';
  timezone: string;
  billingAddress?: string;
  shippingAddress?: string;
  gstin?: string;
  vatNumber?: string;
  taxId?: string;
  currency?: Currency;
  creditPeriodDays?: number;
  contacts: ContactPerson[];
  notes?: string;
  isActive: boolean;
  createdBy?: string | User;
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
  entityId?: string | Entity;
  customerId: string | Customer;
  plantId: string | CustomerPlant;
  description: string;
  fy: string;
  totalValue: number;
  projection?: number;
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

export interface ForecastSummary {
  fy: string;
  currency: Currency;
  totalForecastValue: number;
  signedValue: number;
  projectedValue: number;
  conversionRate: number;
  forecastCount: number;
  quarterly: { q1: number; q2: number; q3: number; q4: number };
  activeSites: number;
  activeCustomers: number;
}

export interface DashboardSummary {
  fy: string;
  currency: Currency;
  forecast: ForecastSummary;
  revenueInvoiced: number;
  revenueRealized: number;
  outstandingReceivables: number;
  overdueReceivables: number;
  openSOWs: number;
  openPOs: number;
  alerts: ActionAlert[];
}

// ─── SOW ──────────────────────────────────────────────────────────────────────

export type SOWStatus =
  | 'draft'
  | 'submitted'
  | 'linked'
  | 'partially_accepted'
  | 'accepted'
  | 'closed'
  | 'archived';

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

export interface SOWMilestone {
  _id?: string;
  description: string;
  amount: number;
  deliveryDate: string; // ISO date string
}

export interface SOW {
  _id: string;
  sowId: string;
  entityId?: string | Entity;
  customerId: string | Customer;
  plantId?: string | CustomerPlant;
  forecastId?: string | Forecast;
  title: string;
  description?: string;
  scope?: string;
  startDate?: string;
  endDate?: string;
  totalValue?: number;
  signedValue: number;        // PO-confirmed amount (sum of PO allocations)
  currency?: Currency;
  milestones: SOWMilestone[];
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

export interface POAllocation {
  sowId: string | SOW;
  amount: number;
}

export interface PODocument {
  _id: string;
  originalName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  uploadedBy: string | User;
  uploadedAt: string;
  remarks?: string;
}

export interface PO {
  _id: string;
  poNumber: string;
  customerId: string | Customer;
  plantId?: string | CustomerPlant;
  linkedSOWIds: Array<string | SOW>;
  allocations: POAllocation[];
  poDate: string;
  poValue: number;
  effectivePOValue: number;
  currency: Currency;
  invoicedValue: number;
  remainingValue: number;
  status: POStatus;
  ownerId: string | User;
  documents: PODocument[];
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
  plantId?: string | CustomerPlant;
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
    greenTill?: string;
    redFrom?: string;
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
