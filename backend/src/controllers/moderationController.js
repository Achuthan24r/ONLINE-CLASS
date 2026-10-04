const memoryStore = require('../store/memoryStore');
const { removeLiveKitParticipant } = require('../utils/livekit');
const { AppError } = require('../middlewares/errorHandler');
const { getIO } = require('../socket');

async function removeParticipant(req, res, next) {
  try {
    const { id: classroomId, participantId } = req.params;
    const adminId = req.admin.id;

    const session = memoryStore.findParticipantSessionByParticipantId(participantId);

    if (!session || session.classroomId !== classroomId) {
      throw new AppError('Participant not found in this classroom.', 404, 'NOT_FOUND');
    }

    // Update status to REMOVED
    memoryStore.updateParticipantSession(participantId, {
      status: 'REMOVED',
      leftAt: new Date(),
    });

    // Remove from LiveKit room
    await removeLiveKitParticipant(classroomId, participantId);

    // Audit log
    memoryStore.createAuditLog({
      classroomId,
      adminId,
      action: 'PARTICIPANT_REMOVED',
      targetParticipantId: participantId,
      details: JSON.stringify({ displayName: session.displayName }),
    });

    // Notify via Socket.IO
    const io = getIO();
    if (io) {
      io.to(`classroom:${classroomId}`).emit('participant:removed', {
        participantId,
        displayName: session.displayName,
        message: 'You have been removed from the classroom by the administrator.',
      });
    }

    res.json({
      success: true,
      message: `Participant ${session.displayName} removed from classroom.`,
    });
  } catch (err) {
    next(err);
  }
}

async function getAuditLogs(req, res, next) {
  try {
    const { id: classroomId } = req.params;

    const classroom = memoryStore.findClassroomById(classroomId, req.admin.id);

    if (!classroom) {
      throw new AppError('Classroom not found.', 404, 'NOT_FOUND');
    }

    const logs = memoryStore.findAuditLogs(classroomId);

    res.json({
      success: true,
      data: { logs },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  removeParticipant,
  getAuditLogs,
};
