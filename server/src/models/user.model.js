import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['employee', 'employer', 'admin'],
      required: true,
      default: 'employee',
    },
    status: {
      type: String,
      enum: ['active', 'disabled', 'pending'],
      default: 'pending',
    },
    softDeletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

export const User = mongoose.models.User || mongoose.model('User', userSchema);
