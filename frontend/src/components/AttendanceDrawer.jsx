import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  Clock,
  Phone,
  User,
  Download,
  X,
  Edit2,
  AlertCircle,
  Shield,
  Filter,
  Check,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';

export function AttendanceDrawer({
  isOpen,
  onClose,
  classroomId,
  isAdmin,
  currentParticipant,
  socket,
}) {
  const { success, error, info } = useToast();

  const [records, setRecords] = useState([]);
  const [myRecord, setMyRecord] = useState(null);
  const [loading, setLoading] = useState(false);

  // Student form state
  const [studentName, setStudentName] = useState(currentParticipant?.displayName || '');
  const [mobileNumber, setMobileNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Admin edit state
  const [editingId, setEditingId] = useState(null);
  const [editStatus, setEditStatus] = useState('PRESENT');

  // Load attendance records
  const loadAttendance = async () => {
    if (!classroomId) return;
    try {
      setLoading(true);
      const res = await api.getAttendance(classroomId);
      if (res.success && res.data) {
        setRecords(res.data.records || []);
        if (res.data.myRecord) {
          setMyRecord(res.data.myRecord);
        }
      }
    } catch (err) {
      console.warn('Failed to load attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAttendance();
    }
  }, [isOpen, classroomId]);

  // Sync real-time updates via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleMarked = (data) => {
      if (data.record) {
        setRecords((prev) => {
          const exists = prev.some((r) => r.id === data.record.id);
          if (exists) return prev;
          return [data.record, ...prev];
        });
        if (data.record.participantId === currentParticipant?.participantId) {
          setMyRecord(data.record);
        }
        if (isAdmin) {
          info(`${data.record.studentName} marked attendance as PRESENT.`);
        }
      }
    };

    const handleUpdated = (data) => {
      if (data.record) {
        setRecords((prev) =>
          prev.map((r) => (r.id === data.record.id ? data.record : r))
        );
        if (data.record.participantId === currentParticipant?.participantId) {
          setMyRecord(data.record);
        }
      }
    };

    socket.on('attendance:marked', handleMarked);
    socket.on('attendance:updated', handleUpdated);

    return () => {
      socket.off('attendance:marked', handleMarked);
      socket.off('attendance:updated', handleUpdated);
    };
  }, [socket, currentParticipant, isAdmin]);

  // Student submits their attendance
  const handleSubmitAttendance = async (e) => {
    e.preventDefault();
    if (!mobileNumber.trim()) {
      error('Please provide your mobile number.');
      return;
    }
    if (!currentParticipant?.participantId) {
      error('Session not found.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.markAttendance(classroomId, {
        participantId: currentParticipant.participantId,
        studentName: studentName.trim() || currentParticipant.displayName,
        mobileNumber: mobileNumber.trim(),
      });

      if (res.success && res.data?.record) {
        setMyRecord(res.data.record);
        setRecords((prev) => [res.data.record, ...prev]);
        success('Attendance recorded! Marked as Present.', 'Verified');
      }
    } catch (err) {
      if (err.code === 'ALREADY_MARKED') {
        error(err.message || 'You have already marked attendance.');
        if (err.data?.record) setMyRecord(err.data.record);
      } else {
        error(err.message || 'Could not record attendance.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Admin updates attendance status
  const handleUpdateStatus = async (attendanceId, newStatus) => {
    try {
      const res = await api.updateAttendance(classroomId, attendanceId, {
        status: newStatus,
      });
      if (res.success && res.data?.record) {
        setRecords((prev) =>
          prev.map((r) => (r.id === attendanceId ? res.data.record : r))
        );
        setEditingId(null);
        success(`Status updated to ${newStatus}.`);
      }
    } catch (err) {
      error(err.message || 'Failed to update attendance status.');
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (records.length === 0) {
      info('No attendance records to export.');
      return;
    }

    const headers = ['Student Name', 'Mobile Number', 'Status', 'Marked At', 'Updated By'];
    const rows = records.map((r) => [
      `"${r.studentName}"`,
      `"${r.mobileNumber}"`,
      r.status,
      `"${new Date(r.markedAt).toLocaleString()}"`,
      r.updatedBy || 'STUDENT',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ClassOrbit_Attendance_${classroomId.slice(0, 8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <aside className="w-80 sm:w-96 bg-orbit-900 border-l border-white/10 flex flex-col shrink-0 z-30 animate-slide-in shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <ClipboardCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Attendance Register</h3>
            <p className="text-[10px] text-slate-400">
              {isAdmin ? `Total Marked: ${records.length}` : 'Self-marking verification'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isAdmin && records.length > 0 && (
            <button
              onClick={handleExportCSV}
              title="Export attendance as CSV"
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Student Self-Marking Panel (Only for Student or visible if student hasn't marked) */}
        {!isAdmin && (
          <div>
            {myRecord ? (
              /* Already Marked Verified Banner */
              <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 shadow-lg text-xs animate-fade-in">
                <div className="flex items-center gap-2 text-emerald-300 font-bold mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Attendance Recorded</span>
                </div>
                <div className="space-y-1.5 text-slate-300 text-[11px]">
                  <p>
                    <strong className="text-white">Name:</strong> {myRecord.studentName}
                  </p>
                  <p>
                    <strong className="text-white">Mobile:</strong> {myRecord.mobileNumber}
                  </p>
                  <p>
                    <strong className="text-white">Status:</strong>{' '}
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold uppercase">
                      {myRecord.status}
                    </span>
                  </p>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1 pt-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>Marked at {new Date(myRecord.markedAt).toLocaleTimeString()}</span>
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-emerald-500/20 text-[10px] text-emerald-400/80">
                  ✓ One-time submission verified. Only the instructor can modify attendance records.
                </div>
              </div>
            ) : (
              /* Student Attendance Form */
              <div className="p-4 rounded-2xl glass-card border border-white/10 shadow-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Mark Your Attendance
                  </h4>
                </div>
                <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
                  Enter your details below and click Present. Each student can mark attendance only once.
                </p>

                <form onSubmit={handleSubmitAttendance} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Student Name
                    </label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="e.g. John Doe"
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-orbit-850 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Mobile Number
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        required
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                        placeholder="e.g. +1 555-0199 or 9876543210"
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-orbit-850 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {submitting ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Present</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Attendance Register List (Admin & Student overview) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              {isAdmin ? 'All Student Records' : 'Class Attendance Log'} ({records.length})
            </h4>
            {isAdmin && (
              <span className="text-[10px] text-purple-300">Admin editable</span>
            )}
          </div>

          {loading ? (
            <div className="p-6 text-center text-xs text-slate-400">
              <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <span>Loading attendance register...</span>
            </div>
          ) : records.length === 0 ? (
            <div className="p-6 rounded-xl bg-orbit-850/50 border border-white/5 text-center text-xs text-slate-500">
              No students have marked attendance yet.
            </div>
          ) : (
            <div className="space-y-2">
              {records.map((rec) => {
                const isPresent = rec.status === 'PRESENT';
                const isLate = rec.status === 'LATE';
                const isAbsent = rec.status === 'ABSENT';

                return (
                  <div
                    key={rec.id}
                    className="p-3 rounded-xl bg-orbit-850 border border-white/5 text-xs flex flex-col gap-2 hover:border-white/10 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-white">{rec.studentName}</span>
                          {rec.updatedBy === 'ADMIN' && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              Modified by Teacher
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-cyan-400" />
                            {rec.mobileNumber}
                          </span>
                          <span>•</span>
                          <span>{new Date(rec.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      {/* Status badge / selector */}
                      <div>
                        {isAdmin ? (
                          <select
                            value={rec.status}
                            onChange={(e) => handleUpdateStatus(rec.id, e.target.value)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border focus:outline-none cursor-pointer ${
                              isPresent
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                                : isLate
                                ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                                : isAbsent
                                ? 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                                : 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                            }`}
                          >
                            <option value="PRESENT" className="bg-orbit-900 text-emerald-400">PRESENT</option>
                            <option value="LATE" className="bg-orbit-900 text-amber-400">LATE</option>
                            <option value="ABSENT" className="bg-orbit-900 text-rose-400">ABSENT</option>
                            <option value="EXCUSED" className="bg-orbit-900 text-cyan-400">EXCUSED</option>
                          </select>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isPresent
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : isLate
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {rec.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
