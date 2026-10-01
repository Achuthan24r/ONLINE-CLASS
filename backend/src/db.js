const mongoose = require('mongoose');
const dns = require('dns');

// On Windows or environments where the default DNS resolver fails on SRV lookups,
// configure reliable public DNS servers for MongoDB Atlas SRV resolution
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore if not permitted
}

let isConnecting = false;

async function connectDB(uri, maxRetries = 5, retryDelayMs = 3000) {
  if (!uri) {
    throw new Error('MONGODB_URI is required for database connection.');
  }

  mongoose.connection.on('connected', () => {
    console.log('🍃 [MongoDB Atlas] Connected successfully to cluster');
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ [MongoDB Atlas] Connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ [MongoDB Atlas] Connection disconnected');
  });

  let retries = 0;
  while (retries < maxRetries) {
    try {
      isConnecting = true;
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        minPoolSize: 2,
      });
      isConnecting = false;
      return mongoose.connection;
    } catch (err) {
      retries++;
      console.error(`❌ [MongoDB Atlas] Connection attempt ${retries}/${maxRetries} failed: ${err.message}`);
      if (retries >= maxRetries) {
        isConnecting = false;
        throw err;
      }
      const backoff = retryDelayMs * Math.pow(1.5, retries - 1);
      console.log(`⏳ Retrying MongoDB connection in ${Math.round(backoff)}ms...`);
      await new Promise((res) => setTimeout(res, backoff));
    }
  }
}

async function closeDB() {
  try {
    await mongoose.connection.close();
    console.log('🍃 [MongoDB Atlas] Connection closed gracefully');
  } catch (err) {
    console.error('Error closing MongoDB connection:', err.message);
  }
}

async function getStorageStats() {
  try {
    if (mongoose.connection.readyState !== 1) {
      return {
        connected: false,
        message: 'Database not connected',
      };
    }

    const stats = await mongoose.connection.db.stats();
    const dataSizeMB = (stats.dataSize / (1024 * 1024)).toFixed(2);
    const storageSizeMB = (stats.storageSize / (1024 * 1024)).toFixed(2);
    const indexSizeMB = (stats.indexSize / (1024 * 1024)).toFixed(2);
    const targetLimitMB = 100;
    const atlasFreeLimitMB = 500;
    const currentUsageMB = parseFloat(storageSizeMB);
    const percentOfTarget = ((currentUsageMB / targetLimitMB) * 100).toFixed(1);

    const isWarning = currentUsageMB >= 80;

    return {
      connected: true,
      dataSizeMB: parseFloat(dataSizeMB),
      storageSizeMB: currentUsageMB,
      indexSizeMB: parseFloat(indexSizeMB),
      targetLimitMB,
      atlasFreeLimitMB,
      percentOfTarget: parseFloat(percentOfTarget),
      warning: isWarning,
      warningMessage: isWarning ? 'Storage usage is approaching the 100 MB target threshold.' : 'Storage is well within healthy bounds.',
      collections: stats.collections,
      objects: stats.objects,
      explanation: 'MongoDB Atlas Free provides a 500 MB allocation. ClassOrbit maintains a strict target of ~100 MB. Note that physical storage size reflects allocated chunks and indexes, which shrink over maintenance cycles rather than immediately on single document deletions.',
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message,
    };
  }
}

module.exports = {
  connectDB,
  closeDB,
  getStorageStats,
  mongoose,
};
