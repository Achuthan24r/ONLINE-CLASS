import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowRight, KeyRound, Sparkles } from 'lucide-react';

export function JoinModal({ onClose }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleJoin = (e) => {
    e.preventDefault();
    const clean = code.trim();
    if (!clean) {
      setError('Please enter a classroom invitation code.');
      return;
    }
    // Extract code if user pasted a full URL
    let parsedCode = clean;
    if (clean.includes('/join/')) {
      parsedCode = clean.split('/join/')[1].split('?')[0].split('/')[0];
    }
    navigate(`/join/${parsedCode}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl glass-panel p-6 shadow-2xl border border-white/10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Join a Classroom</h3>
            <p className="text-xs text-slate-400">No account or password needed</p>
          </div>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Invitation Code or Link
            </label>
            <input
              type="text"
              placeholder="e.g. orb-8f2a-9e1b or paste invite URL"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError('');
              }}
              autoFocus
              className="w-full px-4 py-3 rounded-xl bg-orbit-900 border border-white/15 text-white placeholder-slate-500 focus:outline-none focus:border-orbit-violet focus:ring-1 focus:ring-orbit-violet transition text-sm font-mono"
            />
            {error && <p className="text-xs text-rose-400 mt-1.5">{error}</p>}
          </div>

          <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs text-slate-400 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-orbit-violet shrink-0 mt-0.5" />
            <span>
              You will be prompted for your preferred display name before entering. Media access is controlled by the teacher.
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 transition flex items-center gap-2"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
