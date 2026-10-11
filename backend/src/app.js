const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { env } = require('./config');
const { errorHandler, AppError } = require('./middlewares/errorHandler');
const { requireAdmin, requireParticipantOrAdmin } = require('./middlewares/authMiddleware');
const { validate } = require('./middlewares/validationMiddleware');
const { authLimiter, publicLimiter } = require('./middlewares/rateLimiter');

// Controllers
const authController = require('./controllers/authController');
const classroomController = require('./controllers/classroomController');
const participantController = require('./controllers/participantController');
const permissionController = require('./controllers/permissionController');
const livekitController = require('./controllers/livekitController');
const moderationController = require('./controllers/moderationController');
const attendanceController = require('./controllers/attendanceController');
const maintenanceController = require('./controllers/maintenanceController');
const invitationController = require('./controllers/invitationController');

const app = express();

// Security HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
}));

// CORS Configuration
const allowedOrigins = [
  env.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:')
    ) {
      callback(null, true);
    } else {
      callback(new AppError('Blocked by CORS policy', 403, 'CORS_ERROR'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-participant-token'],
}));

// Body parsers with safe size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ClassOrbit API',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// ==========================================
// 1. Admin Routes (/api/admin/* and /api/auth/*)
// ==========================================
const adminRouter = express.Router();
adminRouter.post('/login', authLimiter, validate(authController.loginSchema), authController.login);
adminRouter.post('/logout', authController.logout);
adminRouter.get('/me', requireAdmin, authController.getMe);
adminRouter.get('/storage-status', requireAdmin, maintenanceController.getStorageStatus);
adminRouter.post('/cleanup', requireAdmin, maintenanceController.triggerCleanup);

// Mount under /api/admin
app.use('/api/admin', adminRouter);

// Mount auth alias under /api/auth for frontend backward compatibility
const authRouter = express.Router();
authRouter.post('/login', authLimiter, validate(authController.loginSchema), authController.login);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', requireAdmin, authController.getMe);
authRouter.post('/bootstrap', authLimiter, validate(authController.bootstrapSchema), authController.bootstrap);
app.use('/api/auth', authRouter);

// ==========================================
// 2. Attendance Daily Export (/api/attendance/daily.csv)
// ==========================================
const dailyAttendanceRouter = express.Router();
dailyAttendanceRouter.get('/daily.csv', requireAdmin, attendanceController.downloadDailyCSV);
app.use('/api/attendance', dailyAttendanceRouter);

// ==========================================
// 3. Invitation Routes (/api/invitations/*)
// ==========================================
const invitationRouter = express.Router();
invitationRouter.get('/validate/:code', publicLimiter, participantController.validateInvitation);
invitationRouter.post('/join', publicLimiter, validate(participantController.joinSchema), participantController.joinClassroom);
app.use('/api/invitations', invitationRouter);

// ==========================================
// 4. Classroom Routes (/api/classrooms/*)
// ==========================================
const classroomRouter = express.Router();

// Core classroom management
classroomRouter.post('/', requireAdmin, validate(classroomController.createClassroomSchema), classroomController.createClassroom);
classroomRouter.get('/', requireAdmin, classroomController.getClassrooms);
classroomRouter.get('/:id', requireAdmin, classroomController.getClassroomById);
classroomRouter.post('/:id/end', requireAdmin, classroomController.endClassroom);
classroomRouter.post('/:id/invite', requireAdmin, classroomController.createInvitation);
classroomRouter.post('/:id/invitations/:inviteId/revoke', requireAdmin, classroomController.revokeInvitation);

// Participant Join / Leave / List / Remove
classroomRouter.post('/:id/join', publicLimiter, validate(participantController.joinSchema), participantController.joinClassroom);
classroomRouter.post('/:id/leave', publicLimiter, participantController.leaveClassroom);
classroomRouter.get('/:id/participants', requireParticipantOrAdmin, participantController.getParticipants);
classroomRouter.delete('/:id/participants/:participantId', requireAdmin, participantController.removeParticipant);
classroomRouter.post('/:id/participants/:participantId/remove', requireAdmin, participantController.removeParticipant); // backward-compat

// WebRTC LiveKit Token
classroomRouter.get('/:id/token', requireParticipantOrAdmin, livekitController.getClassroomToken);

// Permission Requests (Section 9 exact endpoints)
classroomRouter.post('/:id/permission-requests', publicLimiter, validate(permissionController.requestPermissionSchema), permissionController.requestPermission);
classroomRouter.get('/:id/permission-requests', requireAdmin, permissionController.getPermissionRequests);
classroomRouter.post('/:id/permission-requests/:requestId/approve', requireAdmin, permissionController.approveRequest);
classroomRouter.post('/:id/permission-requests/:requestId/reject', requireAdmin, permissionController.rejectRequest);
classroomRouter.post('/:id/permission-requests/:requestId/revoke', requireAdmin, permissionController.revokeRequest);

// Backward-compatible permission endpoints
classroomRouter.post('/:id/permissions/request', publicLimiter, validate(permissionController.requestPermissionSchema), permissionController.requestPermission);
classroomRouter.post('/:id/permissions/review', requireAdmin, validate(permissionController.reviewPermissionSchema), permissionController.legacyReviewPermission);
classroomRouter.post('/:id/permissions/revoke', requireAdmin, validate(permissionController.revokePermissionSchema), permissionController.revokePermission);
classroomRouter.post('/:id/participants/:participantId/revoke-permission', requireAdmin, permissionController.revokePermission);

// Attendance Endpoints
classroomRouter.get('/:id/attendance.csv', requireAdmin, attendanceController.downloadClassroomCSV);
classroomRouter.post('/:id/attendance/acknowledge', requireAdmin, attendanceController.acknowledgeAttendanceDownload);
classroomRouter.post('/:id/attendance', publicLimiter, validate(attendanceController.markAttendanceSchema), attendanceController.markAttendance);
classroomRouter.get('/:id/attendance', requireParticipantOrAdmin, attendanceController.getAttendance);
classroomRouter.patch('/:id/attendance/:attendanceId', requireAdmin, validate(attendanceController.updateAttendanceSchema), attendanceController.updateAttendance);

// Moderation & Audit Logs
classroomRouter.get('/:id/audit-logs', requireAdmin, moderationController.getAuditLogs);

app.use('/api/classrooms', classroomRouter);

// 404 Handler
app.use((req, res, next) => {
  next(new AppError(`Endpoint not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
});

// Centralized Error Handling
app.use(errorHandler);

module.exports = app;
