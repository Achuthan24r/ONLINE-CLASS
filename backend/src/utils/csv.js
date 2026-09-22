/**
 * ClassOrbit CSV Generation Utilities
 * Properly escapes fields (commas, quotes, newlines) and formats timestamps.
 */

function escapeCSV(field) {
  if (field === null || field === undefined) return '""';
  const stringVal = String(field);
  // If string contains comma, quote, or newline, escape quotes by doubling them and enclose in quotes
  if (/[",\n\r]/.test(stringVal)) {
    return `"${stringVal.replace(/"/g, '""')}"`;
  }
  return `"${stringVal}"`;
}

/**
 * Generate formatted CSV string from attendance records
 * Expected headers:
 * Classroom Name, Classroom ID, Class Date, Student Name, Join Time, Leave Time, Duration Minutes
 */
function generateAttendanceCSV(records) {
  const headers = [
    'Classroom Name',
    'Classroom ID',
    'Class Date',
    'Student Name',
    'Join Time',
    'Leave Time',
    'Duration Minutes',
  ];

  const rows = records.map((rec) => {
    const joinISO = rec.joinTime ? new Date(rec.joinTime).toISOString() : 'N/A';
    const leaveISO = rec.leaveTime ? new Date(rec.leaveTime).toISOString() : 'Active / Disconnected';
    const duration = typeof rec.durationMinutes === 'number' ? rec.durationMinutes.toFixed(1) : '0.0';

    return [
      escapeCSV(rec.classroomName || 'Classroom'),
      escapeCSV(rec.classroomId),
      escapeCSV(rec.classDate),
      escapeCSV(rec.studentName),
      escapeCSV(joinISO),
      escapeCSV(leaveISO),
      duration,
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Generate safe filename for CSV download
 */
function generateSafeCSVFilename(classroomName, classDate) {
  const cleanName = (classroomName || 'classroom')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 40);
  const dateStr = classDate || new Date().toISOString().slice(0, 10);
  return `attendance_${cleanName}_${dateStr}.csv`;
}

module.exports = {
  escapeCSV,
  generateAttendanceCSV,
  generateSafeCSVFilename,
};
