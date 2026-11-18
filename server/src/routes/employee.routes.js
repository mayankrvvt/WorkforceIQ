import { Router } from 'express';
import { z } from 'zod';
import { EmployeeProfile } from '../models/employee-profile.model.js';
import { Skill } from '../models/skill.model.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = Router();

const text = (max = 200) => z.string().trim().max(max);
const optionalDate = z.coerce.date().optional();
const employeeSkillInputSchema = z
  .object({
    skillId: z.string().regex(/^[a-f\d]{24}$/i),
    proficiency: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
    yearsExperience: z.coerce.number().min(0).max(80).optional(),
    evidence: text(2000).optional(),
  })
  .strict();
const employeeSkillUpdateSchema = z
  .object({
    proficiency: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
    yearsExperience: z.coerce.number().min(0).max(80).optional(),
    evidence: text(2000).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one skill field to update',
  });

async function getPopulatedProfile(profileId) {
  return EmployeeProfile.findById(profileId)
    .populate('skills.skillId', 'normalizedName category status')
    .lean();
}

const employeeProfileUpdateSchema = z
  .object({
    personalDetails: z
      .object({
        firstName: text(80).optional(),
        lastName: text(80).optional(),
        phone: text(32).optional(),
      })
      .strict()
      .optional(),
    location: z
      .object({
        city: text(100).optional(),
        state: text(100).optional(),
        country: text(100).optional(),
      })
      .strict()
      .optional(),
    education: z
      .array(
        z
          .object({
            institution: text().optional(),
            qualification: text().optional(),
            fieldOfStudy: text().optional(),
            startYear: z.coerce.number().int().min(1900).max(2200).optional(),
            endYear: z.coerce.number().int().min(1900).max(2200).optional(),
          })
          .strict(),
      )
      .max(20)
      .optional(),
    experience: z
      .array(
        z
          .object({
            title: text().optional(),
            employer: text().optional(),
            startDate: optionalDate,
            endDate: optionalDate,
            isCurrent: z.boolean().optional(),
            description: text(5000).optional(),
          })
          .strict(),
      )
      .max(30)
      .optional(),
    preferences: z
      .object({
        targetRoles: z.array(text(100)).max(30).optional(),
        preferredIndustries: z.array(text(100)).max(30).optional(),
        workMode: z.enum(['onsite', 'remote', 'hybrid', 'any']).optional(),
        willingToRelocate: z.boolean().optional(),
      })
      .strict()
      .optional(),
    visibility: z.enum(['private', 'consent_only', 'public']).optional(),
  })
  .strict()
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one profile field to update',
  });

export {
  employeeProfileUpdateSchema,
  employeeSkillInputSchema,
  employeeSkillUpdateSchema,
};

export function hasMeaningfulProfileDetails(profile) {
  const hasText = (values) =>
    values.some((value) => typeof value === 'string' && value.trim().length > 0);
  const hasArrayText = (values = []) =>
    values.some((value) => typeof value === 'string' && value.trim().length > 0);
  const hasEntries = (entries = [], fields = []) =>
    entries.some((entry) => hasText(fields.map((field) => entry[field])));

  return (
    hasText([
      profile.personalDetails?.firstName,
      profile.personalDetails?.lastName,
      profile.personalDetails?.phone,
      profile.location?.city,
      profile.location?.state,
      profile.location?.country,
    ]) ||
    hasEntries(profile.education, [
      'institution',
      'qualification',
      'fieldOfStudy',
    ]) ||
    hasEntries(profile.experience, ['title', 'employer', 'description']) ||
    hasArrayText(profile.preferences?.targetRoles) ||
    hasArrayText(profile.preferences?.preferredIndustries) ||
    profile.skills?.length > 0
  );
}

router.use(requireAuth, requireRoles('employee'));

router.get('/me', async (request, response, next) => {
  try {
    const profile = await EmployeeProfile.findOne({
      userId: request.auth.user._id,
    })
      .populate('skills.skillId', 'normalizedName category status')
      .lean();

    if (!profile) {
      return response.json({
        success: true,
        data: {
          userId: request.auth.user._id,
          personalDetails: {},
          location: {},
          education: [],
          experience: [],
          skills: [],
          preferences: {
            targetRoles: [],
            preferredIndustries: [],
            workMode: 'any',
            willingToRelocate: false,
          },
          visibility: 'private',
        },
      });
    }

    return response.json({ success: true, data: profile });
  } catch (error) {
    return next(error);
  }
});

router.patch('/me', async (request, response, next) => {
  try {
    const input = employeeProfileUpdateSchema.parse(request.body);
    const profile =
      (await EmployeeProfile.findOne({
        userId: request.auth.user._id,
      })) ||
      new EmployeeProfile({ userId: request.auth.user._id });

    for (const [field, value] of Object.entries(input)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [nestedField, nestedValue] of Object.entries(value)) {
          profile.set(`${field}.${nestedField}`, nestedValue);
        }
      } else {
        profile.set(field, value);
      }
    }

    if (!hasMeaningfulProfileDetails(profile)) {
      return response.status(400).json({
        success: false,
        message: 'Add at least one profile detail before saving',
      });
    }

    await profile.save();
    const updatedProfile = await getPopulatedProfile(profile._id);

    return response.json({ success: true, data: updatedProfile });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return response.status(400).json({
        success: false,
        message: 'Invalid employee profile details',
        details: error.flatten(),
      });
    }
    return next(error);
  }
});

router.post('/me/skills', async (request, response, next) => {
  try {
    const input = employeeSkillInputSchema.parse(request.body);
    const skill = await Skill.findOne({
      _id: input.skillId,
      status: 'active',
    })
      .select('_id')
      .lean();

    if (!skill) {
      return response.status(404).json({
        success: false,
        message: 'Active skill not found',
      });
    }

    const profile =
      (await EmployeeProfile.findOne({
        userId: request.auth.user._id,
      })) ||
      new EmployeeProfile({ userId: request.auth.user._id });

    const alreadyAdded = profile.skills.some(
      (entry) => entry.skillId.toString() === skill._id.toString(),
    );
    if (alreadyAdded) {
      return response.status(409).json({
        success: false,
        message: 'This skill is already in your profile',
      });
    }

    profile.skills.push({
      skillId: skill._id,
      proficiency: input.proficiency,
      yearsExperience: input.yearsExperience,
      evidence: input.evidence,
    });
    await profile.save();

    return response.status(201).json({
      success: true,
      data: await getPopulatedProfile(profile._id),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return response.status(400).json({
        success: false,
        message: 'Invalid employee skill details',
        details: error.flatten(),
      });
    }
    return next(error);
  }
});

router.patch('/me/skills/:skillId', async (request, response, next) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(request.params.skillId)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid skill ID',
      });
    }

    const input = employeeSkillUpdateSchema.parse(request.body);
    const profile = await EmployeeProfile.findOne({
      userId: request.auth.user._id,
    });
    const entry = profile?.skills.find(
      (skill) => skill.skillId.toString() === request.params.skillId,
    );

    if (!profile || !entry) {
      return response.status(404).json({
        success: false,
        message: 'Skill not found in employee profile',
      });
    }

    for (const [field, value] of Object.entries(input)) {
      entry.set(field, value);
    }
    await profile.save();

    return response.json({
      success: true,
      data: await getPopulatedProfile(profile._id),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return response.status(400).json({
        success: false,
        message: 'Invalid employee skill details',
        details: error.flatten(),
      });
    }
    return next(error);
  }
});

router.delete('/me/skills/:skillId', async (request, response, next) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(request.params.skillId)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid skill ID',
      });
    }

    const profile = await EmployeeProfile.findOne({
      userId: request.auth.user._id,
    });
    if (!profile) {
      return response.status(404).json({
        success: false,
        message: 'Employee profile not found',
      });
    }

    const skillIndex = profile.skills.findIndex(
      (skill) => skill.skillId.toString() === request.params.skillId,
    );
    if (skillIndex === -1) {
      return response.status(404).json({
        success: false,
        message: 'Skill not found in employee profile',
      });
    }

    profile.skills.splice(skillIndex, 1);
    await profile.save();
    return response.json({
      success: true,
      data: await getPopulatedProfile(profile._id),
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
