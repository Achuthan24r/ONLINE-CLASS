import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Plus,
  Radio,
  Clock,
  Users,
  Copy,
  Check,
  Ban,
  Play,
  RotateCcw,
  ShieldAlert,
  FileText,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  LogOut,
  X,
  ClipboardCheck,
  Phone,
  Download,
  Database,
  HardDrive,
  Trash2,
  AlertTriangle,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export function AdminDashboardPage() {
  const { admin, loading: authLoading, logout } = useAuth();
  const { success, error, info } = useToast();
  const navigate = useNavigate();

  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(50);
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  // Storage and Maintenance State
  const [storageStats, setStorageStats] = useState(null);
  const [cleaningStorage, setCleaningStorage] = useState(false);
  const [downloadingDaily, setDownloadingDaily] = useState(false);

  // Audit Log State
  const [selectedAuditRoom, setSelectedAuditRoom] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  useEffect(() => {
    if (!authLoading && !admin) {
      navigate('/admin/login');
    }
  }, [admin, authLoading, navigate]);

  const loadStorageStatus = async () => {
    try {
      const res = await api.getStorageStatus();
      if (res.success && res.data) {
        setStorageStats(res.data);
      }
    } catch (err) {
      // storage status fetch failure shouldn't block dashboard
    }
  };

  const loadClassrooms = async () => {
    try {
      setLoading(true);
      const res = await api.getClassrooms();
      if (res.success && res.data) {
        setClassrooms(res.data.classrooms || []);
      }
    } catch (err) {
      error(err.message || 'Could not load classrooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (admin) {
      loadClassrooms();
      loadStorageStatus();
    }
  }, [admin]);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    setCreating(true);
    try {
      const res = await api.createClassroom({
        name: newRoomName.trim(),
        description: newRoomDesc.trim() || undefined,
        maxParticipants: Number(maxParticipants) || 50,
      });

      if (res.success && res.data?.classroom) {
        success(`Classroom "${newRoomName}" created!`, 'Classroom Live');
        setShowCreateModal(false);
        setNewRoomName('');
        setNewRoomDesc('');
        loadClassrooms();
      }
    } catch (err) {
      error(err.message || 'Failed to create classroom');
    } finally {
      setCreating(false);
    }
  };

  const handleCopyLink = (code) => {
    const fullUrl = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedCode(code);
    success('Student invitation link copied to clipboard!');
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleRevokeInvitation = async (classroomId, inviteId) => {
    if (!window.confirm('Revoke this invitation code? Students will no longer be able to use this link to join.')) {
      return;
    }
    try {
      await api.revokeInvitation(classroomId, inviteId);
      info('Invitation code has been revoked.');
      loadClassrooms();
    } catch (err) {
      error(err.message || 'Could not revoke invitation');
    }
  };

  const handleEndClassroom = async (classroomId, roomName) => {
    if (!window.confirm(`Are you sure you want to terminate "${roomName}"? All participants will be disconnected.`)) {
      return;
    }
    try {
      await api.endClassroom(classroomId);
      success(`Classroom "${roomName}" ended.`, 'Room Terminated');
      loadClassrooms();
    } catch (err) {
      error(err.message || 'Failed to end classroom');
    }
  };

  const handleViewAuditLogs = async (classroom) => {
    setSelectedAuditRoom(classroom);
    setLoadingAudit(true);
    try {
      const res = await api.getAuditLogs(classroom.id);
      if (res.success && res.data) {
        setAuditLogs(res.data.logs || []);
      }
    } catch (err) {
      error(err.message || 'Failed to load audit logs');
    } finally {
      setLoadingAudit(false);
    }
  };

  // Attendance State & Handlers
  const [selectedAttendanceRoom, setSelectedAttendanceRoom] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  const handleViewAttendance = async (classroom) => {
    setSelectedAttendanceRoom(classroom);
    setLoadingAttendance(true);
    try {
      const res = await api.getAttendance(classroom.id);
      if (res.success && res.data) {
        setAttendanceRecords(res.data.records || []);
      }
    } catch (err) {
      error(err.message || 'Failed to load attendance');
    } finally {
      setLoadingAttendance(false);
    }
  };

  const handleUpdateAttendanceStatus = async (attendanceId, newStatus) => {
    if (!selectedAttendanceRoom) return;
    try {
      const res = await api.updateAttendance(selectedAttendanceRoom.id, attendanceId, {
        status: newStatus,
      });
      if (res.success && res.data?.record) {
        setAttendanceRecords((prev) =>
          prev.map((r) => (r.id === attendanceId ? res.data.record : r))
        );
        success(`Status updated to ${newStatus}.`);
      }
    } catch (err) {
      error(err.message || 'Failed to update attendance');
    }
  };

  const handleExportDashboardCSV = () => {
    if (attendanceRecords.length === 0) {
      info('No records to export.');
      return;
    }
    const headers = ['Student Name', 'Mobile Number', 'Status', 'Marked At', 'Updated By'];
    const rows = attendanceRecords.map((r) => [
      `"${r.studentName}"`,
      `"${r.mobileNumber}"`,
      r.status,
      `"${new Date(r.markedAt).toLocaleString()}"`,
      r.updatedBy || 'STUDENT',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Attendance_${selectedAttendanceRoom.name.replace(/\\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadDailyCSV = async () => {
    try {
      setDownloadingDaily(true);
      await api.downloadDailyCSV();
      success('Daily attendance CSV downloaded successfully.');
    } catch (err) {
      error(err.message || 'Failed to download daily attendance CSV');
    } finally {
      setDownloadingDaily(false);
    }
  };

  const handleDownloadClassroomCSV = async (room) => {
    try {
      await api.downloadClassroomCSV(room.id, `attendance_${room.name.replace(/\\s+/g, '_')}.csv`);
      success(`Attendance CSV downloaded for "${room.name}".`);
      loadClassrooms();
    } catch (err) {
      error(err.message || 'Failed to download classroom CSV');
    }
  };

  const handleAcknowledgeAttendance = async (classroomId) => {
    try {
      await api.acknowledgeAttendance(classroomId);
      success('Attendance export acknowledged. Classroom is now marked eligible for scheduled cleanup.');
      loadClassrooms();
      loadStorageStatus();
    } catch (err) {
      error(err.message || 'Failed to acknowledge export');
    }
  };

  const handleRunCleanup = async () => {
    setCleaningStorage(true);
    try {
      const res = await api.triggerCleanup();
      success('Automated maintenance executed. Cleaned eligible records and ephemeral caches.');
      loadStorageStatus();
      loadClassrooms();
    } catch (err) {
      error(err.message || 'Failed to trigger cleanup');
    } finally {
      setCleaningStorage(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-orbit-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orbit-violet border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeRooms = classrooms.filter((r) => r.status === 'ACTIVE');
  const endedRooms = classrooms.filter((r) => r.status === 'ENDED');
  const totalStudents = classrooms.reduce((acc, curr) => acc + (curr._count?.sessions || 0), 0);
  const totalPending = classrooms.reduce((acc, curr) => acc + (curr._count?.permissionRequests || 0), 0);

  return (
    <div className="min-h-screen flex flex-col bg-orbit-950 text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Top Header bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold text-white">Teacher Dashboard</h1>
              <span className="px-3 py-1 rounded-full bg-orbit-violet/10 border border-orbit-violet/30 text-orbit-violet text-xs font-semibold">
                Instructor Console
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Welcome back, <strong className="text-white">{admin?.username}</strong>. Manage active classrooms and permissions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleDownloadDailyCSV}
              disabled={downloadingDaily}
              className="px-4 py-2.5 rounded-xl bg-orbit-900 hover:bg-orbit-800 text-emerald-400 border border-emerald-500/30 font-semibold text-xs transition flex items-center gap-2 shadow-sm"
              title="Download consolidated CSV attendance across all classrooms for today"
            >
              {downloadingDaily ? (
                <span className="w-3.5 h-3.5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Download Daily Attendance CSV</span>
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orbit-violet via-indigo-600 to-purple-600 hover:opacity-95 text-white font-semibold text-xs shadow-lg shadow-orbit-violet/25 transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create Classroom</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
          <div className="p-5 rounded-2xl glass-card flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Active Classrooms</p>
              <p className="text-2xl font-extrabold text-white">{activeRooms.length}</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl glass-card flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Connected Students</p>
              <p className="text-2xl font-extrabold text-white">{totalStudents}</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl glass-card flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Pending Permission Requests</p>
              <p className="text-2xl font-extrabold text-white">{totalPending}</p>
            </div>
          </div>
        </div>

        {/* Storage Monitoring & Automatic Cleanup Widget */}
        {storageStats && (
          <div className="mb-10 p-5 rounded-2xl glass-card border border-white/10 bg-orbit-900/60 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex-1">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">MongoDB Atlas Storage Status</h3>
                    {storageStats.warning ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Storage Warning
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                        Healthy (~100 MB Target)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    Allocated free tier: {storageStats.atlasFreeLimitMB} MB • Target budget: {storageStats.targetLimitMB} MB
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3 max-w-xl">
                <div className="flex justify-between text-[11px] mb-1 font-mono">
                  <span className="text-slate-300">
                    Usage: <strong>{storageStats.storageSizeMB || '0.00'} MB</strong> ({storageStats.percentOfTarget || 0}% of target)
                  </span>
                  <span className="text-slate-400">{storageStats.objects || 0} documents in {storageStats.collections || 0} collections</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      storageStats.warning ? 'bg-amber-400' : 'bg-gradient-to-r from-orbit-violet to-emerald-400'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(2, storageStats.percentOfTarget || 0))}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={handleRunCleanup}
                disabled={cleaningStorage}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50"
                title="Prune acknowledged attendance records and expired classroom sessions"
              >
                {cleaningStorage ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                )}
                <span>Run Cleanup Now</span>
              </button>
            </div>
          </div>
        )}

        {/* Active Classrooms Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">Active Classrooms</h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
                {activeRooms.length} Live
              </span>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center rounded-2xl glass-card text-slate-400">
              <div className="w-8 h-8 border-2 border-orbit-violet border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm">Loading classroom state...</p>
            </div>
          ) : activeRooms.length === 0 ? (
            <div className="p-12 text-center rounded-2xl glass-card border border-dashed border-white/10">
              <div className="w-12 h-12 rounded-2xl bg-white/5 mx-auto flex items-center justify-center text-slate-500 mb-3">
                <Radio className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">No active classrooms right now</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                Create a classroom to generate a secure invitation link and begin teaching.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 rounded-xl bg-orbit-violet text-white text-xs font-semibold shadow hover:bg-violet-600 transition"
              >
                + Create Classroom
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeRooms.map((room) => {
                const activeInvite = room.invitations?.[0];
                const studentCount = room._count?.sessions || 0;
                const pendingCount = room._count?.permissionRequests || 0;

                return (
                  <div
                    key={room.id}
                    className="rounded-2xl glass-card p-6 flex flex-col justify-between border border-white/10 hover:border-orbit-violet/40 transition-all duration-300 shadow-xl group"
                  >
                    <div>
                      {/* Status row */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 border border-emerald-500/20">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          ACTIVE
                        </span>

                        {pendingCount > 0 && (
                          <span className="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 text-xs font-semibold flex items-center gap-1 border border-amber-500/30 animate-pulse">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            {pendingCount} request{pendingCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-white mb-1 group-hover:text-purple-200 transition">
                        {room.name}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                        {room.description || 'No description provided.'}
                      </p>

                      {/* Info badges */}
                      <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-orbit-900/80 border border-white/5 text-xs text-slate-300 mb-5">
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{studentCount} Connected</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(room.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      {/* Invitation Link Box */}
                      {activeInvite && (
                        <div className="p-3 rounded-xl bg-white/5 border border-white/5 mb-5 text-xs">
                          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                            <span>Invite Code: <strong className="font-mono text-white">{activeInvite.code}</strong></span>
                            <button
                              onClick={() => handleRevokeInvitation(room.id, activeInvite.id)}
                              className="text-rose-400 hover:underline flex items-center gap-1"
                              title="Revoke code"
                            >
                              <Ban className="w-3 h-3" /> Revoke
                            </button>
                          </div>
                          <button
                            onClick={() => handleCopyLink(activeInvite.code)}
                            className="w-full py-2 px-3 rounded-lg bg-orbit-800 hover:bg-orbit-700 text-slate-200 border border-white/10 flex items-center justify-center gap-2 transition font-medium"
                          >
                            {copiedCode === activeInvite.code ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400 font-semibold">Link Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-slate-400" />
                                <span>Copy Student Link</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="pt-4 border-t border-white/10 flex items-center gap-2">
                      <Link
                        to={`/classroom/${room.id}`}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-orbit-violet to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md transition"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Enter Class</span>
                      </Link>

                      <button
                        onClick={() => handleViewAttendance(room)}
                        title="View Class Attendance Register"
                        className="p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition"
                      >
                        <ClipboardCheck className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleViewAuditLogs(room)}
                        title="View Moderation Audit Trail"
                        className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 transition"
                      >
                        <FileText className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleEndClassroom(room.id, room.name)}
                        title="End Classroom Session"
                        className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Ended Classrooms History */}
        {endedRooms.length > 0 && (
          <div className="pt-6 border-t border-white/10">
            <h3 className="text-lg font-bold text-white mb-4">Past Terminated Classrooms ({endedRooms.length})</h3>
            <div className="space-y-3">
              {endedRooms.map((room) => (
                <div
                  key={room.id}
                  className="p-4 rounded-xl glass-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-white/5 opacity-80 hover:opacity-100 transition"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-white text-sm">{room.name}</h4>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">ENDED</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Ended at {room.endedAt ? new Date(room.endedAt).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleDownloadClassroomCSV(room)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-xs text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 font-medium transition"
                      title="Download daily attendance CSV for this classroom"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Download CSV</span>
                    </button>

                    {room.attendanceAcknowledged ? (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Acknowledged</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAcknowledgeAttendance(room.id)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-xs text-amber-300 border border-amber-500/40 flex items-center gap-1.5 font-semibold transition"
                        title="Acknowledge attendance receipt to allow scheduled cleanup"
                      >
                        <Check className="w-3.5 h-3.5 text-amber-400" />
                        <span>Acknowledge Export</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleViewAttendance(room)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 border border-white/10 flex items-center gap-1.5 w-fit"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5 text-cyan-400" />
                      <span>View Register</span>
                    </button>
                    <button
                      onClick={() => handleViewAuditLogs(room)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 border border-white/10 flex items-center gap-1.5 w-fit"
                    >
                      <FileText className="w-3.5 h-3.5 text-orbit-violet" />
                      <span>Audit Logs</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Create Classroom Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl glass-panel p-6 shadow-2xl border border-white/10">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-orbit-violet/20 border border-orbit-violet/40 flex items-center justify-center text-orbit-violet">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Create New Classroom</h3>
                <p className="text-xs text-slate-400">Launch a secure WebRTC room with admin controls</p>
              </div>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Classroom Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Advanced Calculus & Differential Equations"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-orbit-900 border border-white/15 text-white placeholder-slate-500 focus:outline-none focus:border-orbit-violet text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Topic / Description (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Weekly problem set walkthrough. Please prepare questions in advance."
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-orbit-900 border border-white/15 text-white placeholder-slate-500 focus:outline-none focus:border-orbit-violet text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Maximum Participant Capacity
                </label>
                <input
                  type="number"
                  min="2"
                  max="500"
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-orbit-900 border border-white/15 text-white text-sm focus:outline-none focus:border-orbit-violet"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orbit-violet to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-orbit-violet/30 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {creating ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Create Classroom</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Moderation Audit Log Modal */}
      {selectedAuditRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-2xl rounded-2xl glass-panel p-6 shadow-2xl border border-white/10 max-h-[85vh] flex flex-col">
            <button
              onClick={() => setSelectedAuditRoom(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Moderation Audit Log</h3>
                <p className="text-xs text-slate-400">Classroom: {selectedAuditRoom.name}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-2.5 my-2">
              {loadingAudit ? (
                <div className="p-8 text-center text-slate-400">
                  <div className="w-6 h-6 border-2 border-orbit-violet border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs">Loading audit trail...</p>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No moderation actions recorded yet.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-orbit-900/90 border border-white/5 text-xs flex items-start justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-purple-300 font-mono">{log.action}</span>
                        {log.targetParticipantId && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                            target: {log.targetParticipantId}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-300 text-[11px] leading-snug">{log.details || '—'}</p>
                    </div>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setSelectedAuditRoom(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white transition font-medium"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Classroom Attendance Register Modal */}
      {selectedAttendanceRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-2xl rounded-2xl glass-panel p-6 shadow-2xl border border-white/10 max-h-[85vh] flex flex-col">
            <button
              onClick={() => setSelectedAttendanceRoom(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Attendance Register</h3>
                  <p className="text-xs text-slate-400">Classroom: {selectedAttendanceRoom.name}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleDownloadClassroomCSV(selectedAttendanceRoom)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-1.5 transition font-medium"
                  title="Download Daily Attendance CSV"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Download Attendance CSV</span>
                </button>

                {selectedAttendanceRoom.attendanceAcknowledged ? (
                  <span className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Acknowledged</span>
                  </span>
                ) : (
                  <button
                    onClick={() => handleAcknowledgeAttendance(selectedAttendanceRoom.id)}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-xs text-amber-300 flex items-center gap-1.5 transition font-semibold"
                    title="Acknowledge export receipt to mark classroom eligible for cleanup"
                  >
                    <Check className="w-3.5 h-3.5 text-amber-400" />
                    <span>Acknowledge Export</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-2.5 my-2">
              {loadingAttendance ? (
                <div className="p-8 text-center text-slate-400">
                  <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs">Loading attendance register...</p>
                </div>
              ) : attendanceRecords.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs rounded-xl bg-orbit-900 border border-white/5">
                  No attendance records submitted for this classroom yet.
                </div>
              ) : (
                attendanceRecords.map((rec) => {
                  const isPresent = rec.status === 'PRESENT';
                  const isLate = rec.status === 'LATE';
                  const isAbsent = rec.status === 'ABSENT';

                  return (
                    <div
                      key={rec.id}
                      className="p-3.5 rounded-xl bg-orbit-900/90 border border-white/5 text-xs flex items-center justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-white text-sm">{rec.studentName}</span>
                          {rec.updatedBy === 'ADMIN' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">
                              Admin edited
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-cyan-400" />
                            {rec.mobileNumber}
                          </span>
                          <span>•</span>
                          <span>Marked at {new Date(rec.markedAt).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Instructor can modify status */}
                      <div className="flex items-center gap-2">
                        <select
                          value={rec.status}
                          onChange={(e) => handleUpdateAttendanceStatus(rec.id, e.target.value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border focus:outline-none cursor-pointer ${
                            isPresent
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                              : isLate
                              ? 'bg-amber-950 text-amber-300 border-amber-500/40'
                              : isAbsent
                              ? 'bg-rose-950 text-rose-300 border-rose-500/40'
                              : 'bg-cyan-950 text-cyan-300 border-cyan-500/40'
                          }`}
                        >
                          <option value="PRESENT" className="bg-orbit-900 text-emerald-400">PRESENT</option>
                          <option value="LATE" className="bg-orbit-900 text-amber-400">LATE</option>
                          <option value="ABSENT" className="bg-orbit-900 text-rose-400">ABSENT</option>
                          <option value="EXCUSED" className="bg-orbit-900 text-cyan-400">EXCUSED</option>
                        </select>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-between items-center text-xs text-slate-400">
              <span>Total Recorded: <strong className="text-white">{attendanceRecords.length}</strong></span>
              <button
                onClick={() => setSelectedAttendanceRoom(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white transition font-medium"
              >
                Close Register
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
