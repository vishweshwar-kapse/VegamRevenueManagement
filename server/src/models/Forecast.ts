import mongoose, { Document, Schema } from 'mongoose';

export type ForecastStatus = 'projected' | 'signed' | 'closed';
export type Currency = 'USD' | 'INR' | 'EUR' | 'GBP' | 'SGD' | 'AED';

export interface IQuarterDistribution {
  q1: number;
  q2: number;
  q3: number;
  q4: number;
}

export interface IForecastDistribution {
  fy: string;            // e.g. "FY24-25"
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  total: number;
}

export interface IForecastHistory {
  action: string;
  changedBy: mongoose.Types.ObjectId;
  changedAt: Date;
  previousValue?: number;
  newValue?: number;
  remarks?: string;
}

export interface IForecast extends Document {
  forecastId: string;           // Human-readable ID e.g. FCST-2025-001
  entityId?: mongoose.Types.ObjectId; // Selling entity (our company entity)
  customerId: mongoose.Types.ObjectId;
  plantId: mongoose.Types.ObjectId;  // Site / plant this forecast is for
  description: string;
  fy: string;                   // Primary FY e.g. "FY25-26"
  totalValue: number;
  currency: Currency;
  status: ForecastStatus;
  ownerId: mongoose.Types.ObjectId;
  distributions: IForecastDistribution[];
  projection?: number;          // User-entered top-level projection value
  signedValue: number;          // Portion commercially confirmed
  projectedValue: number;       // Remaining unconfirmed
  linkedSOWIds: mongoose.Types.ObjectId[];
  linkedPOIds: mongoose.Types.ObjectId[];
  notes?: string;
  history: IForecastHistory[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ForecastDistributionSchema = new Schema<IForecastDistribution>(
  {
    fy: { type: String, required: true },
    q1: { type: Number, default: 0, min: 0 },
    q2: { type: Number, default: 0, min: 0 },
    q3: { type: Number, default: 0, min: 0 },
    q4: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const ForecastHistorySchema = new Schema<IForecastHistory>(
  {
    action: { type: String, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now },
    previousValue: { type: Number },
    newValue: { type: Number },
    remarks: { type: String },
  },
  { _id: false }
);

const ForecastSchema = new Schema<IForecast>(
  {
    forecastId: {
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
      required: true,
    },
    description: {
      type: String,
      required: [true, 'Forecast description is required'],
    },
    fy: {
      type: String,
      required: [true, 'Financial year is required'],
    },
    totalValue: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      enum: ['USD', 'INR', 'EUR', 'GBP', 'SGD', 'AED'],
      required: true,
    },
    status: {
      type: String,
      enum: ['projected', 'signed', 'closed'],
      default: 'projected',
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    distributions: [ForecastDistributionSchema],
    projection: { type: Number, min: 0 },
    signedValue: { type: Number, default: 0, min: 0 },
    projectedValue: { type: Number, default: 0, min: 0 },
    linkedSOWIds: [{ type: Schema.Types.ObjectId, ref: 'SOW' }],
    linkedPOIds: [{ type: Schema.Types.ObjectId, ref: 'PO' }],
    notes: { type: String },
    history: [ForecastHistorySchema],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ForecastSchema.index({ customerId: 1, fy: 1 });
ForecastSchema.index({ plantId: 1, fy: 1 });
ForecastSchema.index({ status: 1 });
ForecastSchema.index({ ownerId: 1 });

export default mongoose.model<IForecast>('Forecast', ForecastSchema);
