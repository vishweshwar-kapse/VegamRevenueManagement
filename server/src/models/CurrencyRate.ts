import mongoose, { Document, Schema } from 'mongoose';

// A single monthly row in the conversion grid. `rates` maps a currency code
// (column) to the conversion value the user entered for that month.
export interface IRateRow {
  month: number; // 1–12
  year: number;
  rates: Map<string, number>;
}

// The grid is a singleton — one document holds the whole editable matrix:
//   columns  → `currencies` (ordered list of currency codes)
//   rows     → `rows` (one per month, each with a rates map)
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
    year:  { type: Number, required: true },
    rates: { type: Map, of: Number, default: {} },
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
