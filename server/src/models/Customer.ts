import mongoose, { Document, Schema } from 'mongoose';

export type Currency = 'USD' | 'INR' | 'EUR' | 'GBP' | 'SGD' | 'AED';

export type SFSModule = 'goods_receipt' | 'staging' | 'manufacturing' | 'dispatch';

export const SFS_MODULE_LABELS: Record<SFSModule, string> = {
  goods_receipt: 'Goods Receipt',
  staging: 'Staging',
  manufacturing: 'Manufacturing',
  dispatch: 'Dispatch',
};

export const SFS_MODULES: SFSModule[] = ['goods_receipt', 'staging', 'manufacturing', 'dispatch'];

export interface IContactPerson {
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  isPrimary?: boolean;
}

export interface IContractVersion {
  version: number;
  originalName: string;
  storedName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  isLatest: boolean;
  uploadedBy: mongoose.Types.ObjectId;
  uploadedAt: Date;
  remarks?: string;
}

export interface IManHourRate {
  roleType: string;    // e.g. "Senior Engineer", "Project Manager"
  ratePerHour: number;
}

export interface IModuleCost {
  moduleName: SFSModule;
  licenseCost: number;
  notes?: string;
}

export interface ICostStructure {
  currency: Currency;
  manHourRates: IManHourRate[];
  sfsDeploymentCost?: number;         // Base full-platform deployment license cost
  sfsDeploymentNotes?: string;
  moduleCosts: IModuleCost[];         // Per-module license costs
  lastUpdatedBy?: mongoose.Types.ObjectId;
  lastUpdatedAt?: Date;
}

/**
 * Customer — Corporate Entity Level
 *
 * Represents the legal/corporate entity (e.g. "Tata Steel Ltd").
 * A customer can have multiple plants (sites) across the world.
 * Cost structure (man-hour rates, SFS licensing) is negotiated at the customer level.
 */
export interface ICustomer extends Document {
  code: string;
  name: string;
  displayName?: string;
  industry?: string;
  parentGroup?: string;
  website?: string;
  pan?: string;                           // Indian PAN (company level)
  defaultCurrency: Currency;
  defaultCreditPeriodDays: number;
  hqCountry?: string;
  hqCity?: string;
  corporateContacts: IContactPerson[];
  contractVersions: IContractVersion[];   // Master contract — versioned history
  costStructure?: ICostStructure;         // Negotiated rates and license costs
  notes?: string;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Sub-schemas ─────────────────────────────────────────────────────────────

const ContactPersonSchema = new Schema<IContactPerson>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String },
    designation: { type: String },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false }
);

const ContractVersionSchema = new Schema<IContractVersion>(
  {
    version: { type: Number, required: true },
    originalName: { type: String, required: true },
    storedName: { type: String, required: true },
    filePath: { type: String, required: true },
    fileSize: { type: Number },
    mimeType: { type: String },
    isLatest: { type: Boolean, default: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedAt: { type: Date, default: Date.now },
    remarks: { type: String },
  },
  { _id: true }
);

const ManHourRateSchema = new Schema<IManHourRate>(
  {
    roleType: { type: String, required: true, trim: true },
    ratePerHour: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const ModuleCostSchema = new Schema<IModuleCost>(
  {
    moduleName: {
      type: String,
      enum: ['goods_receipt', 'staging', 'manufacturing', 'dispatch'],
      required: true,
    },
    licenseCost: { type: Number, required: true, min: 0 },
    notes: { type: String },
  },
  { _id: false }
);

const CostStructureSchema = new Schema<ICostStructure>(
  {
    currency: {
      type: String,
      enum: ['USD', 'INR', 'EUR', 'GBP', 'SGD', 'AED'],
      required: true,
      default: 'USD',
    },
    manHourRates: [ManHourRateSchema],
    sfsDeploymentCost: { type: Number, min: 0 },
    sfsDeploymentNotes: { type: String },
    moduleCosts: [ModuleCostSchema],
    lastUpdatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    lastUpdatedAt: { type: Date },
  },
  { _id: false }
);

// ─── Main schema ─────────────────────────────────────────────────────────────

const CustomerSchema = new Schema<ICustomer>(
  {
    code: {
      type: String,
      required: [true, 'Customer code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    displayName: { type: String, trim: true },
    industry: { type: String },
    parentGroup: { type: String, trim: true },
    website: { type: String, trim: true },
    pan: { type: String, trim: true, uppercase: true },
    defaultCurrency: {
      type: String,
      enum: ['USD', 'INR', 'EUR', 'GBP', 'SGD', 'AED'],
      default: 'USD',
    },
    defaultCreditPeriodDays: {
      type: Number,
      default: 30,
      min: 0,
    },
    hqCountry: { type: String },
    hqCity: { type: String },
    corporateContacts: [ContactPersonSchema],
    contractVersions: [ContractVersionSchema],
    costStructure: { type: CostStructureSchema },
    notes: { type: String },
    isActive: { type: Boolean, default: true },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

CustomerSchema.index({ name: 'text', code: 'text', displayName: 'text' });
CustomerSchema.index({ industry: 1 });
CustomerSchema.index({ parentGroup: 1 });

export default mongoose.model<ICustomer>('Customer', CustomerSchema);
