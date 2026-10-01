const mongoose = require('mongoose');

const ClassroomSchema = new mongoose.Schema(
  {
    classroomId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    adminId: {
      type: String,
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'ENDING', 'ENDED'],
      default: 'ACTIVE',
      index: true,
    },
    maxParticipants: {
      type: Number,
      default: 50,
      min: 2,
      max: 500,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    isAttendanceExported: {
      type: Boolean,
      default: false,
    },
    attendanceExportedAt: {
      type: Date,
      default: null,
    },
    attendanceAcknowledged: {
      type: Boolean,
      default: false,
    },
    attendanceAcknowledgedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days retention
      index: { expires: 0 }, // MongoDB TTL index to auto-remove after expiry
    },
  },
  {
    timestamps: true,
  }
);

const Classroom = mongoose.models.Classroom || mongoose.model('Classroom', ClassroomSchema);
module.exports = Classroom;
