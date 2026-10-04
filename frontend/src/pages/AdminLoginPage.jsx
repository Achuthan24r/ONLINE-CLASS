import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Orbit, Lock, User, ArrowRight, ShieldCheck, KeyRound, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { login } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Please provide both username and password.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      await login(username.trim(), password);
      success('Logged in successfully as Administrator.', 'Welcome Back');
      navigate('/admin/dashboard');
    } catch (err) {
      const msg = err.message || 'Authentication failed. Please check your credentials.';
      setErrorMessage(msg);
      error(msg, 'Login Failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setUsername('admin');
    setPassword('OrbitAdmin2025!');
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen flex flex-col bg-orbit-950 text-slate-100">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-16 relative overflow-hidden">
        {/* Glow ambient */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orbit-violet/15 blur-[120px] pointer-events-none rounded-full" />

        <div className="w-full max-w-md relative z-10">
          <div className="rounded-2xl glass-panel p-8 shadow-2xl border border-white/10">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orbit-violet to-indigo-600 p-[1px] shadow-lg shadow-orbit-violet/25 mx-auto mb-4">
                <div className="w-full h-full bg-orbit-950 rounded-[15px] flex items-center justify-center">
                  <Lock className="w-7 h-7 text-orbit-violet" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">Teacher & Admin Portal</h2>
              <p className="text-xs text-slate-400">
                Authenticate to manage classrooms, grant broadcasting permissions, and moderate attendees.
              </p>
            </div>

            {/* Error banner */}
            {errorMessage && (
              <div className="mb-6 p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/30 text-rose-200 text-xs leading-relaxed animate-fade-in flex items-start gap-2.5">
                <div className="w-2 h-2 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Admin Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. admin"
                    autoComplete="username"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-orbit-900 border border-white/15 text-white placeholder-slate-500 focus:outline-none focus:border-orbit-violet focus:ring-1 focus:ring-orbit-violet transition text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-orbit-900 border border-white/15 text-white placeholder-slate-500 focus:outline-none focus:border-orbit-violet focus:ring-1 focus:ring-orbit-violet transition text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3.5 rounded-xl bg-gradient-to-r from-orbit-violet to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-orbit-violet/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Helper */}
            <div className="mt-6 pt-6 border-t border-white/10">
              <button
                type="button"
                onClick={fillDemoCredentials}
                className="w-full py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-orbit-violet" />
                <span>Click to auto-fill default admin credentials</span>
              </button>
            </div>

            <div className="mt-4 text-center">
              <span className="text-[11px] text-slate-500">
                Students do not need credentials.{' '}
                <Link to="/join" className="text-cyan-400 hover:underline">
                  Join via invitation link here
                </Link>
              </span>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
