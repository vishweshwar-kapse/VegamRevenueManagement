import mongoose, { Document, Schema } from 'mongoose';

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

export interface IReferenceDocument {
  originalName: string;
  storedName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  version: number;
  isLatest: boolean;
  uploadedBy: mongoose.Types.ObjectId;
  uploadedAt: Date;
  remarks?: string;
}

/**
 * Commercial Reference Repository
 *
 * Customer-level commercial knowledge repository.
 * MSAs, NDAs, pricing sheets, rate cards, legal addendums, etc.
 * Does NOT drive transactional workflows — purely reference.
 */
export interface ICommercialReference extends Document {
  customerId: mongoose.Types.ObjectId;
  documentType: ReferenceDocType;
  title: string;
  description?: string;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  currentVersion: number;
  status: ReferenceStatus;
  documents: IReferenceDocument[];
  tags?: string[];
  notes?: string;
  uploadedBy: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReferenceDocumentSchema = new Schema<IReferenceDocument>(
  {
    originalName: { type: String, required: true },
    storedName: { type: String, required: true },
    filePath: { type: String, required: true },
    fileSize: { type: Number },
    mimeType: { type: String },
    version: { type: Number, required: true, default: 1 },
    isLatest: { type: Boolean, default: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedAt: { type: Date, default: Date.now },
    remarks: { type: String },
  },
  { _id: true }
);

const CommercialReferenceSchema = new Schema<ICommercialReference>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    documentType: {
      type: String,
      enum: ['msa', 'global_agreement', 'nda', 'pricing_sheet', 'rate_card', 'commercial_annexure', 'governance_document', 'legal_addendum', 'other'],
      required: [true, 'Document type is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    description: { type: String },
    effectiveFrom: { type: Date },
    effectiveTo: { type: Date },
    currentVersion: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ['active', 'archived', 'expired'],
      default: 'active',
    },
    documents: [ReferenceDocumentSchema],
    tags: [{ type: String }],
    notes: { type: String },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CommercialReferenceSchema.index({ customerId: 1, documentType: 1 });
CommercialReferenceSchema.index({ status: 1 });

export default mongoose.model<ICommercialReference>('CommercialReference', CommercialReferenceSchema);
