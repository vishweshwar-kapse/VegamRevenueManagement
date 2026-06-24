import mongoose, { Document, Schema } from 'mongoose';

export type POStatus = 'open' | 'partial' | 'closed' | 'cancelled';
export type Currency = 'USD' | 'INR' | 'EUR' | 'GBP' | 'SGD' | 'AED';

export interface IPODocument {
  originalName: string;
  storedName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  uploadedBy: mongoose.Types.ObjectId;
  uploadedAt: Date;
  remarks?: string;
}

export interface IPOAmendment {
  amendmentNumber: number;
  previousValue: number;
  newValue: number;
  effectiveDate: Date;
  documentId?: string;
  remarks?: string;
  uploadedBy: mongoose.Types.ObjectId;
  uploadedAt: Date;
}

/**
 * How much of this PO's value is attributed to a specific SOW.
 * A PO can be split across multiple SOWs; the sum of allocation amounts
 * normally equals poValue (over-allocation is permitted with a warning).
 */
export interface IPOAllocation {
  sowId: mongoose.Types.ObjectId;
  amount: number;
}

export interface IPO extends Document {
  poNumber: string;             // Customer-issued PO number
  customerId: mongoose.Types.ObjectId;
  plantId?: mongoose.Types.ObjectId;    // Which plant issued this PO
  linkedSOWIds: mongoose.Types.ObjectId[];
  allocations: IPOAllocation[]; // Per-SOW attribution of the PO value
  poDate: Date;
  poValue: number;              // Original PO value (amount approved by customer)
  effectivePOValue: number;     // After amendments
  currency: Currency;
  invoicedValue: number;        // Total invoiced against this PO
  remainingValue: number;       // effectivePOValue - invoicedValue
  status: POStatus;
  ownerId: mongoose.Types.ObjectId;
  documents: IPODocument[];
  amendments: IPOAmendment[];
  milestones?: string;          // Description of billing milestones
  notes?: string;
  cancelledAt?: Date;
  cancelledBy?: mongoose.Types.ObjectId;
  cancellationRemarks?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PODocumentSchema = new Schema<IPODocument>(
  {
    originalName: { type: String, required: true },
    storedName: { type: String, required: true },
    filePath: { type: String, required: true },
    fileSize: { type: Number },
    mimeType: { type: String },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedAt: { type: Date, default: Date.now },
    remarks: { type: String },
  },
  { _id: true }
);

const POAllocationSchema = new Schema<IPOAllocation>(
  {
    sowId: { type: Schema.Types.ObjectId, ref: 'SOW', required: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const POAmendmentSchema = new Schema<IPOAmendment>(
  {
    amendmentNumber: { type: Number, required: true },
    previousValue: { type: Number, required: true },
    newValue: { type: Number, required: true },
    effectiveDate: { type: Date, required: true },
    documentId: { type: String },
    remarks: { type: String },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const POSchema = new Schema<IPO>(
  {
    poNumber: {
      type: String,
      required: [true, 'PO number is required'],
      trim: true,
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
    linkedSOWIds: [{ type: Schema.Types.ObjectId, ref: 'SOW' }],
    allocations: [POAllocationSchema],
    poDate: {
      type: Date,
      required: [true, 'PO date is required'],
    },
    poValue: {
      type: Number,
      required: [true, 'PO value is required'],
      min: 0,
    },
    effectivePOValue: {
      type: Number,
      min: 0,
    },
    currency: {
      type: String,
      enum: ['USD', 'INR', 'EUR', 'GBP', 'SGD', 'AED'],
      required: true,
    },
    invoicedValue: { type: Number, default: 0, min: 0 },
    remainingValue: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['open', 'partial', 'closed', 'cancelled'],
      default: 'open',
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    documents: [PODocumentSchema],
    amendments: [POAmendmentSchema],
    milestones: { type: String },
    notes: { type: String },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancellationRemarks: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Compute effective PO value and remaining value before save
POSchema.pre('save', function (next) {
  if (this.isNew || this.isModified('poValue') || this.isModified('amendments')) {
    if (!this.amendments || this.amendments.length === 0) {
      this.effectivePOValue = this.poValue;
    } else {
      // Use the latest amendment value
      const lastAmendment = this.amendments[this.amendments.length - 1];
      this.effectivePOValue = lastAmendment.newValue;
    }
  }
  this.remainingValue = this.effectivePOValue - this.invoicedValue;
  next();
});

POSchema.index({ customerId: 1, status: 1 });
POSchema.index({ customerId: 1, plantId: 1 });
POSchema.index({ poNumber: 1, customerId: 1 });

export default mongoose.model<IPO>('PO', POSchema);
