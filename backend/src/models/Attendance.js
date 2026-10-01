const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema(
  {
    classroomId: {
      type: String,
      required: true,
      index: true,
    },
    classroomName: {
      type: String,
      required: true,
      trim: true,
    },
    participantId: {
      type: String,
      required: true,
      index: true,
    },
    studentName: {
      type: String,
      required: true,
      trim: true,
    },
    mobileNumber: {
      type: String,
      trim: true,
      default: '',
    },
    joinTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    leaveTime: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      default: 0,
    },
    classDate: {
      type: String,
      required: true,
      index: true, // Format: YYYY-MM-DD
    },
    status: {
      type: String,
      enum: ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'],
      default: 'PRESENT',
    },
    exported: {
      type: Boolean,
      default: false,
      index: true,
    },
    acknowledged: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for quick attendee uniqueness checks and lookup
AttendanceSchema.index({ classroomId: 1, participantId: 1 });
AttendanceSchema.index({ classDate: 1, exported: 1 });

const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);
module.exports = Attendance;
