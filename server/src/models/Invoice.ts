import mongoose, { Document, Schema } from 'mongoose';

export type InvoiceStatus = 'draft' | 'issued' | 'partial' | 'paid' | 'cancelled' | 'overdue';
export type Currency = 'USD' | 'INR' | 'EUR' | 'GBP' | 'SGD' | 'AED';

export interface IInvoiceRequest {
  requestedBy: mongoose.Types.ObjectId;
  requestedAt: Date;
  requestedAmount: number;
  description: string;
  remarks?: string;
}

export interface IInvoice extends Document {
  invoiceNumber: string;        // System-generated unique number
  customerId: mongoose.Types.ObjectId;
  poId: mongoose.Types.ObjectId;
  sowId?: mongoose.Types.ObjectId;
  invoiceDate: Date;
  payByDate: Date;
  invoiceValue: number;
  currency: Currency;
  status: InvoiceStatus;
  description: string;          // What is being billed
  milestoneDescription?: string;
  taxAmount?: number;
  taxDescription?: string;      // e.g. "NA", "GST 18%"
  totalAmount: number;          // invoiceValue + taxAmount

  // Request details (from AM/PM)
  request: IInvoiceRequest;

  // Finance operations
  issuedBy?: mongoose.Types.ObjectId;
  issuedAt?: Date;
  pdfPath?: string;             // Path to generated invoice PDF
  emailSentAt?: Date;
  emailRecipients?: string[];

  // Realization tracking (summary — details in Payment model)
  realizedAmount: number;
  outstandingAmount: number;

  // Overdue tracking
  overdueDays: number;

  // Cancellation
  cancelledBy?: mongoose.Types.ObjectId;
  cancelledAt?: Date;
  cancellationRemarks?: string;

  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceRequestSchema = new Schema<IInvoiceRequest>(
  {
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requestedAt: { type: Date, default: Date.now },
    requestedAmount: { type: Number, required: true, min: 0 },
    description: { type: String, required: true },
    remarks: { type: String },
  },
  { _id: false }
);

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: {
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
    poId: {
      type: Schema.Types.ObjectId,
      ref: 'PO',
      required: true,
    },
    sowId: {
      type: Schema.Types.ObjectId,
      ref: 'SOW',
    },
    invoiceDate: {
      type: Date,
      required: [true, 'Invoice date is required'],
    },
    payByDate: {
      type: Date,
      required: [true, 'Pay-by date is required'],
    },
    invoiceValue: {
      type: Number,
      required: [true, 'Invoice value is required'],
      min: 0,
    },
    currency: {
      type: String,
      enum: ['USD', 'INR', 'EUR', 'GBP', 'SGD', 'AED'],
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'issued', 'partial', 'paid', 'cancelled', 'overdue'],
      default: 'draft',
    },
    description: {
      type: String,
      required: [true, 'Invoice description is required'],
    },
    milestoneDescription: { type: String },
    taxAmount: { type: Number, default: 0, min: 0 },
    taxDescription: { type: String, default: 'NA' },
    totalAmount: { type: Number, min: 0 },

    request: { type: InvoiceRequestSchema, required: true },

    issuedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    issuedAt: { type: Date },
    pdfPath: { type: String },
    emailSentAt: { type: Date },
    emailRecipients: [{ type: String }],

    realizedAmount: { type: Number, default: 0, min: 0 },
    outstandingAmount: { type: Number, default: 0 },

    overdueDays: { type: Number, default: 0 },

    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: { type: Date },
    cancellationRemarks: { type: String },

    notes: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Compute totalAmount and outstandingAmount before save
InvoiceSchema.pre('save', function (next) {
  this.totalAmount = this.invoiceValue + (this.taxAmount || 0);
  this.outstandingAmount = this.totalAmount - this.realizedAmount;

  // Update overdue days for issued invoices
  if (this.status === 'issued' || this.status === 'partial') {
    const today = new Date();
    if (today > this.payByDate) {
      const diffTime = today.getTime() - this.payByDate.getTime();
      this.overdueDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (this.status === 'issued' && this.overdueDays > 0) {
        this.status = 'overdue';
      }
    } else {
      this.overdueDays = 0;
    }
  }

  next();
});

InvoiceSchema.index({ customerId: 1, status: 1 });
InvoiceSchema.index({ poId: 1 });
InvoiceSchema.index({ invoiceDate: -1 });
InvoiceSchema.index({ payByDate: 1 });
InvoiceSchema.index({ status: 1, payByDate: 1 }); // for overdue queries

export default mongoose.model<IInvoice>('Invoice', InvoiceSchema);
