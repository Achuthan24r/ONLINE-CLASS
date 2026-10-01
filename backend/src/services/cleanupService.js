const cron = require('node-cron');
const Classroom = require('../models/Classroom');
const Attendance = require('../models/Attendance');
const memoryStore = require('../store/memoryStore');
const { env } = require('../config');

/**
 * Cleanup Service for MongoDB Atlas and Ephemeral Memory
 * Strictly adheres to rule:
 * "Never delete attendance data that has not been exported and acknowledged."
 */
async function runCleanup() {
  const startTime = Date.now();
  console.log(`🧹 [Cleanup] Starting scheduled maintenance task (Timezone: ${env.CLEANUP_TIMEZONE})...`);

  let expiredClassroomsDeleted = 0;
  let acknowledgedAttendanceDeleted = 0;
  let inMemoryRoomsCleared = 0;

  try {
    const now = new Date();

    // 1. Find classrooms that have ended, their attendance has been exported AND acknowledged, older than 24 hours
    const oldAcknowledgedClasses = await Classroom.find({
      status: 'ENDED',
      attendanceAcknowledged: true,
      endedAt: { $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    });

    const classIdsToDelete = oldAcknowledgedClasses.map((c) => c.classroomId);

    if (classIdsToDelete.length > 0) {
      // Delete acknowledged attendance for these classes
      const attResult = await Attendance.deleteMany({
        classroomId: { $in: classIdsToDelete },
        acknowledged: true,
      });
      acknowledgedAttendanceDeleted = attResult.deletedCount || 0;

      // Delete the classrooms themselves
      const classResult = await Classroom.deleteMany({
        classroomId: { $in: classIdsToDelete },
      });
      expiredClassroomsDeleted = classResult.deletedCount || 0;

      // Clear any remaining in-memory ephemeral state
      for (const id of classIdsToDelete) {
        memoryStore.clearClassroomEphemeralState(id);
        inMemoryRoomsCleared++;
      }
    }

    // 2. Clear abandoned in-memory rooms that are ended in DB
    for (const [classroomId] of memoryStore.classroomSessions.entries()) {
      const cls = await Classroom.findOne({ classroomId }).select('status');
      if (!cls || cls.status === 'ENDED') {
        memoryStore.clearClassroomEphemeralState(classroomId);
        inMemoryRoomsCleared++;
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(
      `✅ [Cleanup Completed in ${durationMs}ms] ` +
      `Deleted ${expiredClassroomsDeleted} expired classrooms, ` +
      `purged ${acknowledgedAttendanceDeleted} acknowledged attendance records, ` +
      `cleared ${inMemoryRoomsCleared} in-memory room caches.`
    );

    return {
      success: true,
      durationMs,
      expiredClassroomsDeleted,
      acknowledgedAttendanceDeleted,
      inMemoryRoomsCleared,
      timestamp: now.toISOString(),
    };
  } catch (err) {
    console.error('❌ [Cleanup Error]:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

function initScheduler() {
  const tz = env.CLEANUP_TIMEZONE || 'Asia/Kolkata';
  // Runs daily at 02:00 AM in the configured timezone
  cron.schedule(
    '0 2 * * *',
    async () => {
      console.log(`⏰ [Cron] Daily maintenance triggered at 02:00 AM (${tz})`);
      await runCleanup();
    },
    {
      timezone: tz,
    }
  );
  console.log(`⏰ [Scheduler] Configured daily cleanup cron at 02:00 AM (${tz})`);
}

module.exports = {
  runCleanup,
  initScheduler,
};
