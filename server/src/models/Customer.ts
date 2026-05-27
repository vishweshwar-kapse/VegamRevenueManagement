import mongoose, { Document, Schema } from 'mongoose';

export interface IContactPerson {
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  isPrimary?: boolean;
}

export interface ICustomer extends Document {
  code: string;               // Short unique code e.g. CUST001
  name: string;
  displayName?: string;
  industry?: string;
  country?: string;
  defaultCurrency: 'USD' | 'INR' | 'EUR' | 'GBP' | 'SGD' | 'AED';
  creditPeriodDays: number;   // Default payment terms in days
  billingAddress?: string;
  contacts: IContactPerson[];
  gstin?: string;             // Indian GST number if applicable
  notes?: string;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ContactPersonSchema = new Schema<IContactPerson>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    designation: { type: String },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false }
);

const CustomerSchema = new Schema<ICustomer>(
  {
    code: {
      type: String,
      required: true,
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
    country: { type: String },
    defaultCurrency: {
      type: String,
      enum: ['USD', 'INR', 'EUR', 'GBP', 'SGD', 'AED'],
      default: 'USD',
    },
    creditPeriodDays: {
      type: Number,
      default: 30,
      min: 0,
    },
    billingAddress: { type: String },
    contacts: [ContactPersonSchema],
    gstin: { type: String },
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

CustomerSchema.index({ name: 'text', code: 'text' });

export default mongoose.model<ICustomer>('Customer', CustomerSchema);
