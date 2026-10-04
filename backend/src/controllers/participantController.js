const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const Classroom = require('../models/Classroom');
const Attendance = require('../models/Attendance');
const memoryStore = require('../store/memoryStore');
const { hashInvitationToken, signParticipantToken } = require('../utils/tokens');
const { generateLiveKitToken, removeLiveKitParticipant } = require('../utils/livekit');
const { AppError } = require('../middlewares/errorHandler');
const { getIO } = require('../socket');

const joinSchema = z.object({
  code: z.string().min(5),
  displayName: z.string().min(1).max(50),
});

/**
 * Public validation of invitation code
 */
async function validateInvitation(req, res, next) {
  try {
    const { code } = req.params;
    const tokenHash = hashInvitationToken(code);

    const classroom = await Classroom.findOne({
      tokenHash,
      status: 'ACTIVE',
    });

    if (!classroom) {
      throw new AppError('Invitation code is invalid, expired, or classroom has ended.', 404, 'NOT_FOUND');
    }

    const activeCount = memoryStore.getActiveSessionsInClassroom(classroom.classroomId).length;
    if (activeCount >= classroom.maxParticipants) {
      throw new AppError('Classroom has reached maximum participant capacity.', 429, 'CAPACITY_REACHED');
    }

    res.json({
      success: true,
      data: {
        valid: true,
        classroom: {
          id: classroom.classroomId,
          name: classroom.name,
          description: classroom.description,
          status: classroom.status,
        },
        maxParticipants: classroom.maxParticipants,
        currentParticipants: activeCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Student joins classroom (POST /api/classrooms/:id/join)
 */
async function joinClassroom(req, res, next) {
  try {
    const { id: classroomId } = req.params;
    const { code, displayName } = req.body;
    const tokenHash = hashInvitationToken(code);

    const classroom = await Classroom.findOne({
      classroomId,
      tokenHash,
      status: 'ACTIVE',
    });

    if (!classroom) {
      throw new AppError('Invalid invitation code or classroom is no longer active.', 400, 'INVALID_INVITATION');
    }

    const activeSessions = memoryStore.getActiveSessionsInClassroom(classroomId);
    if (activeSessions.length >= classroom.maxParticipants) {
      throw new AppError('Classroom is currently at full capacity.', 429, 'ROOM_FULL');
    }

    // Generate opaque participant ID
    const participantId = `stu_${uuidv4().replace(/-/g, '').slice(0, 12)}`;

    // Create in-memory live session
    const session = memoryStore.createActiveSession({
      classroomId,
      participantId,
      displayName: displayName.trim(),
      role: 'STUDENT',
    });

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    // Track or initialize Attendance record in MongoDB
    let attRecord = await Attendance.findOne({ classroomId, participantId });
    if (!attRecord) {
      attRecord = await Attendance.create({
        classroomId,
        classroomName: classroom.name,
        participantId,
        studentName: displayName.trim(),
        joinTime: now,
        classDate: todayStr,
        status: 'PRESENT',
      });
    }

    // Restricted LiveKit token (strictly disabled by default)
    const livekitToken = await generateLiveKitToken({
      roomName: classroomId,
      participantId,
      displayName: displayName.trim(),
      isAdmin: false,
      permissions: {
        canPublishMic: false,
        canPublishCam: false,
        canPublishScreen: false,
      },
    });

    // Session JWT for client
    const participantToken = signParticipantToken({
      participantId,
      classroomId,
      displayName: displayName.trim(),
      role: 'STUDENT',
    });

    // Notify room via Socket.IO
    const io = getIO();
    if (io) {
      io.to(`classroom:${classroomId}`).emit('participant:joined', {
        participant: {
          participantId: session.participantId,
          displayName: session.displayName,
          role: session.role,
          permission: memoryStore.getPermissions(participantId),
        },
      });
    }

    res.status(201).json({
      success: true,
      data: {
        classroom: {
          id: classroom.classroomId,
          name: classroom.name,
          description: classroom.description,
        },
        participant: {
          participantId: session.participantId,
          displayName: session.displayName,
          role: session.role,
          permission: memoryStore.getPermissions(participantId),
        },
        livekitToken,
        participantToken,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Student leaves classroom (POST /api/classrooms/:id/leave)
 */
async function leaveClassroom(req, res, next) {
  try {
    const { id: classroomId } = req.params;
    const participantId = req.participant?.participantId || req.body.participantId;

    if (!participantId) {
      throw new AppError('Participant identity required.', 400, 'BAD_REQUEST');
    }

    const now = new Date();
    // Update Attendance leaveTime and duration
    const attRecord = await Attendance.findOne({ classroomId, participantId });
    if (attRecord && !attRecord.leaveTime) {
      attRecord.leaveTime = now;
      const joinMs = new Date(attRecord.joinTime).getTime();
      attRecord.durationMinutes = Math.max(0, Math.round(((now.getTime() - joinMs) / 60000) * 10) / 10);
      await attRecord.save();
    }

    // Remove from in-memory active session
    memoryStore.removeActiveSession(participantId);

    // Notify room via Socket.IO
    const io = getIO();
    if (io) {
      io.to(`classroom:${classroomId}`).emit('participant:left', {
        participantId,
      });
    }

    res.json({
      success: true,
      message: 'Participant left classroom successfully.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get active participants (GET /api/classrooms/:id/participants)
 */
async function getParticipants(req, res, next) {
  try {
    const { id: classroomId } = req.params;
    const participants = memoryStore.getActiveSessionsInClassroom(classroomId);

    res.json({
      success: true,
      data: {
        participants,
        count: participants.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin removes participant (DELETE /api/classrooms/:id/participants/:participantId)
 */
async function removeParticipant(req, res, next) {
  try {
    const { id: classroomId, participantId } = req.params;
    const adminId = req.admin.id;

    const classroom = await Classroom.findOne({ classroomId, adminId });
    if (!classroom) {
      throw new AppError('Classroom not found or unauthorized.', 404, 'NOT_FOUND');
    }

    const session = memoryStore.getActiveSession(participantId);
    const now = new Date();

    // Finalize attendance leave time
    const attRecord = await Attendance.findOne({ classroomId, participantId });
    if (attRecord && !attRecord.leaveTime) {
      attRecord.leaveTime = now;
      const joinMs = new Date(attRecord.joinTime).getTime();
      attRecord.durationMinutes = Math.max(0, Math.round(((now.getTime() - joinMs) / 60000) * 10) / 10);
      await attRecord.save();
    }

    // Remove session
    memoryStore.removeActiveSession(participantId);

    // Remove from LiveKit room
    await removeLiveKitParticipant(classroomId, participantId);

    // Broadcast removal
    const io = getIO();
    if (io) {
      io.to(`classroom:${classroomId}`).emit('participant:removed', {
        participantId,
        displayName: session?.displayName || 'Participant',
        message: 'You have been removed from the classroom by the administrator.',
      });
    }

    res.json({
      success: true,
      message: `Participant removed from classroom.`,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  joinSchema,
  validateInvitation,
  joinClassroom,
  leaveClassroom,
  getParticipants,
  removeParticipant,
};
