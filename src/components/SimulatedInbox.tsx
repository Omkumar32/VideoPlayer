'use client';

import React, { useState } from 'react';
import { Mail, KeyRound, Copy, Check, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface SimulatedInboxProps {
  userEmail: string;
  otpCode: string;
  onAutoFill: (code: string) => void;
}

export default function SimulatedInbox({ userEmail, otpCode, onAutoFill }: SimulatedInboxProps) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleCopy = () => {
    navigator.clipboard.writeText(otpCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full font-sans transition-all duration-300">
      <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl">
        {/* Header */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-3 px-4 flex items-center justify-between cursor-pointer border-b border-cyan-500/20"
        >
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Simulated Mail Server Inbox
            </span>
          </div>
          <button className="text-slate-400 hover:text-white">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {isExpanded && (
          <div className="p-4 space-y-3 bg-slate-950/80">
            <div className="text-[11px] text-slate-400 flex items-center justify-between border-b border-slate-800 pb-2">
              <span>To: <strong className="text-slate-200">{userEmail}</strong></span>
              <span className="text-slate-500 font-mono">Just now</span>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-200">Subject: Your Video Access Verification Code</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Your one-time passcode for secure video streaming access is:
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
              <span className="text-2xl font-mono font-bold tracking-widest text-cyan-300">
                {otpCode}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition border border-slate-700"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={() => onAutoFill(otpCode)}
                  className="px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition flex items-center gap-1 shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto-Fill</span>
                </button>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 italic text-center">
              (This panel simulates real SMTP email receipt for quick test workflows)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
