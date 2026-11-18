import mongoose from 'mongoose';

const employeeSkillSchema = new mongoose.Schema(
  {
    skillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Skill',
      required: true,
    },
    proficiency: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      required: true,
    },
    yearsExperience: {
      type: Number,
      min: 0,
    },
    evidence: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const employeeProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    personalDetails: {
      firstName: { type: String, trim: true },
      lastName: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
    location: {
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      country: { type: String, trim: true },
    },
    education: [
      {
        institution: { type: String, trim: true },
        qualification: { type: String, trim: true },
        fieldOfStudy: { type: String, trim: true },
        startYear: Number,
        endYear: Number,
      },
    ],
    experience: [
      {
        title: { type: String, trim: true },
        employer: { type: String, trim: true },
        startDate: Date,
        endDate: Date,
        isCurrent: { type: Boolean, default: false },
        description: { type: String, trim: true },
      },
    ],
    skills: [employeeSkillSchema],
    preferences: {
      targetRoles: [{ type: String, trim: true }],
      preferredIndustries: [{ type: String, trim: true }],
      workMode: {
        type: String,
        enum: ['onsite', 'remote', 'hybrid', 'any'],
        default: 'any',
      },
      willingToRelocate: { type: Boolean, default: false },
    },
    visibility: {
      type: String,
      enum: ['private', 'consent_only', 'public'],
      default: 'private',
    },
  },
  { timestamps: true },
);

export const EmployeeProfile =
  mongoose.models.EmployeeProfile ||
  mongoose.model('EmployeeProfile', employeeProfileSchema);
