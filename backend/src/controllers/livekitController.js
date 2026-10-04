const memoryStore = require('../store/memoryStore');
const { generateLiveKitToken } = require('../utils/livekit');
const { AppError } = require('../middlewares/errorHandler');

async function getClassroomToken(req, res, next) {
  try {
    const { id: classroomId } = req.params;

    const classroom = memoryStore.findClassroomById(classroomId);

    if (!classroom || classroom.status !== 'ACTIVE') {
      throw new AppError('Active classroom not found.', 404, 'NOT_FOUND');
    }

    if (req.userRole === 'ADMIN') {
      const livekitToken = await generateLiveKitToken({
        roomName: classroomId,
        participantId: `admin_${req.admin.id.slice(0, 8)}`,
        displayName: `${req.admin.username} (Teacher)`,
        isAdmin: true,
      });

      return res.json({
        success: true,
        data: {
          token: livekitToken,
          isAdmin: true,
          permissions: {
            canPublishMic: true,
            canPublishCam: true,
            canPublishScreen: true,
          },
        },
      });
    }

    // Student role
    const session = req.participant;
    if (!session) {
      throw new AppError('Participant identity missing.', 401, 'UNAUTHORIZED');
    }

    const livekitToken = await generateLiveKitToken({
      roomName: classroomId,
      participantId: session.participantId,
      displayName: session.displayName,
      isAdmin: false,
      permissions: session.permission || {
        canPublishMic: false,
        canPublishCam: false,
        canPublishScreen: false,
      },
    });

    res.json({
      success: true,
      data: {
        token: livekitToken,
        isAdmin: false,
        permissions: session.permission,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getClassroomToken,
};
