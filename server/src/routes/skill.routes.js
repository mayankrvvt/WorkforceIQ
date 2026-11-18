import { Router } from 'express';
import { z } from 'zod';
import { Skill } from '../models/skill.model.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = Router();

const searchSchema = z.object({
  search: z.string().trim().max(80).optional(),
  category: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const createSkillSchema = z
  .object({
    normalizedName: z.string().trim().min(1).max(100),
    category: z.string().trim().min(1).max(100),
    aliases: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  })
  .strict();

const updateSkillSchema = createSkillSchema
  .partial()
  .extend({
    status: z.enum(['active', 'inactive']).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one skill field to update',
  });

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.use(requireAuth);

router.get('/categories', async (_request, response, next) => {
  try {
    const categories = await Skill.distinct('category', { status: 'active' });
    categories.sort((left, right) => left.localeCompare(right));
    return response.json({ success: true, data: categories });
  } catch (error) {
    return next(error);
  }
});

router.get('/', async (request, response, next) => {
  try {
    const { search, category, limit } = searchSchema.parse(request.query);
    const filter = { status: 'active' };

    if (category) {
      filter.category = category;
    }
    if (search) {
      const pattern = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ normalizedName: pattern }, { aliases: pattern }];
    }

    const skills = await Skill.find(filter)
      .select('normalizedName category aliases')
      .sort({ normalizedName: 1 })
      .limit(limit)
      .lean();

    return response.json({ success: true, data: skills });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return response.status(400).json({
        success: false,
        message: 'Invalid skill search parameters',
        details: error.flatten(),
      });
    }
    return next(error);
  }
});

router.post('/', requireRoles('admin'), async (request, response, next) => {
  try {
    const input = createSkillSchema.parse(request.body);
    const skill = await Skill.create(input);
    return response.status(201).json({ success: true, data: skill });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return response.status(400).json({
        success: false,
        message: 'Invalid skill details',
        details: error.flatten(),
      });
    }
    if (error.code === 11000) {
      return response.status(409).json({
        success: false,
        message: 'A skill with this name already exists',
      });
    }
    return next(error);
  }
});

router.patch('/:skillId', requireRoles('admin'), async (request, response, next) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(request.params.skillId)) {
      return response.status(400).json({
        success: false,
        message: 'Invalid skill ID',
      });
    }

    const input = updateSkillSchema.parse(request.body);
    const skill = await Skill.findByIdAndUpdate(
      request.params.skillId,
      { $set: input },
      { new: true, runValidators: true },
    ).lean();

    if (!skill) {
      return response.status(404).json({
        success: false,
        message: 'Skill not found',
      });
    }

    return response.json({ success: true, data: skill });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return response.status(400).json({
        success: false,
        message: 'Invalid skill details',
        details: error.flatten(),
      });
    }
    if (error.code === 11000) {
      return response.status(409).json({
        success: false,
        message: 'A skill with this name already exists',
      });
    }
    return next(error);
  }
});

export { createSkillSchema, updateSkillSchema };
export default router;
