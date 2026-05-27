import mongoose, { Document, Schema } from 'mongoose';

export type SOWStatus = 'draft' | 'submitted' | 'linked' | 'closed' | 'archived';

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

export interface ISOW extends Document {
  sowId: string;           // Human-readable ID e.g. SOW-CUST001-2025-001
  customerId: mongoose.Types.ObjectId;
  forecastId?: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  scope?: string;
  deliverables?: string;
  startDate?: Date;
  endDate?: Date;
  totalValue?: number;
  currency?: string;
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
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
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
    currency: {
      type: String,
      enum: ['USD', 'INR', 'EUR', 'GBP', 'SGD', 'AED'],
    },
    currentVersion: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'linked', 'closed', 'archived'],
      default: 'draft',
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
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
SOWSchema.index({ ownerId: 1 });
SOWSchema.index({ sowId: 1 });

export default mongoose.model<ISOW>('SOW', SOWSchema);
