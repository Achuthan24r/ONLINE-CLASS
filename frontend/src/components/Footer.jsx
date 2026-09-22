import React from 'react';
import { Orbit, ShieldCheck, Lock, Activity, Github } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-orbit-950/90 text-slate-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-orbit-violet flex items-center justify-center text-white">
                <Orbit className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold text-white">ClassOrbit</span>
            </div>
            <p className="text-slate-400 max-w-sm mb-4 leading-relaxed">
              Enterprise-grade real-time classroom platform engineered with strict server-side media isolation, opaque participant tokens, and teacher-controlled broadcasting.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              LiveKit WebRTC & Socket.IO Core Active
            </div>
          </div>

          {/* Architecture */}
          <div>
            <h4 className="font-semibold text-white mb-3">Security</h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-orbit-violet" />
                Zero-Trust Media Tokens
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Strict Server-Side Permissions
              </li>
              <li className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                Real-Time Moderation Audit
              </li>
            </ul>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="font-semibold text-white mb-3">Portals</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/admin/login" className="hover:text-white transition">Admin Management Portal</Link>
              </li>
              <li>
                <Link to="/join" className="hover:text-white transition">Anonymous Student Join</Link>
              </li>
              <li>
                <a href="#features" className="hover:text-white transition">Feature Overview</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <p>© {new Date().getFullYear()} ClassOrbit. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span className="text-slate-500">Argon2id / Bcrypt Secure Session Authentication</span>
            <span className="text-slate-500">LiveKit Distributed SFU</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
