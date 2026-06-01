import mongoose, { Document, Schema } from 'mongoose';
import { IContactPerson, Currency } from './Customer';

/**
 * Timezones we support — covers all regions where Vegam operates.
 * Using IANA tz database names (used by Intl.DateTimeFormat, moment-timezone, etc.)
 */
export type SupportedTimezone =
  | 'Asia/Kolkata'          // IST  +05:30
  | 'Asia/Dubai'            // GST  +04:00
  | 'Asia/Singapore'        // SGT  +08:00
  | 'Asia/Tokyo'            // JST  +09:00
  | 'Asia/Shanghai'         // CST  +08:00
  | 'Asia/Seoul'            // KST  +09:00
  | 'Asia/Bangkok'          // ICT  +07:00
  | 'Asia/Kuala_Lumpur'     // MYT  +08:00
  | 'Asia/Jakarta'          // WIB  +07:00
  | 'Europe/London'         // GMT/BST
  | 'Europe/Paris'          // CET  +01:00
  | 'Europe/Berlin'         // CET  +01:00
  | 'Europe/Amsterdam'      // CET  +01:00
  | 'America/New_York'      // EST  -05:00
  | 'America/Chicago'       // CST  -06:00
  | 'America/Los_Angeles'   // PST  -08:00
  | 'America/Toronto'       // EST  -05:00
  | 'Australia/Sydney'      // AEDT +11:00
  | 'Australia/Melbourne'   // AEDT +11:00
  | 'Pacific/Auckland'      // NZST +12:00
  | 'UTC';                  // UTC  +00:00

const SUPPORTED_TIMEZONES: SupportedTimezone[] = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Shanghai',
  'Asia/Seoul', 'Asia/Bangkok', 'Asia/Kuala_Lumpur', 'Asia/Jakarta',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Toronto',
  'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland', 'UTC',
];

/**
 * Customer Plant — Site / Location Level
 *
 * A plant is one physical or administrative site belonging to a Customer.
 * Examples: "Tata Steel — Jamshedpur Plant", "Tata Steel — Netherlands Plant".
 *
 * Each plant has its own:
 *   - Location (country, city, timezone)
 *   - Billing address and tax registrations (GSTIN, VAT)
 *   - Default currency (overrides customer-level default if set)
 *   - Credit period (overrides customer-level default if set)
 *   - Local contacts (plant manager, finance contact, etc.)
 *
 * SOWs, POs, and Invoices reference plantId to track which plant the work is for.
 */
export interface ICustomerPlant extends Document {
  plantCode: string;                    // Unique globally, e.g. TATA001-IN-JSR
  plantName: string;                    // e.g. "Jamshedpur Plant"
  customerId: mongoose.Types.ObjectId;  // Parent customer
  isDefault: boolean;                   // true = primary plant (used when no plant specified)

  // Location
  country: string;
  city?: string;
  state?: string;
  region?: string;                      // e.g. "APAC", "EMEA", "Americas"
  timezone: SupportedTimezone;

  // Billing & Address
  billingAddress?: string;
  shippingAddress?: string;

  // Tax registrations
  gstin?: string;                       // Indian GST number
  vatNumber?: string;                   // EU/UK VAT number
  taxId?: string;                       // Generic tax ID for other countries

  // Commercial settings (null = inherit from customer)
  currency?: Currency;                  // overrides customer.defaultCurrency
  creditPeriodDays?: number;            // overrides customer.defaultCreditPeriodDays

  // Plant-level contacts
  contacts: IContactPerson[];

  notes?: string;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ContactPersonSchema = new Schema<IContactPerson>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String },
    designation: { type: String },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false }
);

const CustomerPlantSchema = new Schema<ICustomerPlant>(
  {
    plantCode: {
      type: String,
      required: [true, 'Plant code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    plantName: {
      type: String,
      required: [true, 'Plant name is required'],
      trim: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer is required'],
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
    },
    city: { type: String },
    state: { type: String },
    region: {
      type: String,
      enum: ['APAC', 'EMEA', 'Americas', 'India', 'Other'],
    },
    timezone: {
      type: String,
      enum: SUPPORTED_TIMEZONES,
      required: [true, 'Timezone is required'],
      default: 'UTC',
    },
    billingAddress: { type: String },
    shippingAddress: { type: String },
    gstin: { type: String, trim: true, uppercase: true },
    vatNumber: { type: String, trim: true },
    taxId: { type: String, trim: true },
    currency: {
      type: String,
      enum: ['USD', 'INR', 'EUR', 'GBP', 'SGD', 'AED'],
    },
    creditPeriodDays: {
      type: Number,
      min: 0,
    },
    contacts: [ContactPersonSchema],
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

// Only one default plant per customer
CustomerPlantSchema.index({ customerId: 1, isDefault: 1 });
CustomerPlantSchema.index({ customerId: 1, isActive: 1 });
CustomerPlantSchema.index({ country: 1 });
CustomerPlantSchema.index({ region: 1 });
CustomerPlantSchema.index({ plantName: 'text', plantCode: 'text' });

export default mongoose.model<ICustomerPlant>('CustomerPlant', CustomerPlantSchema);
