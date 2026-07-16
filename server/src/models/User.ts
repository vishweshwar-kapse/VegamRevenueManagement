import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole =
  | 'finance_admin'
  | 'management'
  | 'account_manager'
  | 'project_manager'
  | 'am_pm'           // legacy alias — treated same as account_manager
  | 'read_only_pm';

export const FORECAST_ROLES: UserRole[] = ['finance_admin', 'account_manager', 'project_manager', 'am_pm'];

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;   // force a password change on next login
  avatarUrl?: string;            // profile picture, served from /uploads/avatars
  // Email-change verification (OTP sent to the new address)
  pendingEmail?: string;
  emailOtpHash?: string;
  emailOtpExpires?: Date;
  emailOtpAttempts?: number;
  // Forgot-password reset (OTP sent to the account's own email)
  resetOtpHash?: string;
  resetOtpExpires?: Date;
  resetOtpAttempts?: number;
  assignedSites: mongoose.Types.ObjectId[];
  assignedCustomers: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: ['finance_admin', 'management', 'account_manager', 'project_manager', 'am_pm', 'read_only_pm'],
      required: [true, 'Role is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // New accounts (admin-created or seeded) must set their own password on
    // first login. Existing users predating this field read as false.
    mustChangePassword: {
      type: Boolean,
      default: true,
    },
    avatarUrl: { type: String },
    // Email-change OTP state. select:false so these never leak via /auth/me
    // or any populated user response.
    pendingEmail: { type: String, lowercase: true, trim: true, select: false },
    emailOtpHash: { type: String, select: false },
    emailOtpExpires: { type: Date, select: false },
    emailOtpAttempts: { type: Number, default: 0, select: false },
    resetOtpHash: { type: String, select: false },
    resetOtpExpires: { type: Date, select: false },
    resetOtpAttempts: { type: Number, default: 0, select: false },
    assignedSites: [{ type: Schema.Types.ObjectId, ref: 'CustomerPlant' }],
    assignedCustomers: [{ type: Schema.Types.ObjectId, ref: 'Customer' }],
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model<IUser>('User', UserSchema);
