const Admin = require('../models/Admin');
const memoryStore = require('../store/memoryStore');
const { verifyAdminToken, verifyParticipantToken } = require('../utils/tokens');
const { AppError } = require('./errorHandler');

async function requireAdmin(req, res, next) {
  try {
    const token = req.cookies?.token || (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);

    if (!token) {
      throw new AppError('Authentication required. No session found.', 401, 'UNAUTHORIZED');
    }

    const payload = verifyAdminToken(token);
    if (!payload || payload.role !== 'ADMIN') {
      throw new AppError('Invalid or expired admin session.', 401, 'UNAUTHORIZED');
    }

    const admin = await Admin.findOne({ adminId: payload.id });

    if (!admin) {
      throw new AppError('Admin account not found.', 401, 'UNAUTHORIZED');
    }

    req.admin = {
      id: admin.adminId,
      username: admin.username,
      createdAt: admin.createdAt,
    };
    next();
  } catch (err) {
    next(err);
  }
}

async function requireParticipantOrAdmin(req, res, next) {
  try {
    // Check if admin first
    const token = req.cookies?.token || (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);
    const participantToken = req.headers['x-participant-token'] || req.cookies?.participantToken;

    if (token) {
      const adminPayload = verifyAdminToken(token);
      if (adminPayload && adminPayload.role === 'ADMIN') {
        const admin = await Admin.findOne({ adminId: adminPayload.id });
        if (admin) {
          req.admin = {
            id: admin.adminId,
            username: admin.username,
          };
          req.userRole = 'ADMIN';
          return next();
        }
      }
    }

    if (participantToken) {
      const pPayload = verifyParticipantToken(participantToken);
      if (pPayload) {
        const liveSession = memoryStore.getActiveSession(pPayload.participantId);
        req.participant = {
          participantId: pPayload.participantId,
          displayName: pPayload.displayName,
          classroomId: pPayload.classroomId,
          status: liveSession?.status || 'ADMITTED',
        };
        req.userRole = 'STUDENT';
        return next();
      }
    }

    throw new AppError('Access denied. Valid session required.', 401, 'UNAUTHORIZED');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  requireAdmin,
  requireParticipantOrAdmin,
};
