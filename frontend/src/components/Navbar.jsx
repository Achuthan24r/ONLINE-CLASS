import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Orbit, ShieldCheck, LogIn, LayoutDashboard, LogOut, ArrowRight, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { JoinModal } from './JoinModal';

export function Navbar() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [showJoinModal, setShowJoinModal] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-orbit-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-orbit-violet via-indigo-500 to-cyan-400 p-[1px] shadow-lg shadow-orbit-violet/20 group-hover:shadow-orbit-violet/40 transition">
              <div className="w-full h-full bg-orbit-950 rounded-[11px] flex items-center justify-center">
                <Orbit className="w-6 h-6 text-orbit-violet group-hover:rotate-45 transition-transform duration-500" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  ClassOrbit
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orbit-violet/10 border border-orbit-violet/30 text-orbit-violet">
                  Secure
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Admin-Controlled Teaching</p>
            </div>
          </Link>

          {/* Navigation links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <Link to="/#features" className="hover:text-white transition">Capabilities</Link>
            <Link to="/#security" className="hover:text-white transition flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Zero-Trust Media
            </Link>
            <button
              onClick={() => setShowJoinModal(true)}
              className="hover:text-white transition flex items-center gap-1 text-slate-300 hover:text-cyan-400"
            >
              Enter Code
            </button>
          </nav>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowJoinModal(true)}
              className="px-4 py-2 text-sm font-medium rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-white/10 hover:border-white/20 transition flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4 text-cyan-400" />
              <span>Join a Class</span>
            </button>

            {admin ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/admin/dashboard"
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-orbit-violet to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-orbit-violet/25 transition flex items-center gap-2"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Link>
                <button
                  onClick={async () => {
                    await logout();
                    navigate('/');
                  }}
                  title="Logout"
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition border border-transparent hover:border-rose-500/20"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                to="/admin/login"
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-orbit-violet to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-orbit-violet/25 hover:shadow-orbit-violet/40 transition flex items-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>Admin Login</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {showJoinModal && <JoinModal onClose={() => setShowJoinModal(false)} />}
    </>
  );
}
