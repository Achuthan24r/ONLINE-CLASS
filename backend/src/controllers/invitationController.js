const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const memoryStore = require('../store/memoryStore');
const { signParticipantToken } = require('../utils/tokens');
const { generateLiveKitToken } = require('../utils/livekit');
const { AppError } = require('../middlewares/errorHandler');
const { getIO } = require('../socket');

const joinSchema = z.object({
  code: z.string().min(5),
  displayName: z.string().min(1).max(50),
});

async function validateInvitation(req, res, next) {
  try {
    const { code } = req.params;

    const invitation = memoryStore.findInvitationByCode(code);

    if (!invitation) {
      throw new AppError('Invitation link is invalid or does not exist.', 404, 'NOT_FOUND');
    }

    if (invitation.isRevoked) {
      throw new AppError('This classroom invitation link has been revoked by the administrator.', 403, 'INVITATION_REVOKED');
    }

    if (invitation.expiresAt && new Date() > invitation.expiresAt) {
      throw new AppError('This classroom invitation link has expired.', 403, 'INVITATION_EXPIRED');
    }

    if (!invitation.classroom || invitation.classroom.status === 'ENDED') {
      throw new AppError('This classroom has already ended.', 410, 'CLASSROOM_ENDED');
    }

    // Check active participants count
    const activeCount = memoryStore.countActiveParticipants(invitation.classroom.id);

    if (activeCount >= invitation.maxParticipants) {
      throw new AppError('Classroom is currently at maximum participant capacity.', 429, 'CAPACITY_REACHED');
    }

    res.json({
      success: true,
      data: {
        valid: true,
        classroom: {
          id: invitation.classroom.id,
          name: invitation.classroom.name,
          description: invitation.classroom.description,
          status: invitation.classroom.status,
        },
        maxParticipants: invitation.maxParticipants,
        currentParticipants: activeCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function joinClassroom(req, res, next) {
  try {
    const { code, displayName } = req.body;

    const invitation = memoryStore.findInvitationByCode(code);

    if (!invitation || invitation.isRevoked || !invitation.classroom || invitation.classroom.status === 'ENDED') {
      throw new AppError('Invalid or expired classroom invitation.', 400, 'INVALID_INVITATION');
    }

    const activeCount = memoryStore.countActiveParticipants(invitation.classroom.id);

    if (activeCount >= invitation.maxParticipants) {
      throw new AppError('Classroom has reached maximum participant limit.', 429, 'ROOM_FULL');
    }

    // Generate opaque participant identity
    const participantId = `stu_${uuidv4().replace(/-/g, '').slice(0, 12)}`;

    // Create participant session in memory with default strictly DENIED permissions
    const session = memoryStore.createParticipantSession({
      classroomId: invitation.classroom.id,
      participantId,
      displayName: displayName.trim(),
      role: 'STUDENT',
    });

    // Record audit log in memory
    memoryStore.createAuditLog({
      classroomId: invitation.classroom.id,
      action: 'PARTICIPANT_JOINED',
      targetParticipantId: participantId,
      details: JSON.stringify({ displayName: displayName.trim(), participantId }),
    });

    // Generate restricted LiveKit access token
    const livekitToken = await generateLiveKitToken({
      roomName: invitation.classroom.id,
      participantId,
      displayName: displayName.trim(),
      isAdmin: false,
      permissions: {
        canPublishMic: false,
        canPublishCam: false,
        canPublishScreen: false,
      },
    });

    // Generate participant session JWT
    const participantSessionToken = signParticipantToken({
      participantId,
      classroomId: invitation.classroom.id,
      sessionId: session.id,
      displayName: session.displayName,
      role: 'STUDENT',
    });

    // Notify room via Socket.IO
    const io = getIO();
    if (io) {
      io.to(`classroom:${invitation.classroom.id}`).emit('participant:joined', {
        participant: {
          id: session.id,
          participantId: session.participantId,
          displayName: session.displayName,
          role: session.role,
          permission: session.permission,
        },
      });
    }

    res.status(201).json({
      success: true,
      data: {
        classroom: {
          id: invitation.classroom.id,
          name: invitation.classroom.name,
          description: invitation.classroom.description,
        },
        participant: {
          id: session.id,
          participantId: session.participantId,
          displayName: session.displayName,
          role: session.role,
          permission: session.permission,
        },
        livekitToken,
        participantToken: participantSessionToken,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  joinSchema,
  validateInvitation,
  joinClassroom,
};
