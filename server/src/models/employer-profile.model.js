import mongoose from 'mongoose';

const employerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    industry: {
      type: String,
      trim: true,
    },
    size: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'],
    },
    location: {
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      country: { type: String, trim: true },
    },
    website: {
      type: String,
      trim: true,
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    verificationNote: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    verifiedAt: Date,
  },
  { timestamps: true },
);

export const EmployerProfile =
  mongoose.models.EmployerProfile ||
  mongoose.model('EmployerProfile', employerProfileSchema);
