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
