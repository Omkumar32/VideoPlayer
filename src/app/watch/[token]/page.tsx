'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mail, KeyRound, ShieldAlert, CheckCircle2, Lock, Smartphone, RefreshCw, Send, ShieldCheck, ArrowRight } from 'lucide-react';
import { getClientFingerprint } from '@/lib/fingerprint';
import VideoPlayer from '@/components/VideoPlayer';
import SimulatedInbox from '@/components/SimulatedInbox';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function WatchPage({ params }: PageProps) {
  const [token, setToken] = useState<string>('');
  const [emailInput, setEmailInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [step, setStep] = useState<'EMAIL_PROMPT' | 'OTP_PROMPT' | 'WATCHING' | 'BLOCKED'>('EMAIL_PROMPT');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusTitle, setStatusTitle] = useState('');
  
  const [videoMeta, setVideoMeta] = useState<{ title?: string; description?: string }>({});
  const [simulatedOtp, setSimulatedOtp] = useState<string | null>(null);
  const [authenticatedEmail, setAuthenticatedEmail] = useState('');
  const [deviceFp, setDeviceFp] = useState<string>('');

  useEffect(() => {
    params.then((p) => {
      setToken(p.token);
    });
    
    // Get device fingerprint
    const client = getClientFingerprint();
    setDeviceFp(client.fingerprint);
  }, [params]);

  // Handler 1: Submit Email
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !emailInput.includes('@')) {
      setErrorMsg('Please enter a valid registered email address.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const client = getClientFingerprint();
      const res = await fetch('/api/watch/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          email: emailInput,
          deviceFingerprint: client.fingerprint,
          deviceInfo: client.info,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.deviceBlocked) {
          setStep('BLOCKED');
          setStatusTitle('Device Authorization Failed');
          setErrorMsg(data.error || 'This video link is bound to another device.');
        } else {
          setErrorMsg(data.error || 'Access denied.');
        }
        setLoading(false);
        return;
      }

      if (data.alreadyBoundDevice) {
        // Direct access granted
        setAuthenticatedEmail(emailInput.toLowerCase().trim());
        setVideoMeta({ title: data.videoTitle, description: data.videoDescription });
        setStep('WATCHING');
      } else if (data.requiresOTP) {
        setSimulatedOtp(data.simulatedOTP);
        setAuthenticatedEmail(emailInput.toLowerCase().trim());
        setVideoMeta({ title: data.videoTitle });
        setStep('OTP_PROMPT');
      }
    } catch (err: any) {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handler 2: Submit OTP
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpInput || otpInput.trim().length < 4) {
      setErrorMsg('Please enter the verification code sent to your email.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const client = getClientFingerprint();
      const res = await fetch('/api/watch/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          email: authenticatedEmail,
          otpCode: otpInput.trim(),
          deviceFingerprint: client.fingerprint,
          deviceInfo: client.info,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Invalid verification code.');
        setLoading(false);
        return;
      }

      setVideoMeta({ title: data.videoTitle, description: data.videoDescription });
      setStep('WATCHING');
    } catch (err: any) {
      setErrorMsg('Failed to verify OTP. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const client = getClientFingerprint();
      const res = await fetch('/api/watch/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          email: authenticatedEmail,
          deviceFingerprint: client.fingerprint,
          deviceInfo: client.info,
        }),
      });
      const data = await res.json();
      if (res.ok && data.simulatedOTP) {
        setSimulatedOtp(data.simulatedOTP);
        setErrorMsg('');
        alert(`New OTP sent to ${authenticatedEmail}!`);
      }
    } catch (e) {
      setErrorMsg('Failed to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* Background Glow Accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Header / Navigation */}
      <header className="absolute top-0 left-0 right-0 p-4 sm:p-6 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md z-20">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Lock className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <h1 className="font-bold tracking-tight text-white text-base sm:text-lg flex items-center gap-2">
              Tridiagonal <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30">Secure Player</span>
            </h1>
            <p className="text-xs text-slate-400">Encrypted Token Access & Device Binding</p>
          </div>
        </div>

        <a
          href="/admin"
          className="text-xs font-semibold px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700/60 flex items-center gap-1.5"
        >
          <span>Admin CMS</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </header>

      {/* Main Content Card Container */}
      <main className="w-full max-w-4xl z-10 mt-16 sm:mt-12">
        {step === 'EMAIL_PROMPT' && (
          <div className="max-w-md mx-auto bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl transition-all">
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-white">Confidential Video Protection</h2>
              <p className="text-sm text-slate-400 mt-1">
                Enter your registered email address to request access to this private stream.
              </p>
            </div>

            {errorMsg && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>{errorMsg}</div>
              </div>
            )}

            <form onSubmit={handleVerifyEmail} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Registered Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="e.g. rahul@gmail.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Verify Authorized Email</span>
                    <Send className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
              <div className="text-[11px] text-slate-500 space-y-1">
                <p>Protected by SHA-256 token hashing & device fingerprint binding.</p>
                <p className="font-mono text-[10px] text-slate-600">Token Hash: {token.substring(0, 12)}...</p>
              </div>
            </div>
          </div>
        )}

        {step === 'OTP_PROMPT' && (
          <div className="max-w-md mx-auto bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl transition-all">
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <KeyRound className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-white">Enter Security OTP Code</h2>
              <p className="text-sm text-slate-400 mt-1">
                We sent a 6-digit verification code to <span className="text-indigo-300 font-semibold">{authenticatedEmail}</span>
              </p>
            </div>

            {errorMsg && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>{errorMsg}</div>
              </div>
            )}

            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 text-center">
                  6-Digit OTP Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  placeholder="123456"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-center text-2xl tracking-[0.5em] font-mono text-cyan-300 placeholder-slate-700 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Authenticate & Bind Device</span>
                    <Smartphone className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 flex items-center justify-between text-xs text-slate-400">
              <button
                type="button"
                onClick={() => setStep('EMAIL_PROMPT')}
                className="hover:text-white transition"
              >
                ← Change Email
              </button>
              <button
                type="button"
                onClick={handleResendOTP}
                className="text-cyan-400 hover:underline transition"
              >
                Resend Code
              </button>
            </div>
          </div>
        )}

        {step === 'BLOCKED' && (
          <div className="max-w-md mx-auto bg-slate-900/90 border border-red-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{statusTitle || '403 Access Forbidden'}</h2>
            <p className="text-sm text-slate-300 mb-6 bg-red-950/40 p-4 rounded-xl border border-red-900/40">
              {errorMsg}
            </p>

            <div className="space-y-3">
              <button
                onClick={() => setStep('EMAIL_PROMPT')}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 px-4 rounded-xl text-sm font-medium transition border border-slate-700"
              >
                Try Different Email
              </button>
              <a
                href="/admin"
                className="block text-xs text-slate-400 hover:text-indigo-400 transition py-1"
              >
                Return to Admin Console
              </a>
            </div>
          </div>
        )}

        {step === 'WATCHING' && (
          <div className="w-full space-y-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Authenticated & Bound
                    </span>
                    <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      User: {authenticatedEmail}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white">{videoMeta.title || 'Protected Video Stream'}</h2>
                  {videoMeta.description && (
                    <p className="text-sm text-slate-400 mt-1">{videoMeta.description}</p>
                  )}
                </div>
              </div>

              {/* Secure Video Player Component */}
              <VideoPlayer
                token={token}
                userEmail={authenticatedEmail}
                deviceFingerprint={deviceFp}
              />
            </div>
          </div>
        )}
      </main>

      {/* Simulated OTP Inbox Floating Drawer */}
      {simulatedOtp && step === 'OTP_PROMPT' && (
        <SimulatedInbox
          userEmail={authenticatedEmail}
          otpCode={simulatedOtp}
          onAutoFill={(code) => setOtpInput(code)}
        />
      )}
    </div>
  );
}
