import mongoose, { Document, Schema } from 'mongoose';

export type Currency = 'USD' | 'INR' | 'EUR' | 'GBP' | 'SGD' | 'AED';

/**
 * Payment / Cash Realization
 *
 * One invoice can have multiple realization entries (partial payments).
 * Each Payment document represents a single bank receipt event.
 *
 * Key distinction from Invoice:
 *   Invoice = Revenue Recognition (invoice date)
 *   Payment = Actual Cash Realization (bank receipt date)
 */
export interface IPayment extends Document {
  invoiceId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;

  realizationDate: Date;          // Actual date money arrived in bank
  realizedAmount: number;         // Amount actually received
  currency: Currency;             // Settlement currency

  // FX tracking
  invoiceCurrency: Currency;
  invoiceAmount: number;          // The invoice portion this payment covers
  fxDifference: number;           // realizedAmount (in invoice currency equiv) - invoiceAmount
  fxRate?: number;                // Exchange rate used if currencies differ

  paymentReference?: string;      // Bank reference / TT number
  remarks?: string;
  recordedBy: mongoose.Types.ObjectId;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    realizationDate: {
      type: Date,
      required: [true, 'Realization date is required'],
    },
    realizedAmount: {
      type: Number,
      required: [true, 'Realized amount is required'],
      min: 0,
    },
    currency: {
      type: String,
      enum: ['USD', 'INR', 'EUR', 'GBP', 'SGD', 'AED'],
      required: true,
    },
    invoiceCurrency: {
      type: String,
      enum: ['USD', 'INR', 'EUR', 'GBP', 'SGD', 'AED'],
      required: true,
    },
    invoiceAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    fxDifference: {
      type: Number,
      default: 0,
    },
    fxRate: { type: Number },
    paymentReference: { type: String },
    remarks: { type: String },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

PaymentSchema.index({ invoiceId: 1 });
PaymentSchema.index({ customerId: 1 });
PaymentSchema.index({ realizationDate: -1 });

export default mongoose.model<IPayment>('Payment', PaymentSchema);
