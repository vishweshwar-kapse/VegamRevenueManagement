import mongoose, { Document, Schema } from 'mongoose';

export type ExpenseCategory =
  | 'payroll'
  | 'infrastructure'
  | 'travel'
  | 'vendor_payments'
  | 'investments'
  | 'miscellaneous'
  | 'other';

export interface IExpenseLineItem {
  category: ExpenseCategory;
  description?: string;
  amount: number;
}

/**
 * Expense / Operational Cost Tracking
 *
 * Finance enters monthly expenses for cashflow planning.
 * Can be granular (by category) or consolidated.
 * Feeds into the Cashflow & Runway module.
 */
export interface IExpense extends Document {
  month: number;              // 1-12
  year: number;               // e.g. 2025
  monthYear: string;          // Computed: "Jan-25" for display
  currency: string;
  lineItems: IExpenseLineItem[];
  totalAmount: number;        // Sum of all line items
  isBudgeted: boolean;        // true = budget estimate, false = actual
  notes?: string;
  recordedBy: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseLineItemSchema = new Schema<IExpenseLineItem>(
  {
    category: {
      type: String,
      enum: ['payroll', 'infrastructure', 'travel', 'vendor_payments', 'investments', 'miscellaneous', 'other'],
      required: true,
    },
    description: { type: String },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const ExpenseSchema = new Schema<IExpense>(
  {
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
    },
    monthYear: { type: String },
    currency: {
      type: String,
      enum: ['USD', 'INR', 'EUR', 'GBP', 'SGD', 'AED'],
      default: 'USD',
    },
    lineItems: [ExpenseLineItemSchema],
    totalAmount: { type: Number, default: 0, min: 0 },
    isBudgeted: { type: Boolean, default: false },
    notes: { type: String },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Compute totalAmount and monthYear before save
ExpenseSchema.pre('save', function (next) {
  this.totalAmount = this.lineItems.reduce((sum, item) => sum + item.amount, 0);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const yearShort = String(this.year).slice(-2);
  this.monthYear = `${monthNames[this.month - 1]}-${yearShort}`;
  next();
});

// Unique per month/year (one record per month)
ExpenseSchema.index({ month: 1, year: 1 }, { unique: true });

export default mongoose.model<IExpense>('Expense', ExpenseSchema);
