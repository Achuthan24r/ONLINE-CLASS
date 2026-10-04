const { z } = require('zod');
const Attendance = require('../models/Attendance');
const Classroom = require('../models/Classroom');
const memoryStore = require('../store/memoryStore');
const { generateAttendanceCSV, generateSafeCSVFilename } = require('../utils/csv');
const { AppError } = require('../middlewares/errorHandler');
const { getIO } = require('../socket');

const markAttendanceSchema = z.object({
  participantId: z.string().min(5),
  studentName: z.string().min(2).max(100),
  mobileNumber: z.string().regex(/^[0-9+\s\-()]{7,20}$/, 'Please provide a valid mobile number').optional().or(z.literal('')),
});

const updateAttendanceSchema = z.object({
  status: z.enum(['PRESENT', 'LATE', 'ABSENT', 'EXCUSED']).optional(),
  studentName: z.string().min(2).max(100).optional(),
  mobileNumber: z.string().optional(),
});

/**
 * Student self-marking endpoint
 * Enforces rule: "A single person can attend only one thing"
 */
async function markAttendance(req, res, next) {
  try {
    const { id: classroomId } = req.params;
    const { participantId, studentName, mobileNumber } = req.body;

    const classroom = await Classroom.findOne({ classroomId });
    if (!classroom || classroom.status === 'ENDED') {
      throw new AppError('Active classroom not found.', 404, 'NOT_FOUND');
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    // Check if already attended
    const existing = await Attendance.findOne({ classroomId, participantId });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'ALREADY_MARKED',
          message: 'Attendance has already been recorded for this student. Only one attendance record is permitted per class.',
        },
        data: { record: existing },
      });
    }

    const now = new Date();
    const record = await Attendance.create({
      classroomId,
      classroomName: classroom.name,
      participantId,
      studentName: studentName.trim(),
      mobileNumber: (mobileNumber || '').trim(),
      joinTime: now,
      classDate: todayStr,
      status: 'PRESENT',
    });

    // Notify room via Socket.IO
    const io = getIO();
    if (io) {
      io.to(`classroom:${classroomId}`).emit('attendance:marked', {
        record,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Attendance marked as Present.',
      data: { record },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get classroom attendance register
 */
async function getAttendance(req, res, next) {
  try {
    const { id: classroomId } = req.params;
    const records = await Attendance.find({ classroomId }).sort({ createdAt: -1 });

    let myRecord = null;
    if (req.participant) {
      myRecord = records.find((r) => r.participantId === req.participant.participantId) || null;
    }

    res.json({
      success: true,
      data: {
        records,
        totalMarked: records.length,
        myRecord,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin updates or modifies attendance record
 */
async function updateAttendance(req, res, next) {
  try {
    const { id: classroomId, attendanceId } = req.params;
    const adminId = req.admin.id;

    const classroom = await Classroom.findOne({ classroomId, adminId });
    if (!classroom) {
      throw new AppError('Classroom not found or unauthorized.', 404, 'NOT_FOUND');
    }

    const record = await Attendance.findById(attendanceId);
    if (!record || record.classroomId !== classroomId) {
      throw new AppError('Attendance record not found.', 404, 'NOT_FOUND');
    }

    if (req.body.status) record.status = req.body.status;
    if (req.body.studentName) record.studentName = req.body.studentName.trim();
    if (req.body.mobileNumber !== undefined) record.mobileNumber = req.body.mobileNumber.trim();
    await record.save();

    // Broadcast update
    const io = getIO();
    if (io) {
      io.to(`classroom:${classroomId}`).emit('attendance:updated', {
        record,
      });
    }

    res.json({
      success: true,
      message: 'Attendance record modified by administrator.',
      data: { record },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Export Classroom Attendance as CSV (GET /api/classrooms/:id/attendance.csv)
 * Authenticated Admin Only
 */
async function downloadClassroomCSV(req, res, next) {
  try {
    const { id: classroomId } = req.params;
    const adminId = req.admin.id;

    const classroom = await Classroom.findOne({ classroomId, adminId });
    if (!classroom) {
      throw new AppError('Classroom not found.', 404, 'NOT_FOUND');
    }

    const records = await Attendance.find({ classroomId }).sort({ joinTime: 1 });

    // Mark as exported
    classroom.isAttendanceExported = true;
    classroom.attendanceExportedAt = new Date();
    await classroom.save();

    await Attendance.updateMany({ classroomId }, { exported: true });

    const csvContent = generateAttendanceCSV(records);
    const dateStr = classroom.endedAt
      ? new Date(classroom.endedAt).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const filename = generateSafeCSVFilename(classroom.name, dateStr);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
}

/**
 * Admin acknowledges successful download (POST /api/classrooms/:id/attendance/acknowledge)
 * Triggers safe cleanup of temporary in-memory state!
 */
async function acknowledgeAttendanceDownload(req, res, next) {
  try {
    const { id: classroomId } = req.params;
    const adminId = req.admin.id;

    const classroom = await Classroom.findOne({ classroomId, adminId });
    if (!classroom) {
      throw new AppError('Classroom not found.', 404, 'NOT_FOUND');
    }

    classroom.attendanceAcknowledged = true;
    classroom.attendanceAcknowledgedAt = new Date();
    await classroom.save();

    await Attendance.updateMany({ classroomId }, { acknowledged: true });

    // Safely clear in-memory room sessions, temporary permissions and tokens
    memoryStore.clearClassroomEphemeralState(classroomId);

    res.json({
      success: true,
      message: 'Attendance export acknowledged. Temporary in-memory state cleared safely.',
      data: {
        classroomId,
        attendanceAcknowledged: true,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Combined Daily Attendance CSV (GET /api/attendance/daily.csv)
 * Authenticated Admin Only
 */
async function downloadDailyCSV(req, res, next) {
  try {
    const adminId = req.admin.id;
    const targetDate = req.query.date || new Date().toISOString().slice(0, 10);

    // Find classrooms managed by this admin
    const adminClassrooms = await Classroom.find({ adminId }).select('classroomId');
    const classIds = adminClassrooms.map((c) => c.classroomId);

    const records = await Attendance.find({
      classroomId: { $in: classIds },
      classDate: targetDate,
    }).sort({ classroomName: 1, joinTime: 1 });

    const csvContent = generateAttendanceCSV(records);
    const filename = `daily_attendance_${targetDate}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  markAttendanceSchema,
  updateAttendanceSchema,
  markAttendance,
  getAttendance,
  updateAttendance,
  downloadClassroomCSV,
  acknowledgeAttendanceDownload,
  downloadDailyCSV,
};
