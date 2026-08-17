import mongoose, { Document, Schema } from 'mongoose';

export interface IRateEntry {
  [toCurrency: string]: number;
}

// A single monthly row in the conversion grid. `rates` maps a from-currency
// to a map of to-currency conversion values entered for that month.
export interface IRateRow {
  month: number; // 1–12
  year: number;
  rates: Record<string, IRateEntry>;
}

// The grid is a singleton — one document holds the whole editable matrix:
//   columns  → `currencies` (ordered list of currency codes)
//   rows     → `rows` (one per month, each with a from/to rates map)
export interface ICurrencyRateGrid extends Document {
  currencies: string[];
  rows: IRateRow[];
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RateRowSchema = new Schema<IRateRow>(
  {
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    rates: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const CurrencyRateGridSchema = new Schema<ICurrencyRateGrid>(
  {
    currencies: {
      type: [String],
      default: ['INR', 'USD', 'EUR'],
    },
    rows: {
      type: [RateRowSchema],
      default: [],
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model<ICurrencyRateGrid>('CurrencyRateGrid', CurrencyRateGridSchema);
