const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const Classroom = require('../models/Classroom');
const Attendance = require('../models/Attendance');
const memoryStore = require('../store/memoryStore');
const { generateInvitationCode, hashInvitationToken } = require('../utils/tokens');
const { AppError } = require('../middlewares/errorHandler');
const { getIO } = require('../socket');

const createClassroomSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  maxParticipants: z.number().int().min(2).max(500).optional().default(50),
});

async function createClassroom(req, res, next) {
  try {
    const { name, description, maxParticipants } = req.body;
    const adminId = req.admin.id;
    const classroomId = uuidv4();

    // Generate secure invitation token
    const rawCode = generateInvitationCode();
    const tokenHash = hashInvitationToken(rawCode);

    // Create persistent classroom record in MongoDB Atlas
    const classroom = await Classroom.create({
      classroomId,
      name,
      description: description || '',
      adminId,
      tokenHash,
      status: 'ACTIVE',
      maxParticipants: maxParticipants || 50,
      createdAt: new Date(),
    });

    // Cache raw code in memory for fast student join resolution
    memoryStore.cacheCode(rawCode, classroomId, tokenHash);

    res.status(201).json({
      success: true,
      data: {
        classroom: {
          id: classroom.classroomId,
          classroomId: classroom.classroomId,
          name: classroom.name,
          description: classroom.description,
          status: classroom.status,
          maxParticipants: classroom.maxParticipants,
          invitations: [
            {
              id: classroom.classroomId,
              code: rawCode,
              isRevoked: false,
            },
          ],
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getClassrooms(req, res, next) {
  try {
    const classrooms = await Classroom.find({ adminId: req.admin.id }).sort({ createdAt: -1 });

    const formatted = classrooms.map((c) => {
      const activeSessions = memoryStore.getActiveSessionsInClassroom(c.classroomId);
      const pendingReqs = memoryStore.getPendingRequestsInClassroom(c.classroomId);

      // Find cached raw code if room is active
      let rawCode = null;
      for (const [code, val] of memoryStore.codeCache.entries()) {
        if (val.classroomId === c.classroomId) {
          rawCode = code;
          break;
        }
      }

      return {
        id: c.classroomId,
        classroomId: c.classroomId,
        name: c.name,
        description: c.description,
        status: c.status,
        createdAt: c.createdAt,
        endedAt: c.endedAt,
        isAttendanceExported: c.isAttendanceExported,
        attendanceAcknowledged: c.attendanceAcknowledged,
        invitations: rawCode ? [{ id: c.classroomId, code: rawCode, isRevoked: false }] : [],
        _count: {
          sessions: activeSessions.length,
          permissionRequests: pendingReqs.length,
        },
      };
    });

    res.json({
      success: true,
      data: { classrooms: formatted },
    });
  } catch (err) {
    next(err);
  }
}

async function getClassroomById(req, res, next) {
  try {
    const { id } = req.params;
    const classroom = await Classroom.findOne({ classroomId: id, adminId: req.admin.id });

    if (!classroom) {
      throw new AppError('Classroom not found.', 404, 'NOT_FOUND');
    }

    const activeSessions = memoryStore.getActiveSessionsInClassroom(id);
    const pendingReqs = memoryStore.getPendingRequestsInClassroom(id);

    let rawCode = null;
    for (const [code, val] of memoryStore.codeCache.entries()) {
      if (val.classroomId === id) {
        rawCode = code;
        break;
      }
    }

    res.json({
      success: true,
      data: {
        classroom: {
          id: classroom.classroomId,
          classroomId: classroom.classroomId,
          name: classroom.name,
          description: classroom.description,
          status: classroom.status,
          createdAt: classroom.createdAt,
          endedAt: classroom.endedAt,
          isAttendanceExported: classroom.isAttendanceExported,
          attendanceAcknowledged: classroom.attendanceAcknowledged,
          invitations: rawCode ? [{ id: classroom.classroomId, code: rawCode, isRevoked: false }] : [],
          sessions: activeSessions,
          permissionRequests: pendingReqs,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * End Classroom Sequence:
 * 1. Mark status as ENDING (stop accepting new participants)
 * 2. Finalize all participant attendance durations
 * 3. Mark status as ENDED
 * 4. Issue socket disconnects
 * 5. Make CSV available for download
 */
async function endClassroom(req, res, next) {
  try {
    const { id } = req.params;
    const classroom = await Classroom.findOne({ classroomId: id, adminId: req.admin.id });

    if (!classroom) {
      throw new AppError('Classroom not found.', 404, 'NOT_FOUND');
    }

    if (classroom.status === 'ENDED') {
      return res.json({
        success: true,
        message: 'Classroom already ended.',
        data: { classroom },
      });
    }

    const now = new Date();

    // 1. Mark as ENDING
    classroom.status = 'ENDING';
    await classroom.save();

    // 2. Finalize attendance for all participants who have not left yet
    const pendingAttendance = await Attendance.find({
      classroomId: id,
      leaveTime: null,
    });

    for (const rec of pendingAttendance) {
      rec.leaveTime = now;
      const joinMs = new Date(rec.joinTime).getTime();
      const duration = Math.max(0, Math.round(((now.getTime() - joinMs) / 60000) * 10) / 10);
      rec.durationMinutes = duration;
      await rec.save();
    }

    // 3. Mark as ENDED
    classroom.status = 'ENDED';
    classroom.endedAt = now;
    await classroom.save();

    // 4. Revoke raw code cache
    for (const [code, val] of memoryStore.codeCache.entries()) {
      if (val.classroomId === id) {
        memoryStore.codeCache.delete(code);
      }
    }

    // 5. Broadcast to room via Socket.IO
    const io = getIO();
    if (io) {
      io.to(`classroom:${id}`).emit('classroom:ended', {
        classroomId: id,
        message: 'The classroom has been ended by the administrator.',
      });
    }

    res.json({
      success: true,
      message: 'Classroom ended successfully. Attendance finalized and ready for export.',
      data: {
        classroom,
        attendanceReadyForDownload: true,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function createInvitation(req, res, next) {
  try {
    const { id } = req.params;
    const classroom = await Classroom.findOne({ classroomId: id, adminId: req.admin.id });
    if (!classroom) {
      throw new AppError('Classroom not found.', 404, 'NOT_FOUND');
    }
    if (classroom.status === 'ENDED') {
      throw new AppError('Cannot create invitation for ended classroom.', 400, 'BAD_REQUEST');
    }

    const rawCode = generateInvitationCode();
    const tokenHash = hashInvitationToken(rawCode);
    classroom.tokenHash = tokenHash;
    await classroom.save();

    memoryStore.cacheCode(rawCode, classroom.classroomId, tokenHash);

    res.json({
      success: true,
      message: 'New invitation link generated successfully.',
      data: {
        code: rawCode,
        classroomId: classroom.classroomId,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function revokeInvitation(req, res, next) {
  try {
    const { id } = req.params;
    const classroom = await Classroom.findOne({ classroomId: id, adminId: req.admin.id });

    if (!classroom) {
      throw new AppError('Classroom not found.', 404, 'NOT_FOUND');
    }

    // Invalidate token hash in DB
    classroom.tokenHash = 'REVOKED_' + Date.now();
    await classroom.save();

    // Delete raw code from memory cache
    for (const [code, val] of memoryStore.codeCache.entries()) {
      if (val.classroomId === id) {
        memoryStore.codeCache.delete(code);
      }
    }

    res.json({
      success: true,
      message: 'Invitation code revoked successfully.',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createClassroomSchema,
  createClassroom,
  getClassrooms,
  getClassroomById,
  endClassroom,
  createInvitation,
  revokeInvitation,
};
