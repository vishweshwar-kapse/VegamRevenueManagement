import mongoose, { Document, Schema } from 'mongoose';

export type BatchStatus = 'pending' | 'validating' | 'validated' | 'importing' | 'completed' | 'partial' | 'failed';

export interface IBatchRowError {
  rowNumber: number;
  entityType: string;
  identifier?: string;
  errorMessage: string;
}

export interface IBatchSummary {
  totalRows: number;
  successRows: number;
  failedRows: number;
  skippedRows: number;
  // Breakdown by entity
  sowsImported: number;
  posImported: number;
  invoicesImported: number;
  paymentsImported: number;
}

/**
 * Bulk Upload Batch
 *
 * Tracks each historical data import batch.
 * Supports partial success, reprocessing, and audit trail.
 */
export interface IBulkUploadBatch extends Document {
  batchId: string;              // Human-readable e.g. BATCH-2025-001
  uploadedBy: mongoose.Types.ObjectId;
  uploadedAt: Date;
  originalFilename: string;
  storedFilename: string;
  filePath: string;
  status: BatchStatus;
  summary: IBatchSummary;
  importErrors: IBatchRowError[];       // Renamed from 'errors' to avoid conflict with Mongoose Document
  validationErrors: IBatchRowError[];
  importStartedAt?: Date;
  importCompletedAt?: Date;
  remarks?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BatchRowErrorSchema = new Schema<IBatchRowError>(
  {
    rowNumber: { type: Number, required: true },
    entityType: { type: String, required: true },
    identifier: { type: String },
    errorMessage: { type: String, required: true },
  },
  { _id: false }
);

const BatchSummarySchema = new Schema<IBatchSummary>(
  {
    totalRows: { type: Number, default: 0 },
    successRows: { type: Number, default: 0 },
    failedRows: { type: Number, default: 0 },
    skippedRows: { type: Number, default: 0 },
    sowsImported: { type: Number, default: 0 },
    posImported: { type: Number, default: 0 },
    invoicesImported: { type: Number, default: 0 },
    paymentsImported: { type: Number, default: 0 },
  },
  { _id: false }
);

const BulkUploadBatchSchema = new Schema<IBulkUploadBatch>(
  {
    batchId: {
      type: String,
      required: true,
      unique: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    uploadedAt: { type: Date, default: Date.now },
    originalFilename: { type: String, required: true },
    storedFilename: { type: String, required: true },
    filePath: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'validating', 'validated', 'importing', 'completed', 'partial', 'failed'],
      default: 'pending',
    },
    summary: { type: BatchSummarySchema, default: () => ({}) },
    importErrors: [BatchRowErrorSchema],
    validationErrors: [BatchRowErrorSchema],
    importStartedAt: { type: Date },
    importCompletedAt: { type: Date },
    remarks: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

BulkUploadBatchSchema.index({ uploadedBy: 1 });
BulkUploadBatchSchema.index({ status: 1 });

export default mongoose.model<IBulkUploadBatch>('BulkUploadBatch', BulkUploadBatchSchema);
