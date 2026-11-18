import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { EmployeeProfile } from '../models/employee-profile.model.js';
import { EmployerProfile } from '../models/employer-profile.model.js';
import { Skill } from '../models/skill.model.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import {
  analyzeHiringCriteria,
} from '../services/ai/hiring-recommendations.js';
import { GeminiServiceError } from '../services/ai/skill-analysis.js';

const router = Router();
const candidateResultLimit = 20;
const candidateScanLimit = 500;

const searchSchema = z
  .object({
    skill: z.string().trim().max(80).optional(),
    country: z.string().trim().max(100).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()
  .refine((value) => Boolean(value.skill || value.country), {
    message: 'Search by at least one skill or country',
  });

const recommendationRequestSchema = z
  .object({
    consent: z.literal(true),
    jobTitle: z.string().trim().min(2).max(160),
    jobRequirements: z.string().trim().max(3000).optional(),
    country: z.string().trim().max(100).optional(),
  })
  .strict();

const recommendationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Hiring recommendation limit reached. Try again later.',
  },
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeProviderMessage(message) {
  let sanitized = String(message);
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    sanitized = sanitized.replaceAll(apiKey, '[REDACTED]');
  }
  return sanitized
    .replace(/([?&]key=)[^&\s]+/gi, '$1[REDACTED]')
    .slice(0, 500);
}

export function buildEmployeeSearchFilter({ country, skillIds = [] }) {
  const filter = { visibility: 'public' };
  if (country) {
    filter['location.country'] = new RegExp(
      `^${escapeRegex(country)}$`,
      'i',
    );
  }
  if (skillIds.length > 0) {
    filter.skills = { $elemMatch: { skillId: { $in: skillIds } } };
  }
  return filter;
}

export function rankPublicEmployeeProfiles(profiles, criteriaSkills) {
  if (criteriaSkills.length === 0) return [];

  const criteriaIds = criteriaSkills.map((skill) => String(skill._id));
  const rankedProfiles = profiles
    .map((profile) => {
      const activeSkills = (profile.skills || []).filter(
        (entry) => entry.skillId?.status === 'active',
      );
      const activeSkillIds = new Set(
        activeSkills.map((entry) => String(entry.skillId._id)),
      );
      const matchedSkills = criteriaSkills.filter((skill) =>
        activeSkillIds.has(String(skill._id)),
      );

      if (matchedSkills.length === 0) return null;

      return {
        ...toPublicEmployeeSearchResult(profile),
        matchScore: Math.round(
          (matchedSkills.length / criteriaIds.length) * 100,
        ),
        matchedSkills: matchedSkills.map((skill) => skill.normalizedName),
        missingSkills: criteriaSkills
          .filter((skill) => !activeSkillIds.has(String(skill._id)))
          .map((skill) => skill.normalizedName),
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.matchScore - left.matchScore);

  return rankedProfiles.slice(0, candidateResultLimit);
}

export function toPublicEmployeeSearchResult(profile) {
  const activeSkills = (profile.skills || [])
    .filter((entry) => entry.skillId?.status === 'active')
    .map((entry) => ({
      name: entry.skillId.normalizedName,
      category: entry.skillId.category,
      proficiency: entry.proficiency,
      ...(entry.yearsExperience !== undefined
        ? { yearsExperience: entry.yearsExperience }
        : {}),
    }));

  return {
    _id: String(profile._id),
    displayName:
      [
        profile.personalDetails?.firstName,
        profile.personalDetails?.lastName,
      ]
        .filter((name) => typeof name === 'string' && name.trim())
        .join(' ') || 'Workforce candidate',
    location: {
      city: profile.location?.city || '',
      state: profile.location?.state || '',
      country: profile.location?.country || '',
    },
    skills: activeSkills,
    education: (profile.education || []).map((entry) => ({
      qualification: entry.qualification || '',
      fieldOfStudy: entry.fieldOfStudy || '',
    })),
    experience: (profile.experience || []).map((entry) => ({
      title: entry.title || '',
      ...(entry.startDate ? { startDate: entry.startDate } : {}),
      ...(entry.endDate ? { endDate: entry.endDate } : {}),
      ...(entry.isCurrent ? { isCurrent: true } : {}),
    })),
    targetRoles: profile.preferences?.targetRoles || [],
    willingToRelocate: Boolean(profile.preferences?.willingToRelocate),
  };
}

async function requireVerifiedEmployer(request, response, next) {
  try {
    const employerProfile = await EmployerProfile.findOne({
      userId: request.auth.user._id,
    })
      .select('_id verificationStatus')
      .lean();

    if (employerProfile?.verificationStatus !== 'verified') {
      return response.status(403).json({
        success: false,
        message: 'Company verification is required to search public employee profiles',
      });
    }

    request.auth.employerProfileId = employerProfile._id;
    return next();
  } catch (error) {
    return next(error);
  }
}

router.get(
  '/search',
  requireAuth,
  requireRoles('employer'),
  requireVerifiedEmployer,
  async (request, response, next) => {
    try {
      const { skill, country, limit } = searchSchema.parse(request.query);
      let skillIds = [];

      if (skill) {
        const pattern = new RegExp(escapeRegex(skill), 'i');
        const matchingSkills = await Skill.find({
          status: 'active',
          $or: [{ normalizedName: pattern }, { aliases: pattern }],
        })
          .select('_id')
          .lean();
        skillIds = matchingSkills.map((entry) => entry._id);
        if (skillIds.length === 0) {
          return response.json({ success: true, data: [] });
        }
      }

      const profiles = await EmployeeProfile.find(
        buildEmployeeSearchFilter({ country, skillIds }),
      )
        .select(
          'personalDetails.firstName personalDetails.lastName location.city location.state location.country education.qualification education.fieldOfStudy experience.title experience.startDate experience.endDate experience.isCurrent skills.skillId skills.proficiency skills.yearsExperience preferences.targetRoles preferences.willingToRelocate',
        )
        .populate('skills.skillId', 'normalizedName category status')
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean();

      return response.json({
        success: true,
        data: profiles.map(toPublicEmployeeSearchResult),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return response.status(400).json({
          success: false,
          message: 'Invalid employee search parameters',
          details: error.flatten(),
        });
      }
      return next(error);
    }
  },
);

router.post(
  '/recommendations',
  requireAuth,
  requireRoles('employer'),
  requireVerifiedEmployer,
  recommendationRateLimit,
  async (request, response, next) => {
    const parsed = recommendationRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        success: false,
        message: 'Explicit consent and valid job details are required',
        details: parsed.error.flatten(),
      });
    }

    try {
      const skills = await Skill.find({ status: 'active' })
        .select('_id normalizedName category')
        .sort({ normalizedName: 1 })
        .lean();
      const catalog = skills.map((skill) => ({
        id: String(skill._id),
        normalizedName: skill.normalizedName,
        category: skill.category,
      }));
      const { skillIds } = await analyzeHiringCriteria(
        {
          jobTitle: parsed.data.jobTitle,
          jobRequirements: parsed.data.jobRequirements || '',
        },
        catalog,
      );
      const selectedSkillIds = new Set(skillIds);
      const criteriaSkills = skills.filter((skill) =>
        selectedSkillIds.has(String(skill._id)),
      );

      let candidates = [];
      if (criteriaSkills.length > 0) {
        const profiles = await EmployeeProfile.find(
          buildEmployeeSearchFilter({
            country: parsed.data.country,
            skillIds: criteriaSkills.map((skill) => skill._id),
          }),
        )
          .select(
            'personalDetails.firstName personalDetails.lastName location.city location.state location.country education.qualification education.fieldOfStudy experience.title experience.startDate experience.endDate experience.isCurrent skills.skillId skills.proficiency skills.yearsExperience preferences.targetRoles preferences.willingToRelocate',
          )
          .populate('skills.skillId', 'normalizedName category status')
          .sort({ updatedAt: -1 })
          .limit(candidateScanLimit)
          .lean();

        candidates = rankPublicEmployeeProfiles(profiles, criteriaSkills);
      }

      return response.json({
        success: true,
        data: {
          jobTitle: parsed.data.jobTitle,
          criteriaSkills: criteriaSkills.map((skill) => ({
            name: skill.normalizedName,
            category: skill.category,
          })),
          candidates,
        },
      });
    } catch (error) {
      if (error instanceof GeminiServiceError) {
        const cause = error.cause;
        const details = {
          code: error.code,
          causeName: cause?.name,
          causeStatus: cause?.status || cause?.response?.status,
          causeMessage:
            typeof cause?.message === 'string'
              ? sanitizeProviderMessage(cause.message)
              : undefined,
        };
        console.error(
          `Employer hiring recommendations failed: ${JSON.stringify(details)}`,
        );
        return response.status(error.status).json({
          success: false,
          message:
            error.code === 'configuration_missing'
              ? error.message
              : 'The recommendation service could not complete the request. Check the server logs before retrying.',
        });
      }
      return next(error);
    }
  },
);

export {
  recommendationRequestSchema,
  searchSchema,
};
export default router;
