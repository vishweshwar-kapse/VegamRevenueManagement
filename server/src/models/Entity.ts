import mongoose, { Document, Schema } from 'mongoose';

export interface IEntity extends Document {
  entityCode: string;         // Short unique identifier e.g. "VEGAM-IN"
  name: string;               // Trading / brand name
  legalName?: string;         // Full registered legal name
  address?: string;           // Full postal address
  country?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  gstin?: string;
  pan?: string;
  vatNumber?: string;
  taxId?: string;
  defaultCurrency: string;
  email?: string;
  phone?: string;
  website?: string;
  isDefault: boolean;         // One entity can be pre-selected on new forecasts
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const EntitySchema = new Schema<IEntity>(
  {
    entityCode: {
      type: String,
      required: [true, 'Entity code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Entity name is required'],
      trim: true,
    },
    legalName:       { type: String, trim: true },
    address:         { type: String },
    country:         { type: String },
    city:            { type: String },
    state:           { type: String },
    pinCode:         { type: String, trim: true },
    gstin:           { type: String, uppercase: true, trim: true },
    pan:             { type: String, uppercase: true, trim: true },
    vatNumber:       { type: String, trim: true },
    taxId:           { type: String, trim: true },
    defaultCurrency: {
      type: String,
      enum: ['USD', 'INR', 'EUR', 'GBP', 'SGD', 'AED'],
      default: 'INR',
    },
    email:    { type: String, trim: true, lowercase: true },
    phone:    { type: String, trim: true },
    website:  { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
    isActive:  { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

EntitySchema.index({ name: 1 });
EntitySchema.index({ isDefault: 1 });

export default mongoose.model<IEntity>('Entity', EntitySchema);
