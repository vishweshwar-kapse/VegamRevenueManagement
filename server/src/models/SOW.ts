import mongoose, { Document, Schema } from 'mongoose';

export type SOWStatus =
  | 'draft'
  | 'submitted'
  | 'linked'
  | 'partially_accepted'  // some PO value signed, but less than the SOW total
  | 'accepted'            // PO value signed covers the full SOW total
  | 'closed'
  | 'archived';

export interface ISOWDocument {
  originalName: string;
  storedName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  version: number;
  isActive: boolean;
  uploadedBy: mongoose.Types.ObjectId;
  uploadedAt: Date;
  remarks?: string;
}

export interface ISOWVersion {
  versionNumber: number;
  description?: string;
  documentId?: string;    // Reference to document in documents array
  effectiveDate?: Date;
  uploadedBy: mongoose.Types.ObjectId;
  uploadedAt: Date;
  remarks?: string;
}

export interface ISOWMilestone {
  description: string;
  amount: number;
  deliveryDate: Date;
}

export interface ISOW extends Document {
  sowId: string;           // Human-readable ID e.g. SOW-2025-001
  entityId?: mongoose.Types.ObjectId;  // Selling entity
  customerId: mongoose.Types.ObjectId;
  plantId?: mongoose.Types.ObjectId;    // Which plant this SOW is for
  forecastId?: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  scope?: string;
  deliverables?: string;
  startDate?: Date;
  endDate?: Date;
  totalValue?: number;
  signedValue: number;     // Sum of PO allocations to this SOW (PO-confirmed amount)
  currency?: string;
  milestones: ISOWMilestone[];
  currentVersion: number;
  status: SOWStatus;
  ownerId: mongoose.Types.ObjectId;
  documents: ISOWDocument[];
  versions: ISOWVersion[];
  linkedPOIds: mongoose.Types.ObjectId[];
  notes?: string;
  submittedAt?: Date;
  closedAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SOWMilestoneSchema = new Schema<ISOWMilestone>(
  {
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    deliveryDate: { type: Date, required: true },
  },
  { _id: true }
);

const SOWDocumentSchema = new Schema<ISOWDocument>(
  {
    originalName: { type: String, required: true },
    storedName: { type: String, required: true },
    filePath: { type: String, required: true },
    fileSize: { type: Number },
    mimeType: { type: String },
    version: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedAt: { type: Date, default: Date.now },
    remarks: { type: String },
  },
  { _id: true }
);

const SOWVersionSchema = new Schema<ISOWVersion>(
  {
    versionNumber: { type: Number, required: true },
    description: { type: String },
    documentId: { type: String },
    effectiveDate: { type: Date },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedAt: { type: Date, default: Date.now },
    remarks: { type: String },
  },
  { _id: false }
);

const SOWSchema = new Schema<ISOW>(
  {
    sowId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      ref: 'Entity',
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    plantId: {
      type: Schema.Types.ObjectId,
      ref: 'CustomerPlant',
    },
    forecastId: {
      type: Schema.Types.ObjectId,
      ref: 'Forecast',
    },
    title: {
      type: String,
      required: [true, 'SOW title is required'],
      trim: true,
    },
    description: { type: String },
    scope: { type: String },
    deliverables: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    totalValue: { type: Number, min: 0 },
    signedValue: { type: Number, default: 0, min: 0 },
    currency: {
      type: String,
      enum: ['USD', 'INR', 'EUR', 'GBP', 'SGD', 'AED'],
    },
    currentVersion: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'linked', 'partially_accepted', 'accepted', 'closed', 'archived'],
      default: 'draft',
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    milestones: [SOWMilestoneSchema],
    documents: [SOWDocumentSchema],
    versions: [SOWVersionSchema],
    linkedPOIds: [{ type: Schema.Types.ObjectId, ref: 'PO' }],
    notes: { type: String },
    submittedAt: { type: Date },
    closedAt: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

SOWSchema.index({ customerId: 1, status: 1 });
SOWSchema.index({ customerId: 1, plantId: 1 });
SOWSchema.index({ ownerId: 1 });
SOWSchema.index({ sowId: 1 });

export default mongoose.model<ISOW>('SOW', SOWSchema);
