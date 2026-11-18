import mongoose from 'mongoose';

const occupationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    sector: { type: String, required: true, trim: true },
    relevance: { type: Number, required: true, min: 1, max: 5 },
    rationale: { type: String, required: true, trim: true },
    supportingSkills: [{ type: String, trim: true }],
    skillGaps: [{ type: String, trim: true }],
    typicalDuties: [{ type: String, trim: true }],
    qualificationsToCheck: [{ type: String, trim: true }],
    trainingSuggestions: [{ type: String, trim: true }],
  },
  { _id: false },
);

const resultSchema = new mongoose.Schema(
  {
    summary: { type: String, required: true, trim: true },
    occupations: {
      type: [occupationSchema],
      required: true,
      validate: {
        validator: (occupations) => occupations.length > 0,
        message: 'At least one occupation recommendation is required',
      },
    },
  },
  { _id: false },
);

const skillSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    proficiency: { type: String, required: true },
    yearsExperience: Number,
  },
  { _id: false },
);

const skillAnalysisSchema = new mongoose.Schema(
  {
    employeeProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmployeeProfile',
      required: true,
      index: true,
    },
    requestedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    promptVersion: { type: String, required: true },
    model: { type: String, required: true },
    destinationCountry: { type: String, trim: true },
    inputSnapshot: {
      skills: [skillSnapshotSchema],
      education: [
        {
          qualification: { type: String, trim: true },
          fieldOfStudy: { type: String, trim: true },
        },
      ],
      targetRoles: [{ type: String, trim: true }],
      preferredIndustries: [{ type: String, trim: true }],
    },
    result: { type: resultSchema, required: true },
  },
  { timestamps: true },
);

skillAnalysisSchema.index({ employeeProfileId: 1, createdAt: -1 });

export const SkillAnalysis =
  mongoose.models.SkillAnalysis ||
  mongoose.model('SkillAnalysis', skillAnalysisSchema);
