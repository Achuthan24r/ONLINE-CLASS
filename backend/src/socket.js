const { Server } = require('socket.io');
const memoryStore = require('./store/memoryStore');
const { verifyAdminToken, verifyParticipantToken } = require('./utils/tokens');

let io = null;

function initSocket(server, frontendUrl) {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (
          !origin ||
          origin === frontendUrl ||
          origin.endsWith('.vercel.app') ||
          origin.startsWith('http://localhost:') ||
          origin.startsWith('http://127.0.0.1:')
        ) {
          callback(null, true);
        } else {
          callback(new Error('CORS origin rejected'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      const participantToken = socket.handshake.auth?.participantToken;
      const classroomId = socket.handshake.auth?.classroomId;

      if (!classroomId) {
        return next(new Error('classroomId is required'));
      }

      // Check admin auth
      if (token) {
        const adminPayload = verifyAdminToken(token);
        if (adminPayload && adminPayload.role === 'ADMIN') {
          socket.user = {
            id: adminPayload.id,
            username: adminPayload.username,
            role: 'ADMIN',
            classroomId,
          };
          return next();
        }
      }

      // Check participant auth
      if (participantToken) {
        const pPayload = verifyParticipantToken(participantToken);
        if (pPayload && pPayload.classroomId === classroomId) {
          socket.user = {
            id: pPayload.participantId,
            displayName: pPayload.displayName,
            role: 'STUDENT',
            classroomId,
          };
          return next();
        }
      }

      // Allow read-only/unauthenticated connection if validating waiting room, but mark guest
      socket.user = {
        role: 'GUEST',
        classroomId,
      };
      next();
    } catch (err) {
      next(new Error('Socket authentication error: ' + err.message));
    }
  });

  io.on('connection', (socket) => {
    const { user } = socket;
    const roomChannel = `classroom:${user.classroomId}`;
    socket.join(roomChannel);

    console.log(`🔌 [Socket.IO] Connected: ${user.role} (${user.id || 'guest'}) joined ${roomChannel}`);

    // If student connected, announce state
    if (user.role === 'STUDENT') {
      socket.to(roomChannel).emit('participant:connected', {
        participantId: user.id,
        displayName: user.displayName,
      });
    }

    // Classroom Chat / Real-time Message
    socket.on('chat:message', async (data) => {
      if (!user.id) return;
      io.to(roomChannel).emit('chat:received', {
        id: Math.random().toString(36).substring(2, 9),
        senderId: user.id,
        senderName: user.displayName || user.username || 'User',
        senderRole: user.role,
        text: String(data.text || '').slice(0, 500),
        timestamp: new Date().toISOString(),
      });
    });

    // WebRTC Peer Signal relay fallback (for local peer-to-peer demo when LiveKit cloud is not attached)
    socket.on('signal:offer', (data) => {
      socket.to(roomChannel).emit('signal:offer', {
        from: user.id,
        offer: data.offer,
      });
    });

    socket.on('signal:answer', (data) => {
      socket.to(roomChannel).emit('signal:answer', {
        from: user.id,
        answer: data.answer,
      });
    });

    socket.on('signal:candidate', (data) => {
      socket.to(roomChannel).emit('signal:candidate', {
        from: user.id,
        candidate: data.candidate,
      });
    });

    // Participant deliberate mute / unmute announcement
    socket.on('media:state-change', (data) => {
      socket.to(roomChannel).emit('media:state-change', {
        participantId: user.id,
        micActive: !!data.micActive,
        camActive: !!data.camActive,
        screenActive: !!data.screenActive,
      });
    });

    socket.on('disconnect', async () => {
      console.log(`❌ [Socket.IO] Disconnected: ${user.role} (${user.id || 'guest'}) from ${roomChannel}`);
      if (user.role === 'STUDENT' && user.id) {
        socket.to(roomChannel).emit('participant:left', {
          participantId: user.id,
        });

        // Update participant session status in memory store
        try {
          memoryStore.updateParticipantSession(user.id, {
            status: 'DISCONNECTED',
            leftAt: new Date(),
          });
        } catch (e) {
          // Ignore background update errors on disconnect
        }
      }
    });
  });

  return io;
}

function getIO() {
  return io;
}

module.exports = {
  initSocket,
  getIO,
};
