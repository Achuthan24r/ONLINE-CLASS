import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Orbit,
  Shield,
  MicOff,
  VideoOff,
  ScreenShare,
  Users,
  Lock,
  Radio,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Sliders,
  LogIn
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { JoinModal } from '../components/JoinModal';

export function LandingPage() {
  const [showJoinModal, setShowJoinModal] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-orbit-950 text-slate-100 overflow-x-hidden">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-20 pb-28 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Glow ambient gradients */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-gradient-to-tr from-orbit-violet/25 via-indigo-500/20 to-cyan-500/10 blur-[130px] pointer-events-none rounded-full" />
        <div className="absolute top-10 right-10 w-72 h-72 bg-orbit-violet/10 blur-[90px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto relative z-10 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orbit-violet/10 border border-orbit-violet/30 text-orbit-violet text-xs font-semibold tracking-wide mb-8 animate-fade-in">
            <Shield className="w-3.5 h-3.5" />
            <span>ADMIN-CONTROLLED WEBRTC INFRASTRUCTURE</span>
          </div>

          {/* Hero Heading */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.1] mb-6">
            Your Classroom. <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-orbit-violet via-purple-300 to-cyan-400 bg-clip-text text-transparent">
              Your Rules.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10">
            A secure online teaching platform where instructors retain absolute authority.
            Students join anonymously in seconds without registration, while microphones,
            cameras, and screen sharing remain strictly disabled until you approve them.
          </p>

          {/* Call to Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto mb-16">
            <Link
              to="/admin/login"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-orbit-violet via-indigo-600 to-orbit-violet hover:opacity-95 text-white font-semibold shadow-xl shadow-orbit-violet/25 hover:shadow-orbit-violet/40 transition flex items-center justify-center gap-2 group"
            >
              <LogIn className="w-5 h-5" />
              <span>Admin Login</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </Link>

            <button
              onClick={() => setShowJoinModal(true)}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-orbit-850 hover:bg-orbit-800 text-slate-200 border border-white/10 hover:border-white/20 font-semibold shadow-lg transition flex items-center justify-center gap-2"
            >
              <Users className="w-5 h-5 text-cyan-400" />
              <span>Join a Class</span>
            </button>
          </div>

          {/* Premium Classroom Preview Stage */}
          <div className="relative max-w-5xl mx-auto rounded-2xl glass-panel p-3 sm:p-5 shadow-2xl border border-white/10 overflow-hidden group">
            {/* Window bar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 mb-4 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
                <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
                <span className="ml-2 font-mono text-slate-300">ClassOrbit // Room: Quantum Physics 101</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">LIVE</span>
                <span className="text-slate-400 font-mono">1 Teacher • 24 Students</span>
              </div>
            </div>

            {/* Video preview grid simulation */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[340px] sm:h-[400px]">
              {/* Teacher spotlight tile */}
              <div className="md:col-span-2 rounded-xl bg-gradient-to-b from-orbit-900 to-orbit-950 border border-orbit-violet/30 p-4 relative flex flex-col justify-between overflow-hidden">
                <div className="absolute inset-0 bg-radial-at-c from-orbit-violet/10 via-transparent to-transparent pointer-events-none"></div>
                <div className="flex items-center justify-between z-10">
                  <div className="px-3 py-1 rounded-lg bg-orbit-violet/20 border border-orbit-violet/40 text-xs font-semibold text-purple-200 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-orbit-violet animate-pulse" />
                    Prof. Sarah Chen (Teacher Host)
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-xs text-emerald-400 border border-white/10">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    Broadcasting HD
                  </div>
                </div>

                {/* Simulated center teaching graphics */}
                <div className="flex flex-col items-center justify-center my-auto text-center z-10">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-orbit-violet to-indigo-600 flex items-center justify-center shadow-xl shadow-orbit-violet/30 mb-4 animate-float">
                    <Orbit className="w-12 h-12 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">Orbital Mechanics Lecture & Real-Time Q&A</h3>
                  <p className="text-xs text-slate-400 max-w-sm">Screen share & presentation active. Student microphones are currently muted by policy.</p>
                </div>

                {/* Floating Admin Permission Request Notification Mock */}
                <div className="z-10 p-3 rounded-xl bg-orbit-850/95 border border-orbit-violet/40 shadow-2xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-sm">
                      AC
                    </div>
                    <div className="text-left text-xs">
                      <p className="text-white font-medium">Alice Cooper requested <span className="text-orbit-violet font-semibold">Microphone</span></p>
                      <p className="text-slate-400 text-[10px]">Student wants to ask a question</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold shadow hover:bg-emerald-500 cursor-pointer">
                      Approve
                    </span>
                    <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer">
                      Deny
                    </span>
                  </div>
                </div>
              </div>

              {/* Student tiles sidebar */}
              <div className="flex flex-col gap-3">
                <div className="flex-1 rounded-xl bg-orbit-900/90 border border-white/10 p-3 relative flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200">Alice Cooper</span>
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] flex items-center gap-1">
                      <MicOff className="w-3 h-3" /> Mic Locked
                    </span>
                  </div>
                  <div className="flex items-center justify-center my-auto">
                    <div className="w-12 h-12 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-slate-300 font-semibold text-sm">
                      AC
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center justify-between">
                    <span>Student Participant</span>
                    <span className="text-amber-400">Awaiting mic review</span>
                  </div>
                </div>

                <div className="flex-1 rounded-xl bg-orbit-900/90 border border-white/10 p-3 relative flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200">David Miller</span>
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] flex items-center gap-1">
                      <VideoOff className="w-3 h-3" /> Cam Off
                    </span>
                  </div>
                  <div className="flex items-center justify-center my-auto">
                    <div className="w-12 h-12 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-slate-300 font-semibold text-sm">
                      DM
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center justify-between">
                    <span>Student Participant</span>
                    <span className="text-slate-400">Listening</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Architectural Pillars */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 border-t border-white/5 bg-orbit-900/40">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-semibold tracking-widest text-orbit-violet uppercase mb-3">
              ZERO DISTRACTIONS, COMPLETE AUTHORITY
            </h2>
            <h3 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Engineered specifically for focused online education
            </h3>
            <p className="text-slate-400 text-sm sm:text-base">
              Standard video conferencing tools grant everyone broadcast privileges by default, leading to noise and interruptions. ClassOrbit reverses this model completely.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1 */}
            <div className="p-6 rounded-2xl glass-card transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-orbit-violet mb-5">
                <MicOff className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Default-Muted Media</h4>
              <p className="text-sm text-slate-400 leading-relaxed">
                Students enter with microphone, webcam, and screen sharing publishing capabilities strictly disabled on the SFU server level.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-6 rounded-2xl glass-card transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-5">
                <Sliders className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Independent Permissions</h4>
              <p className="text-sm text-slate-400 leading-relaxed">
                Approve voice questions without exposing webcams. Grant screen sharing for presentations without authorizing microphone if needed.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-6 rounded-2xl glass-card transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-5">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Zero-Friction Joining</h4>
              <p className="text-sm text-slate-400 leading-relaxed">
                No registrations, emails, or student accounts required. Students enter an invitation link and display name to immediately join.
              </p>
            </div>

            {/* Card 4 */}
            <div className="p-6 rounded-2xl glass-card transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-5">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Instant Moderation</h4>
              <p className="text-sm text-slate-400 leading-relaxed">
                One-click permission revocation halts client media tracks immediately. Remove disruptive users or end the classroom securely.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Security Architecture Deep Dive */}
      <section id="security" className="py-24 px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-4">
                <Lock className="w-3.5 h-3.5" />
                <span>SERVER-AUTHORITATIVE ARCHITECTURE</span>
              </div>
              <h3 className="text-3xl sm:text-4xl font-bold text-white mb-6">
                Enforced by Server Cryptography, Not Client Logic
              </h3>
              <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-6">
                Most platforms merely hide the "Mute" icon on the client side. If a curious student inspects the browser console, they can stream unauthorized audio.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-sm font-semibold text-white">LiveKit SFU Permission Grants</h5>
                    <p className="text-xs text-slate-400">Tokens are signed with <code className="text-orbit-violet">canPublish: false</code> until explicitly approved by the instructor.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-sm font-semibold text-white">Opaque Participant Identifiers</h5>
                    <p className="text-xs text-slate-400">Temporary cryptographic sessions avoid storing personally identifiable information in permanent databases.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-sm font-semibold text-white">Tamper-Proof Moderation Audit Trail</h5>
                    <p className="text-xs text-slate-400">All joins, permission requests, approvals, revocations, and terminations are recorded with timestamps.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl glass-panel p-6 border border-white/10 font-mono text-xs">
              <div className="flex items-center justify-between pb-4 border-b border-white/10 text-slate-400">
                <span className="text-orbit-violet font-bold">ClassOrbit Security Flow</span>
                <span>strict_mode = true</span>
              </div>
              <div className="py-4 space-y-3">
                <div className="p-3 rounded-xl bg-orbit-900 border border-white/5">
                  <span className="text-slate-500">[1] Student requests join</span>
                  <div className="text-slate-300">GET /api/invitations/validate/:code &rarr; valid</div>
                  <div className="text-cyan-400">POST /api/invitations/join &rarr; 201 Created</div>
                </div>
                <div className="p-3 rounded-xl bg-orbit-900 border border-white/5">
                  <span className="text-slate-500">[2] Server issues token with restricted grants</span>
                  <div className="text-emerald-400">grant: &#123; canPublish: false, sources: [] &#125;</div>
                </div>
                <div className="p-3 rounded-xl bg-orbit-900 border border-white/5">
                  <span className="text-slate-500">[3] Student requests microphone</span>
                  <div className="text-amber-400">emit: 'permission:requested' (MIC)</div>
                  <div className="text-slate-300">Teacher notified on real-time channel</div>
                </div>
                <div className="p-3 rounded-xl bg-orbit-900 border border-white/5">
                  <span className="text-slate-500">[4] Teacher clicks Approve</span>
                  <div className="text-purple-300">LiveKit.updateParticipant(canPublishSources: [MIC])</div>
                  <div className="text-emerald-400">Student local mic unlocked with deliberate toggle</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Bottom Banner */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-white/5 text-center">
        <div className="max-w-4xl mx-auto p-10 rounded-3xl glass-panel border border-orbit-violet/30 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-orbit-violet/20 blur-[100px] pointer-events-none rounded-full"></div>
          <h3 className="text-3xl font-extrabold text-white mb-4">Ready to command your digital classroom?</h3>
          <p className="text-slate-400 max-w-xl mx-auto mb-8 text-sm">
            Launch your secure classroom in seconds. Share the invitation link with your students and enjoy completely uninterrupted lectures.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/admin/login"
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-orbit-violet to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-orbit-violet/30 transition flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              <span>Launch Teacher Console</span>
            </Link>
            <button
              onClick={() => setShowJoinModal(true)}
              className="px-8 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-semibold transition"
            >
              <span>Join via Invitation Link</span>
            </button>
          </div>
        </div>
      </section>

      <Footer />
      {showJoinModal && <JoinModal onClose={() => setShowJoinModal(false)} />}
    </div>
  );
}
