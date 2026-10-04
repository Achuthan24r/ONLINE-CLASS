import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Orbit,
  User,
  ArrowRight,
  Shield,
  MicOff,
  VideoOff,
  AlertCircle,
  CheckCircle2,
  Lock,
  Sparkles,
  Users
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export function JoinPage() {
  const { code: paramCode } = useParams();
  const navigate = useNavigate();
  const { error: toastError, success: toastSuccess } = useToast();

  const [code, setCode] = useState(paramCode || '');
  const [displayName, setDisplayName] = useState('');
  const [validating, setValidating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [classroomInfo, setClassroomInfo] = useState(null);
  const [validationError, setValidationError] = useState('');

  // Auto-validate if code is in URL
  useEffect(() => {
    if (paramCode) {
      validateCode(paramCode);
    }
  }, [paramCode]);

  const validateCode = async (codeToTest) => {
    const clean = (codeToTest || '').trim();
    if (!clean) return;

    setValidating(true);
    setValidationError('');
    try {
      const res = await api.validateInvitation(clean);
      if (res.success && res.data) {
        setClassroomInfo(res.data.classroom);
      }
    } catch (err) {
      setClassroomInfo(null);
      setValidationError(err.message || 'Invitation code is invalid or has expired.');
    } finally {
      setValidating(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setValidationError('Please enter an invitation code.');
      return;
    }
    if (!displayName.trim()) {
      setValidationError('Please choose a display name to enter.');
      return;
    }

    setJoining(true);
    setValidationError('');

    try {
      const res = await api.joinClassroom(code.trim(), displayName.trim());
      if (res.success && res.data) {
        const { classroom, participant, livekitToken, participantToken } = res.data;

        // Store temporary session tokens
        localStorage.setItem('classorbit_participant_token', participantToken);
        localStorage.setItem('classorbit_participant_id', participant.participantId);
        localStorage.setItem('classorbit_display_name', participant.displayName);
        localStorage.setItem(`classorbit_livekit_${classroom.id}`, livekitToken);

        toastSuccess(`Welcome, ${participant.displayName}! You have joined ${classroom.name}.`);
        navigate(`/classroom/${classroom.id}`);
      }
    } catch (err) {
      setValidationError(err.message || 'Failed to join classroom.');
      toastError(err.message || 'Failed to join classroom.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-orbit-950 text-slate-100">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-16 relative overflow-hidden">
        {/* Glow ambient */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 blur-[130px] pointer-events-none rounded-full" />

        <div className="w-full max-w-lg relative z-10">
          <div className="rounded-3xl glass-panel p-8 shadow-2xl border border-white/10">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 mx-auto flex items-center justify-center text-cyan-400 mb-4 shadow-lg shadow-cyan-500/10">
                <Orbit className="w-7 h-7" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-1">Join Online Classroom</h1>
              <p className="text-xs text-slate-400">
                Direct anonymous student entry. No account registration needed.
              </p>
            </div>

            {/* Validation feedback */}
            {validating && (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 flex items-center gap-3 mb-6 animate-pulse">
                <span className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <span>Validating invitation code with classroom server...</span>
              </div>
            )}

            {classroomInfo && (
              <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-200 text-xs mb-6 flex items-start gap-3 animate-fade-in">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-300 text-sm">{classroomInfo.name}</p>
                  <p className="text-emerald-300/80 mt-0.5">{classroomInfo.description || 'Active lecture session.'}</p>
                </div>
              </div>
            )}

            {validationError && (
              <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/30 text-rose-200 text-xs mb-6 flex items-start gap-3 animate-fade-in">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <span>{validationError}</span>
              </div>
            )}

            <form onSubmit={handleJoin} className="space-y-5">
              {!paramCode && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Invitation Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. orb-8f2a-9e1b"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      if (e.target.value.length >= 8) {
                        validateCode(e.target.value);
                      }
                    }}
                    onBlur={() => validateCode(code)}
                    className="w-full px-4 py-3 rounded-xl bg-orbit-900 border border-white/15 text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Your Display Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    maxLength={50}
                    placeholder="e.g. Alice Cooper"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    autoFocus
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-orbit-900 border border-white/15 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  This name will be shown to your teacher and fellow students in the classroom.
                </p>
              </div>

              {/* Security policy notice */}
              <div className="p-4 rounded-xl bg-orbit-900/90 border border-white/10 text-xs space-y-2.5">
                <div className="flex items-center gap-2 text-slate-300 font-semibold">
                  <Lock className="w-4 h-4 text-orbit-violet" />
                  <span>Student Audio & Video Policy</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5 p-2 rounded-lg bg-white/5">
                    <MicOff className="w-3.5 h-3.5 text-rose-400" />
                    <span>Mic Locked by Default</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-2 rounded-lg bg-white/5">
                    <VideoOff className="w-3.5 h-3.5 text-rose-400" />
                    <span>Camera Locked by Default</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  You can request voice or video permissions from your teacher inside the classroom at any time.
                </p>
              </div>

              <button
                type="submit"
                disabled={joining || validating}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:opacity-95 text-white font-semibold text-sm shadow-xl shadow-cyan-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {joining ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Enter Classroom</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
