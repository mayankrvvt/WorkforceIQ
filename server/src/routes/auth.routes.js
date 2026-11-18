import { Router } from 'express';
import { z } from 'zod';
import admin from 'firebase-admin';
import { User } from '../models/user.model.js';
import { EmployerProfile } from '../models/employer-profile.model.js';
import { requireAuth } from '../middleware/auth.js';
import { initializeFirebase } from '../config/firebase.js';

const router = Router();

const registrationSchema = z.object({
  idToken: z.string().min(1),
  role: z.enum(['employee', 'employer']),
  companyName: z.string().trim().min(2).optional(),
});

router.post('/register', async (request, response, next) => {
  try {
    const input = registrationSchema.parse(request.body);
    if (input.role === 'employer' && !input.companyName) {
      return response.status(400).json({
        success: false,
        message: 'Company name is required for employer registration',
      });
    }

    initializeFirebase();
    const decodedToken = await admin.auth().verifyIdToken(input.idToken);

    if (!decodedToken.email) {
      return response.status(400).json({
        success: false,
        message: 'Firebase account must have an email address',
      });
    }

    let user = await User.findOne({ firebaseUid: decodedToken.uid });
    if (user) {
      if (user.softDeletedAt) {
        return response.status(403).json({
          success: false,
          message: 'Account is unavailable',
        });
      }
    } else {
      user = await User.create({
        firebaseUid: decodedToken.uid,
        email: decodedToken.email,
        role: input.role,
        status: 'active',
      });

      if (input.role === 'employer') {
        await EmployerProfile.create({
          userId: user._id,
          companyName: input.companyName,
        });
      }
    }

    return response.status(200).json({
      success: true,
      data: {
        uid: decodedToken.uid,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return response.status(400).json({
        success: false,
        message: 'Invalid registration details',
        details: error.flatten(),
      });
    }
    if (error.code === 'auth/id-token-expired' || error.code === 'auth/invalid-id-token') {
      return response.status(401).json({
        success: false,
        message: 'Invalid or expired authentication token',
      });
    }
    return next(error);
  }
});

router.get('/me', requireAuth, (request, response) => {
  response.json({
    success: true,
    data: {
      uid: request.auth.uid,
      email: request.auth.email,
      role: request.auth.user.role,
      status: request.auth.user.status,
    },
  });
});

export default router;
