const http = require('http');
const app = require('./app');
const { initSocket } = require('./socket');
const { env } = require('./config');
const { connectDB, closeDB } = require('./db');
const { initScheduler } = require('./services/cleanupService');
const Admin = require('./models/Admin');
const { hashPassword } = require('./utils/password');
const { v4: uuidv4 } = require('uuid');

const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server, env.FRONTEND_URL);

const PORT = parseInt(env.PORT, 10) || 5000;

// Initialize default admin in MongoDB upon startup
async function initDefaultAdmin() {
  try {
    const defaultUser = 'admin';
    const defaultPass = 'OrbitAdmin2025!';
    const existing = await Admin.findOne({ username: defaultUser });
    if (!existing) {
      const passwordHash = await hashPassword(defaultPass);
      await Admin.create({
        adminId: uuidv4(),
        username: defaultUser,
        passwordHash,
      });
      console.log(`🔐 [Admin] Default administrator created: username='${defaultUser}'`);
    } else {
      console.log(`🔐 [Admin] Administrator account verified: username='${defaultUser}'`);
    }
  } catch (err) {
    console.error('❌ [Admin] Error seeding default admin:', err.message);
  }
}

async function startServer() {
  try {
    // Connect to MongoDB Atlas
    await connectDB(env.MONGODB_URI);

    // Seed default admin
    await initDefaultAdmin();

    // Start background cleanup scheduler
    initScheduler();

    server.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🪐 ClassOrbit Server running on port ${PORT}`);
      console.log(`🛡️  Environment: ${env.NODE_ENV}`);
      console.log(`🌐 Allowed Frontend: ${env.FRONTEND_URL}`);
      console.log(`🍃 Database: MongoDB Atlas Free (Target: ~100 MB / Limit: 500 MB)`);
      console.log(`🧹 Scheduled Cleanup: Daily 02:00 AM (${env.CLEANUP_TIMEZONE})`);
      console.log(`📡 Socket.IO and WebRTC services initialized`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown handling
const shutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    console.log('HTTP and WebSocket server closed.');
    await closeDB();
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
