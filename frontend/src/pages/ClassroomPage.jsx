import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  Users,
  MessageSquare,
  PhoneOff,
  Copy,
  Check,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Ban,
  Radio,
  Lock,
  Unlock,
  Sparkles,
  AlertCircle,
  FileText,
  Send,
  X,
  Volume2,
  VolumeX,
  Maximize2,
  ClipboardCheck,
  Download,
  CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';
import { createClassroomSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AttendanceDrawer } from '../components/AttendanceDrawer';

export function ClassroomPage() {
  const { id: classroomId } = useParams();
  const navigate = useNavigate();
  const { admin } = useAuth();
  const { success, error, info, warning } = useToast();

  // Classroom & Identity State
  const [classroom, setClassroom] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentParticipant, setCurrentParticipant] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  // Classroom End Summary State
  const [showEndSummary, setShowEndSummary] = useState(false);
  const [attendanceAcknowledged, setAttendanceAcknowledged] = useState(false);
  const [downloadingCSV, setDownloadingCSV] = useState(false);

  // Student Permissions State
  const [permissions, setPermissions] = useState({
    canPublishMic: false,
    canPublishCam: false,
    canPublishScreen: false,
  });

  // Media Hardware State
  const [micActive, setMicActive] = useState(false);
  const [camActive, setCamActive] = useState(false);
  const [screenActive, setScreenActive] = useState(false);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  // UI Drawers & Overlays
  const [showParticipantsDrawer, setShowParticipantsDrawer] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [showAttendanceDrawer, setShowAttendanceDrawer] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [socket, setSocket] = useState(null);

  // Pending request submission state for students
  const [requestingType, setRequestingType] = useState(null);

  // Load classroom and participant credentials
  useEffect(() => {
    let activeSocket = null;

    const init = async () => {
      try {
        setLoading(true);

        const adminToken = localStorage.getItem('classorbit_admin_token');
        const participantToken = localStorage.getItem('classorbit_participant_token');
        const storedParticipantId = localStorage.getItem('classorbit_participant_id');
        const storedDisplayName = localStorage.getItem('classorbit_display_name');

        let isUserAdmin = false;
        let pIdentity = null;

        if (admin) {
          isUserAdmin = true;
          setIsAdmin(true);
          pIdentity = {
            participantId: `admin_${admin.id.slice(0, 8)}`,
            displayName: `${admin.username} (Teacher)`,
            role: 'ADMIN',
          };
          setCurrentParticipant(pIdentity);
          setPermissions({
            canPublishMic: true,
            canPublishCam: true,
            canPublishScreen: true,
          });

          // Fetch full classroom data
          const roomRes = await api.getClassroomById(classroomId);
          if (roomRes.success && roomRes.data?.classroom) {
            setClassroom(roomRes.data.classroom);
            setParticipants(roomRes.data.classroom.sessions || []);
            setPendingRequests(roomRes.data.classroom.permissionRequests || []);
          }
        } else {
          setIsAdmin(false);
          if (!participantToken || !storedParticipantId) {
            warning('No student session token found. Please join via invitation link.');
            navigate(`/join`);
            return;
          }

          pIdentity = {
            participantId: storedParticipantId,
            displayName: storedDisplayName || 'Student',
            role: 'STUDENT',
          };
          setCurrentParticipant(pIdentity);

          // Fetch token & permissions
          try {
            const tokenRes = await api.getClassroomToken(classroomId);
            if (tokenRes.success && tokenRes.data?.permissions) {
              setPermissions(tokenRes.data.permissions);
            }
          } catch (e) {
            console.warn('Could not fetch token:', e);
          }

          setClassroom({ id: classroomId, name: 'Online Classroom' });
        }

        // Initialize Socket.IO connection
        activeSocket = createClassroomSocket({
          classroomId,
          token: isUserAdmin ? adminToken : null,
          participantToken: !isUserAdmin ? participantToken : null,
        });
        setSocket(activeSocket);

        // Socket Event Listeners
        activeSocket.on('participant:joined', (data) => {
          if (data.participant) {
            setParticipants((prev) => {
              const exists = prev.some((p) => p.participantId === data.participant.participantId);
              if (exists) return prev;
              return [...prev, data.participant];
            });
            info(`${data.participant.displayName} entered the classroom.`);
          }
        });

        activeSocket.on('participant:left', (data) => {
          setParticipants((prev) => prev.filter((p) => p.participantId !== data.participantId));
        });

        activeSocket.on('classroom:ended', () => {
          stopAllLocalTracks();
          if (isUserAdmin) {
            setShowEndSummary(true);
          } else {
            alert('The teacher has ended this classroom session.');
            navigate('/');
          }
        });

        activeSocket.on('participant:removed', (data) => {
          if (data.participantId === pIdentity?.participantId) {
            stopAllLocalTracks();
            alert('You have been removed from the classroom by the administrator.');
            localStorage.removeItem('classorbit_participant_token');
            navigate('/');
          } else {
            setParticipants((prev) => prev.filter((p) => p.participantId !== data.participantId));
            info(`${data.displayName || 'A participant'} was removed by teacher.`);
          }
        });

        // Permission request received (Admin receives this)
        activeSocket.on('permission:requested', (data) => {
          if (data.request) {
            setPendingRequests((prev) => {
              const exists = prev.some((r) => r.id === data.request.id);
              if (exists) return prev;
              return [...prev, data.request];
            });
            warning(`${data.request.displayName} requested ${data.request.mediaType} access!`, 'Permission Request');
          }
        });

        // Permission reviewed (Student receives approval or rejection)
        activeSocket.on('permission:reviewed', (data) => {
          // Remove from pending list
          setPendingRequests((prev) => prev.filter((r) => r.id !== data.requestId));

          if (data.participantId === pIdentity?.participantId) {
            if (data.action === 'APPROVE') {
              setPermissions(data.permission);
              success(
                `Your teacher approved your ${data.mediaType} request! You may now toggle it on.`,
                'Permission Granted'
              );
            } else {
              warning(`Your ${data.mediaType} request was denied by the teacher.`, 'Request Declined');
            }
          }

          // Update participant list permission state
          setParticipants((prev) =>
            prev.map((p) => (p.participantId === data.participantId ? { ...p, permission: data.permission } : p))
          );
        });

        // Permission revoked
        activeSocket.on('permission:revoked', (data) => {
          if (data.participantId === pIdentity?.participantId) {
            setPermissions(data.permission);
            warning(`Your ${data.mediaType} publishing permission was revoked by the teacher.`, 'Access Revoked');

            // CRITICAL REQUIREMENT: Immediately stop active local media tracks upon revocation!
            if (data.mediaType === 'MIC') {
              stopAudioTrack();
            } else if (data.mediaType === 'CAM') {
              stopVideoTrack();
            } else if (data.mediaType === 'SCREEN') {
              stopScreenTrack();
            }
          }

          setParticipants((prev) =>
            prev.map((p) => (p.participantId === data.participantId ? { ...p, permission: data.permission } : p))
          );
        });

        // Real-time Chat
        activeSocket.on('chat:received', (msg) => {
          setChatMessages((prev) => [...prev, msg]);
        });

        // Media state changes broadcasted
        activeSocket.on('media:state-change', (data) => {
          setParticipants((prev) =>
            prev.map((p) => (p.participantId === data.participantId ? { ...p, mediaState: data } : p))
          );
        });
      } catch (err) {
        error(err.message || 'Error connecting to classroom');
      } finally {
        setLoading(false);
      }
    };

    init();

    return () => {
      stopAllLocalTracks();
      if (activeSocket) {
        activeSocket.disconnect();
      }
    };
  }, [classroomId, admin]);

  // Clean track stopping functions
  const stopAudioTrack = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => track.stop());
    }
    setMicActive(false);
  };

  const stopVideoTrack = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => track.stop());
    }
    setCamActive(false);
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  };

  const stopScreenTrack = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    setScreenActive(false);
  };

  const stopAllLocalTracks = () => {
    stopAudioTrack();
    stopVideoTrack();
    stopScreenTrack();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
  };

  // Student requests permission
  const handleRequestPermission = async (mediaType) => {
    if (!currentParticipant?.participantId) return;
    setRequestingType(mediaType);
    try {
      await api.requestPermission(classroomId, mediaType, currentParticipant.participantId);
      info(`Request for ${mediaType} access sent to teacher. Waiting for approval...`, 'Request Sent');
    } catch (err) {
      error(err.message || 'Could not request permission');
    } finally {
      setRequestingType(null);
    }
  };

  // Admin approves / rejects permission
  const handleReviewPermission = async (requestId, action) => {
    try {
      await api.reviewPermission(classroomId, requestId, action);
      if (action === 'APPROVE') {
        success('Permission approved.');
      } else {
        info('Permission request rejected.');
      }
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      error(err.message || 'Failed to review request');
    }
  };

  // Admin revokes permission
  const handleRevokePermission = async (participantId, mediaType) => {
    try {
      await api.revokePermission(classroomId, participantId, mediaType);
      warning(`Revoked ${mediaType} access for participant.`);
    } catch (err) {
      error(err.message || 'Failed to revoke permission');
    }
  };

  // Admin removes participant
  const handleRemoveParticipant = async (participantId, displayName) => {
    if (!window.confirm(`Are you sure you want to remove ${displayName} from the classroom?`)) {
      return;
    }
    try {
      await api.removeParticipant(classroomId, participantId);
      success(`${displayName} removed from classroom.`);
      setParticipants((prev) => prev.filter((p) => p.participantId !== participantId));
    } catch (err) {
      error(err.message || 'Failed to remove participant');
    }
  };

  // Deliberate Toggle Mic
  const handleToggleMic = async () => {
    if (!isAdmin && !permissions.canPublishMic) {
      handleRequestPermission('MIC');
      return;
    }

    if (micActive) {
      stopAudioTrack();
      broadcastMediaState(false, camActive, screenActive);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (localStreamRef.current) {
          stream.getAudioTracks().forEach((t) => localStreamRef.current.addTrack(t));
        } else {
          localStreamRef.current = stream;
        }
        setMicActive(true);
        success('Microphone unmuted.');
        broadcastMediaState(true, camActive, screenActive);
      } catch (err) {
        error('Could not access microphone: ' + err.message);
      }
    }
  };

  // Deliberate Toggle Camera
  const handleToggleCam = async () => {
    if (!isAdmin && !permissions.canPublishCam) {
      handleRequestPermission('CAM');
      return;
    }

    if (camActive) {
      stopVideoTrack();
      broadcastMediaState(micActive, false, screenActive);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
        if (localStreamRef.current) {
          stream.getVideoTracks().forEach((t) => localStreamRef.current.addTrack(t));
        } else {
          localStreamRef.current = stream;
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setCamActive(true);
        success('Camera enabled.');
        broadcastMediaState(micActive, true, screenActive);
      } catch (err) {
        error('Could not access webcam: ' + err.message);
      }
    }
  };

  // Deliberate Toggle Screen Share
  const handleToggleScreen = async () => {
    if (!isAdmin && !permissions.canPublishScreen) {
      handleRequestPermission('SCREEN');
      return;
    }

    if (screenActive) {
      stopScreenTrack();
      broadcastMediaState(micActive, camActive, false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        setScreenActive(true);
        success('Screen sharing active.');

        stream.getVideoTracks()[0].onended = () => {
          stopScreenTrack();
          broadcastMediaState(micActive, camActive, false);
        };

        broadcastMediaState(micActive, camActive, true);
      } catch (err) {
        if (err.name !== 'NotAllowedError') {
          error('Could not start screen sharing: ' + err.message);
        }
      }
    }
  };

  const broadcastMediaState = (mic, cam, screen) => {
    if (socket) {
      socket.emit('media:state-change', {
        micActive: mic,
        camActive: cam,
        screenActive: screen,
      });
    }
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket) return;
    socket.emit('chat:message', { text: chatInput.trim() });
    setChatInput('');
  };

  const handleCopyInviteLink = () => {
    const inviteCode = classroom?.invitations?.[0]?.code;
    const url = inviteCode ? `${window.location.origin}/join/${inviteCode}` : window.location.href;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    success('Classroom link copied!');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleLeaveOrEnd = async () => {
    if (isAdmin) {
      if (window.confirm('Do you want to end the classroom for everyone? Click OK to end, or Cancel to just leave.')) {
        stopAllLocalTracks();
        try {
          await api.endClassroom(classroomId);
          setShowEndSummary(true);
        } catch (err) {
          error(err.message || 'Failed to end classroom');
        }
        return;
      }
    }
    stopAllLocalTracks();
    navigate(isAdmin ? '/admin/dashboard' : '/');
  };

  const handleDownloadSummaryCSV = async () => {
    try {
      setDownloadingCSV(true);
      await api.downloadClassroomCSV(classroomId, `attendance_${classroom?.name?.replace(/\s+/g, '_') || 'class'}.csv`);
      success('Daily attendance CSV downloaded successfully.');
    } catch (err) {
      error(err.message || 'Failed to download attendance CSV');
    } finally {
      setDownloadingCSV(false);
    }
  };

  const handleAcknowledgeSummaryAttendance = async () => {
    try {
      await api.acknowledgeAttendance(classroomId);
      setAttendanceAcknowledged(true);
      success('Attendance export acknowledged. Classroom records eligible for automated cleanup.');
    } catch (err) {
      error(err.message || 'Failed to acknowledge attendance export');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-orbit-950 flex flex-col items-center justify-center text-slate-300">
        <div className="w-12 h-12 border-3 border-orbit-violet border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold text-white">Connecting to Classroom Session...</h2>
        <p className="text-xs text-slate-400 mt-1">Verifying cryptographic media permissions</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-orbit-950 flex flex-col overflow-hidden text-slate-100 select-none">
      {/* Top Header Bar */}
      <header className="h-14 px-4 bg-orbit-900/90 border-b border-white/10 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-orbit-violet to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-orbit-violet/20">
            CO
          </div>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              {classroom?.name || 'ClassOrbit Room'}
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
            </h1>
            <p className="text-[10px] text-slate-400">
              {isAdmin ? 'Teacher Host Authority' : `Student: ${currentParticipant?.displayName}`}
            </p>
          </div>
        </div>

        {/* Central status pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-orbit-850 border border-white/10 text-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-300">Zero-Trust SFU Active</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400 font-mono">{participants.length + 1} present</span>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={handleCopyInviteLink}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200 flex items-center gap-1.5 transition"
              title="Copy student invite link"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Invite Link</span>
            </button>
          )}

          <button
            onClick={() => {
              setShowAttendanceDrawer(!showAttendanceDrawer);
              if (!showAttendanceDrawer) {
                setShowParticipantsDrawer(false);
                setShowChatDrawer(false);
              }
            }}
            className={`p-2 rounded-lg text-xs flex items-center gap-1.5 border transition ${
              showAttendanceDrawer
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/30'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
            }`}
            title="Attendance Register"
          >
            <ClipboardCheck className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Attendance</span>
          </button>

          <button
            onClick={() => {
              setShowParticipantsDrawer(!showParticipantsDrawer);
              if (!showParticipantsDrawer) {
                setShowAttendanceDrawer(false);
                setShowChatDrawer(false);
              }
            }}
            className={`p-2 rounded-lg text-xs flex items-center gap-1.5 border transition ${
              showParticipantsDrawer
                ? 'bg-orbit-violet text-white border-orbit-violet'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">{participants.length + 1}</span>
            {pendingRequests.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </button>

          <button
            onClick={() => setShowChatDrawer(!showChatDrawer)}
            className={`p-2 rounded-lg text-xs flex items-center gap-1.5 border transition ${
              showChatDrawer
                ? 'bg-orbit-violet text-white border-orbit-violet'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Classroom Content Stage */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Stage / Video Tile Grid */}
        <div className="flex-1 p-4 flex flex-col justify-center items-center overflow-y-auto">
          {/* Floating Admin Banner for Pending Requests */}
          {isAdmin && pendingRequests.length > 0 && (
            <div className="w-full max-w-2xl mb-4 p-3.5 rounded-2xl bg-amber-950/90 border border-amber-500/40 text-amber-100 shadow-2xl flex items-center justify-between gap-4 animate-slide-in">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-white">
                    {pendingRequests[0].displayName} requested {pendingRequests[0].mediaType} access
                  </p>
                  <p className="text-amber-200/80 text-[11px]">
                    {pendingRequests.length > 1 ? `+${pendingRequests.length - 1} more pending requests` : 'Requires instructor approval'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleReviewPermission(pendingRequests[0].id, 'APPROVE')}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleReviewPermission(pendingRequests[0].id, 'REJECT')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Reject
                </button>
              </div>
            </div>
          )}

          {/* Screen Share Stage if Active */}
          {screenActive && (
            <div className="w-full max-w-4xl h-72 sm:h-96 rounded-2xl bg-black border border-cyan-500/30 mb-4 relative overflow-hidden flex items-center justify-center shadow-2xl">
              <div className="absolute top-3 left-3 px-3 py-1 rounded-lg bg-black/70 backdrop-blur-md text-xs text-cyan-400 border border-white/10 flex items-center gap-1.5 z-10">
                <ScreenShare className="w-3.5 h-3.5 animate-pulse" />
                <span>Screen Sharing Presentation Active</span>
              </div>
              <div className="text-center p-6">
                <ScreenShare className="w-16 h-16 text-cyan-400 mx-auto mb-2 opacity-80 animate-pulse" />
                <p className="text-sm font-semibold text-white">Your Screen is being shared with the classroom</p>
                <p className="text-xs text-slate-400 mt-1">High-definition audio and visual stream broadcasted</p>
              </div>
            </div>
          )}

          {/* Responsive Video Tiles Grid */}
          <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 my-auto">
            {/* Local User Tile */}
            <div className="relative rounded-2xl bg-orbit-900 border border-white/10 aspect-video flex flex-col justify-between p-4 overflow-hidden shadow-xl group">
              {/* Webcam stream preview */}
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`absolute inset-0 w-full h-full object-cover ${camActive ? 'block' : 'hidden'}`}
              />

              {/* Avatar fallback if camera is off */}
              {!camActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center my-auto">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orbit-violet to-indigo-600 flex items-center justify-center text-white font-extrabold text-xl shadow-lg">
                    {currentParticipant?.displayName?.slice(0, 2).toUpperCase() || 'ME'}
                  </div>
                </div>
              )}

              {/* Status indicators */}
              <div className="relative z-10 flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-xs font-semibold text-white border border-white/10 flex items-center gap-1.5">
                  {isAdmin ? 'Teacher (You)' : `${currentParticipant?.displayName} (You)`}
                </span>

                <div className="flex items-center gap-1.5">
                  {micActive ? (
                    <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <Mic className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <span className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
                      <MicOff className="w-3.5 h-3.5" />
                    </span>
                  )}
                  {camActive ? (
                    <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <Video className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <span className="p-1.5 rounded-lg bg-slate-800 text-slate-400">
                      <VideoOff className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom tag */}
              <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-400">
                <span>{isAdmin ? 'Instructor' : 'Student Participant'}</span>
                {!isAdmin && (
                  <span className={permissions.canPublishMic ? 'text-emerald-400' : 'text-slate-500'}>
                    {permissions.canPublishMic ? 'Mic Authorized' : 'Mic Locked'}
                  </span>
                )}
              </div>
            </div>

            {/* Other Remote Participant Tiles */}
            {participants.map((p) => {
              const pCanMic = p.permission?.canPublishMic;
              const pCanCam = p.permission?.canPublishCam;
              const pCanScreen = p.permission?.canPublishScreen;

              return (
                <div
                  key={p.participantId || p.id}
                  className="relative rounded-2xl bg-orbit-900 border border-white/10 aspect-video flex flex-col justify-between p-4 overflow-hidden shadow-xl"
                >
                  {/* Remote Avatar */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center my-auto">
                    <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-white/10 flex items-center justify-center text-slate-300 font-extrabold text-xl">
                      {p.displayName?.slice(0, 2).toUpperCase() || 'ST'}
                    </div>
                  </div>

                  {/* Top Bar */}
                  <div className="relative z-10 flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-xs font-semibold text-slate-200 border border-white/10">
                      {p.displayName}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {pCanMic ? (
                        <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" title="Mic Authorized">
                          <Mic className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30" title="Mic Locked">
                          <MicOff className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {pCanCam ? (
                        <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" title="Cam Authorized">
                          <Video className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span className="p-1.5 rounded-lg bg-slate-800 text-slate-400" title="Cam Locked">
                          <VideoOff className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Bar & Quick Admin Actions */}
                  <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{p.role === 'ADMIN' ? 'Teacher' : 'Student'}</span>

                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        {pCanMic && (
                          <button
                            onClick={() => handleRevokePermission(p.participantId, 'MIC')}
                            className="px-1.5 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px]"
                            title="Mute / Revoke Mic"
                          >
                            Revoke Mic
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveParticipant(p.participantId, p.displayName)}
                          className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/30 text-rose-400"
                          title="Kick Participant"
                        >
                          <Ban className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Participants Sidebar Drawer */}
        {showParticipantsDrawer && (
          <aside className="w-80 bg-orbit-900 border-l border-white/10 flex flex-col shrink-0 z-30 animate-slide-in">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-orbit-violet" />
                <h3 className="text-sm font-bold text-white">Participants ({participants.length + 1})</h3>
              </div>
              <button
                onClick={() => setShowParticipantsDrawer(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Pending Requests Section (For Admin) */}
            {isAdmin && pendingRequests.length > 0 && (
              <div className="p-3 border-b border-white/10 bg-amber-950/40">
                <h4 className="text-xs font-semibold text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Pending Requests ({pendingRequests.length})
                </h4>
                <div className="space-y-2">
                  {pendingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-2.5 rounded-xl bg-orbit-850 border border-amber-500/30 text-xs flex items-center justify-between"
                    >
                      <div>
                        <p className="font-semibold text-white">{req.displayName}</p>
                        <p className="text-[10px] text-amber-300">Requested: {req.mediaType}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleReviewPermission(req.id, 'APPROVE')}
                          className="px-2 py-1 rounded bg-emerald-600 text-white font-semibold text-[10px] hover:bg-emerald-500"
                        >
                          Allow
                        </button>
                        <button
                          onClick={() => handleReviewPermission(req.id, 'REJECT')}
                          className="px-2 py-1 rounded bg-slate-700 text-slate-300 text-[10px] hover:bg-slate-600"
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Participant List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {/* Teacher item */}
              <div className="p-3 rounded-xl bg-orbit-850/80 border border-orbit-violet/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-orbit-violet/20 border border-orbit-violet/40 text-purple-300 flex items-center justify-center font-bold">
                    T
                  </div>
                  <div>
                    <p className="font-semibold text-white">Teacher (Host)</p>
                    <p className="text-[10px] text-purple-300">Instructor Admin</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-orbit-violet/20 text-purple-300 text-[10px] font-semibold">
                  HOST
                </span>
              </div>

              {/* Student participants */}
              {participants.map((p) => {
                const canMic = p.permission?.canPublishMic;
                const canCam = p.permission?.canPublishCam;
                const canScreen = p.permission?.canPublishScreen;

                return (
                  <div
                    key={p.participantId || p.id}
                    className="p-3 rounded-xl bg-orbit-850/40 border border-white/5 flex flex-col gap-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center font-semibold text-xs">
                          {p.displayName?.slice(0, 2).toUpperCase() || 'ST'}
                        </div>
                        <span className="font-medium text-slate-200">{p.displayName}</span>
                      </div>

                      {isAdmin && (
                        <button
                          onClick={() => handleRemoveParticipant(p.participantId, p.displayName)}
                          className="text-rose-400 hover:text-rose-300 text-[11px] flex items-center gap-1"
                        >
                          <Ban className="w-3 h-3" /> Remove
                        </button>
                      )}
                    </div>

                    {/* Permissions Status Row */}
                    <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px]">
                      <div className="flex items-center gap-2 text-slate-400">
                        <span className={canMic ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                          Mic: {canMic ? 'ON' : 'OFF'}
                        </span>
                        <span>•</span>
                        <span className={canCam ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                          Cam: {canCam ? 'ON' : 'OFF'}
                        </span>
                        <span>•</span>
                        <span className={canScreen ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                          Screen: {canScreen ? 'ON' : 'OFF'}
                        </span>
                      </div>

                      {isAdmin && (canMic || canCam || canScreen) && (
                        <div className="flex items-center gap-1">
                          {canMic && (
                            <button
                              onClick={() => handleRevokePermission(p.participantId, 'MIC')}
                              className="text-rose-400 hover:underline"
                            >
                              Revoke Mic
                            </button>
                          )}
                          {canCam && (
                            <button
                              onClick={() => handleRevokePermission(p.participantId, 'CAM')}
                              className="text-rose-400 hover:underline"
                            >
                              Revoke Cam
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        {/* Real-time Chat Drawer */}
        {showChatDrawer && (
          <aside className="w-80 bg-orbit-900 border-l border-white/10 flex flex-col shrink-0 z-30 animate-slide-in">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Classroom Chat</h3>
              </div>
              <button onClick={() => setShowChatDrawer(false)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 ? (
                <div className="text-center text-xs text-slate-500 py-8">
                  No messages yet. Send a message to the classroom.
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div key={msg.id} className="text-xs">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                      <span className="font-semibold text-slate-300">
                        {msg.senderName} {msg.senderRole === 'ADMIN' ? '(Teacher)' : ''}
                      </span>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-orbit-850 border border-white/5 text-slate-200 leading-relaxed">
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendChat} className="p-3 border-t border-white/10 flex gap-2">
              <input
                type="text"
                placeholder="Type message to classroom..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-orbit-850 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                className="p-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </aside>
        )}

        {/* Real-time Attendance Drawer */}
        <AttendanceDrawer
          isOpen={showAttendanceDrawer}
          onClose={() => setShowAttendanceDrawer(false)}
          classroomId={classroomId}
          isAdmin={isAdmin}
          currentParticipant={currentParticipant}
          socket={socket}
        />
      </div>

      {/* Bottom Meeting Toolbar */}
      <footer className="h-20 bg-orbit-900 border-t border-white/10 px-4 flex items-center justify-between shrink-0 z-40">
        {/* Left info */}
        <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400">
          <span className="font-semibold text-white">{classroom?.name || 'Classroom'}</span>
          <span>•</span>
          <span className="font-mono">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>

        {/* Central Controls */}
        <div className="flex items-center gap-2 sm:gap-3 mx-auto">
          {/* Microphone Button */}
          <div className="relative">
            <button
              onClick={handleToggleMic}
              title={
                !isAdmin && !permissions.canPublishMic
                  ? 'Microphone is locked. Click to request permission.'
                  : micActive
                  ? 'Mute Microphone'
                  : 'Unmute Microphone'
              }
              className={`p-3.5 sm:px-4 sm:py-3.5 rounded-2xl flex items-center gap-2 text-xs font-semibold transition shadow-lg ${
                !isAdmin && !permissions.canPublishMic
                  ? 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 border border-white/10'
                  : micActive
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/25'
              }`}
            >
              {micActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              <span className="hidden sm:inline">
                {!isAdmin && !permissions.canPublishMic ? 'Request Mic' : micActive ? 'Mute' : 'Unmute'}
              </span>
              {!isAdmin && !permissions.canPublishMic && <Lock className="w-3.5 h-3.5 text-amber-400" />}
            </button>
          </div>

          {/* Camera Button */}
          <div className="relative">
            <button
              onClick={handleToggleCam}
              title={
                !isAdmin && !permissions.canPublishCam
                  ? 'Camera is locked. Click to request permission.'
                  : camActive
                  ? 'Turn Camera Off'
                  : 'Turn Camera On'
              }
              className={`p-3.5 sm:px-4 sm:py-3.5 rounded-2xl flex items-center gap-2 text-xs font-semibold transition shadow-lg ${
                !isAdmin && !permissions.canPublishCam
                  ? 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 border border-white/10'
                  : camActive
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/25'
              }`}
            >
              {camActive ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              <span className="hidden sm:inline">
                {!isAdmin && !permissions.canPublishCam ? 'Request Cam' : camActive ? 'Stop Video' : 'Start Video'}
              </span>
              {!isAdmin && !permissions.canPublishCam && <Lock className="w-3.5 h-3.5 text-amber-400" />}
            </button>
          </div>

          {/* Screen Share Button */}
          <button
            onClick={handleToggleScreen}
            title={
              !isAdmin && !permissions.canPublishScreen
                ? 'Screen share is locked. Click to request permission.'
                : screenActive
                ? 'Stop Sharing'
                : 'Share Screen'
            }
            className={`p-3.5 sm:px-4 sm:py-3.5 rounded-2xl flex items-center gap-2 text-xs font-semibold transition shadow-lg ${
              !isAdmin && !permissions.canPublishScreen
                ? 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 border border-white/10'
                : screenActive
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/25'
                : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10'
            }`}
          >
            <ScreenShare className="w-5 h-5" />
            <span className="hidden sm:inline">
              {!isAdmin && !permissions.canPublishScreen ? 'Request Screen' : screenActive ? 'Stop Share' : 'Share Screen'}
            </span>
            {!isAdmin && !permissions.canPublishScreen && <Lock className="w-3.5 h-3.5 text-amber-400" />}
          </button>

          {/* Attendance Button */}
          <button
            onClick={() => {
              setShowAttendanceDrawer(!showAttendanceDrawer);
              if (!showAttendanceDrawer) {
                setShowParticipantsDrawer(false);
                setShowChatDrawer(false);
              }
            }}
            title="Class Attendance Register"
            className={`p-3.5 sm:px-4 sm:py-3.5 rounded-2xl flex items-center gap-2 text-xs font-semibold transition shadow-lg ${
              showAttendanceDrawer
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25'
                : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10'
            }`}
          >
            <ClipboardCheck className="w-5 h-5 text-emerald-400" />
            <span className="hidden sm:inline">Attendance</span>
          </button>

          {/* Leave / End Classroom Button */}
          <button
            onClick={handleLeaveOrEnd}
            className="p-3.5 sm:px-5 sm:py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-xl shadow-rose-600/30"
          >
            <PhoneOff className="w-5 h-5" />
            <span className="hidden sm:inline">{isAdmin ? 'End Class' : 'Leave'}</span>
          </button>
        </div>

        {/* Right drawer quick toggles for mobile */}
        <div className="flex items-center gap-2 sm:hidden">
          <button
            onClick={() => setShowParticipantsDrawer(!showParticipantsDrawer)}
            className="p-3 rounded-2xl bg-white/5 text-slate-200"
          >
            <Users className="w-4 h-4" />
          </button>
        </div>
      </footer>

      {/* Classroom End Summary Modal */}
      {showEndSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl glass-panel p-6 shadow-2xl border border-white/10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto mb-4">
              <ClipboardCheck className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-bold text-white mb-2">Classroom Session Concluded</h3>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              Attendance records and student engagement durations have been finalized in MongoDB Atlas. Download your daily attendance CSV and confirm receipt below.
            </p>

            <div className="space-y-3 mb-6">
              <button
                onClick={handleDownloadSummaryCSV}
                disabled={downloadingCSV}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition"
              >
                {downloadingCSV ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>Download Daily Attendance CSV</span>
              </button>

              {attendanceAcknowledged ? (
                <div className="w-full py-2.5 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold text-xs flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Export Acknowledged • Storage Pruning Enabled</span>
                </div>
              ) : (
                <button
                  onClick={handleAcknowledgeSummaryAttendance}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 border border-white/15 font-semibold text-xs flex items-center justify-center gap-2 transition"
                >
                  <Check className="w-4 h-4 text-amber-400" />
                  <span>Acknowledge Export & Prune Ephemeral State</span>
                </button>
              )}
            </div>

            <button
              onClick={() => navigate('/admin/dashboard')}
              className="text-xs text-slate-400 hover:text-white underline transition"
            >
              Return to Teacher Console
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
