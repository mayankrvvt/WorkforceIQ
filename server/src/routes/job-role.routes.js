import { Router } from 'express';
import { z } from 'zod';
import { EmployeeProfile } from '../models/employee-profile.model.js';
import { JobRole } from '../models/job-role.model.js';
import { Skill } from '../models/skill.model.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { scoreJobRoles } from '../services/role-matching.js';

const router = Router();

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const text = (max = 200) => z.string().trim().min(1).max(max);
const roleFields = {
  title: text(120),
  sector: text(100),
  aliases: z.array(text(100)).max(30).default([]),
  overview: z.string().trim().max(1000).optional(),
  requiredSkillIds: z.array(objectId).min(1).max(30),
  skillUtilization: z.array(text(500)).max(15).default([]),
  typicalDuties: z.array(text(500)).max(15).default([]),
  workSettings: z.array(text(200)).max(15).default([]),
  qualificationsToCheck: z.array(text(300)).max(15).default([]),
};
const createJobRoleSchema = z.object(roleFields).strict();
const updateJobRoleSchema = z
  .object({
    ...roleFields,
    status: z.enum(['active', 'inactive']).optional(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one job role field to update',
  });
const searchSchema = z.object({
  search: z.string().trim().max(100).optional(),
  sector: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function resolveRequiredSkills(skillIds) {
  const uniqueIds = [...new Set(skillIds)];
  if (uniqueIds.length !== skillIds.length) {
    return { error: 'Required skills must be unique' };
  }

  const skills = await Skill.find({
    _id: { $in: uniqueIds },
    status: 'active',
  })
    .select('_id')
    .lean();

  if (skills.length !== uniqueIds.length) {
    return { error: 'Every required skill must be an active catalog skill' };
  }

  return {
    requiredSkills: skills.map((skill) => ({ skillId: skill._id })),
  };
}

router.use(requireAuth);

router.get('/me/recommendations', requireRoles('employee'), async (request, response, next) => {
  try {
    const profile = await EmployeeProfile.findOne({
      userId: request.auth.user._id,
    })
      .select('skills')
      .populate('skills.skillId', 'normalizedName status')
      .lean();

    if (!profile?.skills?.length) {
      return response.json({ success: true, data: [] });
    }

    const roles = await JobRole.find({ status: 'active' })
      .populate('requiredSkills.skillId', 'normalizedName status')
      .lean();

    const recommendations = scoreJobRoles(profile.skills, roles).slice(0, 20);
    return response.json({ success: true, data: recommendations });
  } catch (error) {
    return next(error);
  }
});

router.get('/', async (request, response, next) => {
  try {
    const { search, sector, limit } = searchSchema.parse(request.query);
    const filter = { status: 'active' };
    if (sector) filter.sector = sector;
    if (search) {
      const pattern = new RegExp(escapeRegex(search), 'i');
      filter.$or = [
        { title: pattern },
        { normalizedTitle: pattern },
        { aliases: pattern },
        { sector: pattern },
      ];
    }

    const roles = await JobRole.find(filter)
      .populate('requiredSkills.skillId', 'normalizedName category')
      .sort({ title: 1 })
      .limit(limit)
      .lean();
    return response.json({ success: true, data: roles });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return response.status(400).json({
        success: false,
        message: 'Invalid job role search parameters',
        details: error.flatten(),
      });
    }
    return next(error);
  }
});

router.post('/', requireRoles('admin'), async (request, response, next) => {
  try {
    const input = createJobRoleSchema.parse(request.body);
    const resolved = await resolveRequiredSkills(input.requiredSkillIds);
    if (resolved.error) {
      return response.status(400).json({
        success: false,
        message: resolved.error,
      });
    }

    const role = await JobRole.create({
      title: input.title,
      normalizedTitle: input.title.toLowerCase(),
      sector: input.sector,
      aliases: input.aliases,
      overview: input.overview,
      requiredSkills: resolved.requiredSkills,
      skillUtilization: input.skillUtilization,
      typicalDuties: input.typicalDuties,
      workSettings: input.workSettings,
      qualificationsToCheck: input.qualificationsToCheck,
    });
    return response.status(201).json({ success: true, data: role });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return response.status(400).json({
        success: false,
        message: 'Invalid job role details',
        details: error.flatten(),
      });
    }
    if (error.code === 11000) {
      return response.status(409).json({
        success: false,
        message: 'A job role with this title already exists',
      });
    }
    return next(error);
  }
});

router.patch('/:roleId', requireRoles('admin'), async (request, response, next) => {
  try {
    if (!objectId.safeParse(request.params.roleId).success) {
      return response.status(400).json({
        success: false,
        message: 'Invalid job role ID',
      });
    }

    const input = updateJobRoleSchema.parse(request.body);
    const { requiredSkillIds, title, ...fields } = input;
    const update = { ...fields };
    if (title !== undefined) {
      update.title = title;
      update.normalizedTitle = title.toLowerCase();
    }
    if (requiredSkillIds) {
      const resolved = await resolveRequiredSkills(requiredSkillIds);
      if (resolved.error) {
        return response.status(400).json({
          success: false,
          message: resolved.error,
        });
      }
      update.requiredSkills = resolved.requiredSkills;
    }

    const role = await JobRole.findByIdAndUpdate(
      request.params.roleId,
      { $set: update },
      { new: true, runValidators: true },
    ).lean();
    if (!role) {
      return response.status(404).json({
        success: false,
        message: 'Job role not found',
      });
    }
    return response.json({ success: true, data: role });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return response.status(400).json({
        success: false,
        message: 'Invalid job role details',
        details: error.flatten(),
      });
    }
    if (error.code === 11000) {
      return response.status(409).json({
        success: false,
        message: 'A job role with this title already exists',
      });
    }
    return next(error);
  }
});

export { createJobRoleSchema, updateJobRoleSchema };
export default router;
