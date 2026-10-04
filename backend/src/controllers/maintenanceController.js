const { getStorageStats } = require('../db');
const { runCleanup } = require('../services/cleanupService');

/**
 * Storage Monitoring Endpoint (GET /api/admin/storage-status)
 * Authenticated Admin Only
 * Checks approximate MongoDB database size using db.stats().
 * Returns total storage used, percent of 500 MB limit, and count of persistent records.
 * Issues a warning if database storage exceeds target threshold (100 MB or 20% of free tier).
 */
async function getStorageStatus(req, res, next) {
  try {
    const stats = await getStorageStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Manual Cleanup Trigger (POST /api/admin/cleanup)
 * Authenticated Admin Only
 * Runs immediate pruning of acknowledged attendance and expired classrooms.
 */
async function triggerCleanup(req, res, next) {
  try {
    const result = await runCleanup();
    res.json({
      success: true,
      message: 'Maintenance and cleanup routine executed successfully.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStorageStatus,
  triggerCleanup,
};
