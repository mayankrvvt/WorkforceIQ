import mongoose from 'mongoose';

const requiredSkillSchema = new mongoose.Schema(
  {
    skillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Skill',
      required: true,
    },
  },
  { _id: false },
);

const jobRoleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    normalizedTitle: { type: String, required: true, unique: true, trim: true },
    sector: { type: String, required: true, trim: true },
    aliases: [{ type: String, trim: true }],
    overview: { type: String, trim: true },
    requiredSkills: {
      type: [requiredSkillSchema],
      required: true,
      validate: {
        validator: (skills) => skills.length > 0,
        message: 'At least one required skill is needed',
      },
    },
    skillUtilization: [{ type: String, trim: true }],
    typicalDuties: [{ type: String, trim: true }],
    workSettings: [{ type: String, trim: true }],
    qualificationsToCheck: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true },
);

jobRoleSchema.index({ status: 1, sector: 1 });

export const JobRole =
  mongoose.models.JobRole || mongoose.model('JobRole', jobRoleSchema);
