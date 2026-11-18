import admin from 'firebase-admin';
import { User } from '../models/user.model.js';
import { initializeFirebase } from '../config/firebase.js';

export async function requireAuth(request, response, next) {
  try {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      return response.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    initializeFirebase();
    const decodedToken = await admin.auth().verifyIdToken(
      authorization.slice('Bearer '.length),
    );

    let user = await User.findOne({
      firebaseUid: decodedToken.uid,
      softDeletedAt: null,
    });

    if (!user) {
      return response.status(403).json({
        success: false,
        message: 'Account has not been registered',
      });
    }

    if (user.status !== 'active') {
      return response.status(403).json({
        success: false,
        message: 'Account is not active',
      });
    }

    request.auth = {
      uid: decodedToken.uid,
      email: decodedToken.email || user.email,
      claims: decodedToken,
      user,
    };
    return next();
  } catch (error) {
    const isTokenError =
      error.code === 'auth/id-token-expired' ||
      error.code === 'auth/argument-error' ||
      error.code === 'auth/invalid-id-token';

    return response.status(isTokenError ? 401 : 500).json({
      success: false,
      message: isTokenError ? 'Invalid or expired authentication token' : 'Authentication failed',
    });
  }
}

export function requireRoles(...allowedRoles) {
  return (request, response, next) => {
    const role = request.auth?.user?.role;

    if (!role || !allowedRoles.includes(role)) {
      return response.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action',
      });
    }

    return next();
  };
}
