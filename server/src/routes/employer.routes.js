import { Router } from 'express';
import { z } from 'zod';
import { EmployerProfile } from '../models/employer-profile.model.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = Router();

const objectId = /^[a-f\d]{24}$/i;
const companyProfileUpdateSchema = z
  .object({
    companyName: z.string().trim().min(2).max(160).optional(),
    industry: z.string().trim().max(100).optional(),
    size: z
      .enum(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'])
      .optional(),
    location: z
      .object({
        city: z.string().trim().max(100).optional(),
        state: z.string().trim().max(100).optional(),
        country: z.string().trim().max(100).optional(),
      })
      .strict()
      .optional(),
    website: z
      .string()
      .trim()
      .max(200)
      .refine((value) => {
        if (!value) return true;
        try {
          const url = new URL(value);
          return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname);
        } catch {
          return false;
        }
      }, 'Website must be a valid HTTP or HTTPS URL')
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one company profile field to update',
  });

const verificationQuerySchema = z.object({
  status: z.enum(['pending', 'verified', 'rejected']).default('pending'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const verificationDecisionSchema = z
  .object({
    verificationStatus: z.enum(['verified', 'rejected']),
    verificationNote: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.verificationStatus !== 'rejected' ||
      Boolean(value.verificationNote?.length),
    {
      message: 'A note is required when rejecting an employer profile',
      path: ['verificationNote'],
    },
  );

export function buildEmployerProfileUpdate(input) {
  const fields = {};
  for (const [field, value] of Object.entries(input)) {
    if (field === 'location') {
      for (const [locationField, locationValue] of Object.entries(value)) {
        fields[`location.${locationField}`] = locationValue;
      }
    } else {
      fields[field] = value;
    }
  }

  return {
    $set: {
      ...fields,
      verificationStatus: 'pending',
      verifiedAt: null,
    },
    $unset: { verificationNote: 1 },
  };
}

router.use(requireAuth);

router.get('/me', requireRoles('employer'), async (request, response, next) => {
  try {
    const profile = await EmployerProfile.findOne({
      userId: request.auth.user._id,
    }).lean();

    if (!profile) {
      return response.status(404).json({
        success: false,
        message: 'Employer profile not found',
      });
    }

    return response.json({ success: true, data: profile });
  } catch (error) {
    return next(error);
  }
});

router.patch('/me', requireRoles('employer'), async (request, response, next) => {
  try {
    const input = companyProfileUpdateSchema.parse(request.body);
    const profile = await EmployerProfile.findOneAndUpdate(
      { userId: request.auth.user._id },
      buildEmployerProfileUpdate(input),
      { new: true, runValidators: true },
    ).lean();

    if (!profile) {
      return response.status(404).json({
        success: false,
        message: 'Employer profile not found',
      });
    }

    return response.json({ success: true, data: profile });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return response.status(400).json({
        success: false,
        message: 'Invalid company profile details',
        details: error.flatten(),
      });
    }
    return next(error);
  }
});

router.get(
  '/admin/verification',
  requireRoles('admin'),
  async (request, response, next) => {
    try {
      const { status, limit } = verificationQuerySchema.parse(request.query);
      const profiles = await EmployerProfile.find({
        verificationStatus: status,
      })
        .populate('userId', 'email')
        .sort({ updatedAt: 1 })
        .limit(limit)
        .lean();

      return response.json({ success: true, data: profiles });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return response.status(400).json({
          success: false,
          message: 'Invalid verification queue parameters',
          details: error.flatten(),
        });
      }
      return next(error);
    }
  },
);

router.patch(
  '/admin/verification/:profileId',
  requireRoles('admin'),
  async (request, response, next) => {
    try {
      if (!objectId.test(request.params.profileId)) {
        return response.status(400).json({
          success: false,
          message: 'Invalid employer profile ID',
        });
      }

      const input = verificationDecisionSchema.parse(request.body);
      const update = {
        $set: {
          verificationStatus: input.verificationStatus,
          verifiedAt:
            input.verificationStatus === 'verified' ? new Date() : null,
        },
      };
      if (input.verificationStatus === 'rejected') {
        update.$set.verificationNote = input.verificationNote;
      } else {
        update.$unset = { verificationNote: 1 };
      }

      const profile = await EmployerProfile.findByIdAndUpdate(
        request.params.profileId,
        update,
        { new: true, runValidators: true },
      ).lean();
      if (!profile) {
        return response.status(404).json({
          success: false,
          message: 'Employer profile not found',
        });
      }

      return response.json({ success: true, data: profile });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return response.status(400).json({
          success: false,
          message: 'Invalid employer verification decision',
          details: error.flatten(),
        });
      }
      return next(error);
    }
  },
);

export {
  companyProfileUpdateSchema,
  verificationDecisionSchema,
  verificationQuerySchema,
};
export default router;
