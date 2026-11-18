import mongoose from 'mongoose';

const skillSchema = new mongoose.Schema(
  {
    normalizedName: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    aliases: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true },
);

export const Skill =
  mongoose.models.Skill || mongoose.model('Skill', skillSchema);
