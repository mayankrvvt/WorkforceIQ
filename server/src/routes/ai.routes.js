import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { EmployeeProfile } from '../models/employee-profile.model.js';
import { SkillAnalysis } from '../models/skill-analysis.model.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import {
  analyzeSkills,
  buildSkillAnalysisSnapshot,
  GeminiServiceError,
} from '../services/ai/skill-analysis.js';

const router = Router();

const analyzeRequestSchema = z
  .object({
    consent: z.literal(true),
    destinationCountry: z.string().trim().max(100).optional(),
  })
  .strict();

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

const analysisRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Analysis limit reached. Try again later.',
  },
});

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

router.use(requireAuth, requireRoles('employee'));

router.get('/analyses', async (request, response, next) => {
  try {
    const { limit } = historyQuerySchema.parse(request.query);
    const profile = await EmployeeProfile.findOne({
      userId: request.auth.user._id,
    })
      .select('_id')
      .lean();

    if (!profile) {
      return response.json({ success: true, data: [] });
    }

    const analyses = await SkillAnalysis.find({
      employeeProfileId: profile._id,
      requestedByUserId: request.auth.user._id,
    })
      .select('promptVersion model destinationCountry result createdAt')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return response.json({ success: true, data: analyses });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return response.status(400).json({
        success: false,
        message: 'Invalid analysis history parameters',
        details: error.flatten(),
      });
    }
    return next(error);
  }
});

router.post('/analyze-skills', analysisRateLimit, async (request, response, next) => {
  const parsed = analyzeRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({
      success: false,
      message: 'Explicit consent is required before analyzing profile data',
      details: parsed.error.flatten(),
    });
  }

  try {
    const profile = await EmployeeProfile.findOne({
      userId: request.auth.user._id,
    })
      .populate('skills.skillId', 'normalizedName category status')
      .lean();

    if (!profile?.skills?.length) {
      return response.status(400).json({
        success: false,
        message: 'Add at least one skill to your profile before analysis',
      });
    }

    const inputSnapshot = buildSkillAnalysisSnapshot(profile);

    if (inputSnapshot.skills.length === 0) {
      return response.status(400).json({
        success: false,
        message: 'Add an active catalog skill before analysis',
      });
    }

    const destinationCountry = parsed.data.destinationCountry || undefined;
    const aiInput = {
      ...inputSnapshot,
      ...(destinationCountry ? { destinationCountry } : {}),
    };
    const { model, result } = await analyzeSkills(aiInput);
    const analysis = await SkillAnalysis.create({
      employeeProfileId: profile._id,
      requestedByUserId: request.auth.user._id,
      promptVersion: 'transferable-occupations-v1',
      model,
      destinationCountry,
      inputSnapshot,
      result,
    });

    return response.status(201).json({
      success: true,
      data: {
        _id: analysis._id,
        destinationCountry: analysis.destinationCountry,
        result: analysis.result,
        createdAt: analysis.createdAt,
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
      console.error(`Skill analysis failed: ${JSON.stringify(details)}`);
      return response.status(error.status).json({
        success: false,
        message:
          error.code === 'configuration_missing'
            ? error.message
            : error.code === 'provider_request_failed'
              ? 'The analysis service request failed. Check the server logs for details before retrying.'
              : 'The analysis service returned an unexpected response. Check the server logs before retrying.',
      });
    }
    return next(error);
  }
});

export { analyzeRequestSchema, historyQuerySchema };
export default router;
