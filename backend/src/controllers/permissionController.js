const { z } = require('zod');
const Classroom = require('../models/Classroom');
const memoryStore = require('../store/memoryStore');
const { updateLiveKitParticipantPermissions, generateLiveKitToken } = require('../utils/livekit');
const { AppError } = require('../middlewares/errorHandler');
const { getIO } = require('../socket');

const requestPermissionSchema = z.object({
  mediaType: z.enum(['MIC', 'CAM', 'SCREEN']),
  participantId: z.string().min(5),
});

const reviewPermissionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']).optional(),
});

const revokePermissionSchema = z.object({
  mediaType: z.enum(['MIC', 'CAM', 'SCREEN']),
});

/**
 * Student requests media capability (POST /api/classrooms/:id/permission-requests)
 */
async function requestPermission(req, res, next) {
  try {
    const { id: classroomId } = req.params;
    const { mediaType, participantId } = req.body;

    const classroom = await Classroom.findOne({ classroomId, status: 'ACTIVE' });
    if (!classroom) {
      throw new AppError('Active classroom not found.', 404, 'NOT_FOUND');
    }

    const session = memoryStore.getActiveSession(participantId);
    if (!session || session.classroomId !== classroomId) {
      throw new AppError('Participant session not active in this classroom.', 403, 'FORBIDDEN');
    }

    const currentPerm = memoryStore.getPermissions(participantId);
    if (
      (mediaType === 'MIC' && currentPerm.canPublishMic) ||
      (mediaType === 'CAM' && currentPerm.canPublishCam) ||
      (mediaType === 'SCREEN' && currentPerm.canPublishScreen)
    ) {
      return res.json({
        success: true,
        message: `${mediaType} access is already granted.`,
        data: { alreadyGranted: true },
      });
    }

    // Create or find pending in-memory request
    const pendingList = memoryStore.getPendingRequestsInClassroom(classroomId);
    let permRequest = pendingList.find(
      (r) => r.participantId === participantId && r.mediaType === mediaType
    );

    if (!permRequest) {
      permRequest = memoryStore.createPermissionRequest({
        classroomId,
        participantId,
        displayName: session.displayName,
        mediaType,
      });
    }

    // Broadcast to instructor via Socket.IO
    const io = getIO();
    if (io) {
      io.to(`classroom:${classroomId}`).emit('permission:requested', {
        request: permRequest,
      });
    }

    res.json({
      success: true,
      message: `${mediaType} permission requested. Awaiting administrator approval.`,
      data: { request: permRequest },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get pending requests in classroom (GET /api/classrooms/:id/permission-requests)
 */
async function getPermissionRequests(req, res, next) {
  try {
    const { id: classroomId } = req.params;
    const requests = memoryStore.getPendingRequestsInClassroom(classroomId);

    res.json({
      success: true,
      data: { requests },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin approves request (POST /api/classrooms/:id/permission-requests/:requestId/approve)
 */
async function approveRequest(req, res, next) {
  try {
    const { id: classroomId, requestId } = req.params;
    const adminId = req.admin.id;

    const classroom = await Classroom.findOne({ classroomId, adminId });
    if (!classroom) {
      throw new AppError('Classroom not found or unauthorized.', 404, 'NOT_FOUND');
    }

    const permRequest = memoryStore.getPermissionRequest(requestId);
    if (!permRequest || permRequest.classroomId !== classroomId) {
      throw new AppError('Permission request not found.', 404, 'NOT_FOUND');
    }

    permRequest.status = 'APPROVED';

    const { participantId, mediaType, displayName } = permRequest;
    const updateData = {};
    if (mediaType === 'MIC') updateData.canPublishMic = true;
    if (mediaType === 'CAM') updateData.canPublishCam = true;
    if (mediaType === 'SCREEN') updateData.canPublishScreen = true;

    const updatedPerm = memoryStore.updatePermissions(participantId, updateData);

    // Update LiveKit server-side permissions
    await updateLiveKitParticipantPermissions(classroomId, participantId, updatedPerm);

    // Refreshed token
    const freshLiveKitToken = await generateLiveKitToken({
      roomName: classroomId,
      participantId,
      displayName,
      isAdmin: false,
      permissions: updatedPerm,
    });

    // Notify classroom and student via Socket.IO
    const io = getIO();
    if (io) {
      io.to(`classroom:${classroomId}`).emit('permission:reviewed', {
        requestId,
        participantId,
        mediaType,
        action: 'APPROVE',
        permission: updatedPerm,
        livekitToken: freshLiveKitToken,
      });
    }

    res.json({
      success: true,
      message: `${mediaType} permission approved.`,
      data: {
        request: permRequest,
        permission: updatedPerm,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin rejects request (POST /api/classrooms/:id/permission-requests/:requestId/reject)
 */
async function rejectRequest(req, res, next) {
  try {
    const { id: classroomId, requestId } = req.params;
    const adminId = req.admin.id;

    const classroom = await Classroom.findOne({ classroomId, adminId });
    if (!classroom) {
      throw new AppError('Classroom not found or unauthorized.', 404, 'NOT_FOUND');
    }

    const permRequest = memoryStore.getPermissionRequest(requestId);
    if (!permRequest || permRequest.classroomId !== classroomId) {
      throw new AppError('Permission request not found.', 404, 'NOT_FOUND');
    }

    permRequest.status = 'REJECTED';

    const io = getIO();
    if (io) {
      io.to(`classroom:${classroomId}`).emit('permission:reviewed', {
        requestId,
        participantId: permRequest.participantId,
        mediaType: permRequest.mediaType,
        action: 'REJECT',
        permission: memoryStore.getPermissions(permRequest.participantId),
      });
    }

    res.json({
      success: true,
      message: `${permRequest.mediaType} permission request rejected.`,
      data: { request: permRequest },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin revokes permission (POST /api/classrooms/:id/participants/:participantId/revoke-permission)
 */
async function revokePermission(req, res, next) {
  try {
    const { id: classroomId, participantId } = req.params;
    const mediaType = req.body.mediaType;
    const adminId = req.admin.id;

    const classroom = await Classroom.findOne({ classroomId, adminId });
    if (!classroom) {
      throw new AppError('Classroom not found or unauthorized.', 404, 'NOT_FOUND');
    }

    const updateData = {};
    if (mediaType === 'MIC') updateData.canPublishMic = false;
    if (mediaType === 'CAM') updateData.canPublishCam = false;
    if (mediaType === 'SCREEN') updateData.canPublishScreen = false;

    const updatedPerm = memoryStore.updatePermissions(participantId, updateData);
    memoryStore.revokePermissionRequests(classroomId, participantId, mediaType);

    // Update LiveKit server
    await updateLiveKitParticipantPermissions(classroomId, participantId, updatedPerm);

    const session = memoryStore.getActiveSession(participantId);
    const freshLiveKitToken = await generateLiveKitToken({
      roomName: classroomId,
      participantId,
      displayName: session?.displayName || 'Student',
      isAdmin: false,
      permissions: updatedPerm,
    });

    const io = getIO();
    if (io) {
      io.to(`classroom:${classroomId}`).emit('permission:revoked', {
        participantId,
        mediaType,
        permission: updatedPerm,
        livekitToken: freshLiveKitToken,
      });
    }

    res.json({
      success: true,
      message: `${mediaType} permission revoked.`,
      data: { permission: updatedPerm },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin revokes permission via request ID (POST /api/classrooms/:id/permission-requests/:requestId/revoke)
 */
async function revokeRequest(req, res, next) {
  try {
    const { id: classroomId, requestId } = req.params;
    const adminId = req.admin.id;

    const classroom = await Classroom.findOne({ classroomId, adminId });
    if (!classroom) {
      throw new AppError('Classroom not found or unauthorized.', 404, 'NOT_FOUND');
    }

    const permRequest = memoryStore.getPermissionRequest(requestId);
    if (!permRequest || permRequest.classroomId !== classroomId) {
      throw new AppError('Permission request not found.', 404, 'NOT_FOUND');
    }

    permRequest.status = 'REVOKED';
    const { participantId, mediaType, displayName } = permRequest;
    const updateData = {};
    if (mediaType === 'MIC') updateData.canPublishMic = false;
    if (mediaType === 'CAM') updateData.canPublishCam = false;
    if (mediaType === 'SCREEN') updateData.canPublishScreen = false;

    const updatedPerm = memoryStore.updatePermissions(participantId, updateData);
    memoryStore.revokePermissionRequests(classroomId, participantId, mediaType);

    await updateLiveKitParticipantPermissions(classroomId, participantId, updatedPerm);

    const session = memoryStore.getActiveSession(participantId);
    const freshLiveKitToken = await generateLiveKitToken({
      roomName: classroomId,
      participantId,
      displayName: session?.displayName || displayName || 'Student',
      isAdmin: false,
      permissions: updatedPerm,
    });

    const io = getIO();
    if (io) {
      io.to(`classroom:${classroomId}`).emit('permission:revoked', {
        requestId,
        participantId,
        mediaType,
        permission: updatedPerm,
        livekitToken: freshLiveKitToken,
      });
    }

    res.json({
      success: true,
      message: `${mediaType} permission revoked.`,
      data: { request: permRequest, permission: updatedPerm },
    });
  } catch (err) {
    next(err);
  }
}

// Backward-compatible review handler
async function legacyReviewPermission(req, res, next) {
  if (req.body.action === 'APPROVE') {
    req.params.requestId = req.body.requestId;
    return approveRequest(req, res, next);
  } else {
    req.params.requestId = req.body.requestId;
    return rejectRequest(req, res, next);
  }
}

module.exports = {
  requestPermissionSchema,
  reviewPermissionSchema,
  revokePermissionSchema,
  requestPermission,
  getPermissionRequests,
  approveRequest,
  rejectRequest,
  revokeRequest,
  revokePermission,
  legacyReviewPermission,
};
