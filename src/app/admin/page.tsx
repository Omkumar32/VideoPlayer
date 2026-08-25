'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Video, Plus, Link as LinkIcon, Mail, Calendar, Eye, Shield, Lock, Copy, Check,
  RotateCcw, Ban, Activity, RefreshCw, Smartphone, KeyRound, ExternalLink, Play, CheckCircle2,
  Upload, FileVideo, CheckSquare, Square
} from 'lucide-react';

interface SecureVideo {
  id: string;
  title: string;
  storageKey: string;
  description: string;
  duration?: string;
  fileSize?: string;
  createdAt: string;
}

interface VideoAccessRecord {
  id: string;
  videoId: string;
  videoTitle: string;
  userEmail: string;
  accessTokenHash: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'revoked';
  maxViews: number | null;
  viewCount: number;
  registeredDeviceFingerprint: string | null;
  registeredDeviceInfo: {
    userAgent?: string;
    screenResolution?: string;
    boundAt?: string;
  } | null;
  createdAt: string;
  lastAccessedAt: string | null;
  activeOTP?: string | null;
}

interface AccessLog {
  id: string;
  accessRecordId: string;
  userEmail: string;
  event: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  details?: string;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'LINKS' | 'VIDEOS' | 'LOGS'>('LINKS');
  const [videos, setVideos] = useState<SecureVideo[]>([]);
  const [accessRecords, setAccessRecords] = useState<VideoAccessRecord[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State: Generate Link (Supports Multi-Select Video IDs)
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [userEmailInput, setUserEmailInput] = useState('');
  const [expirationInput, setExpirationInput] = useState('');
  const [maxViewsInput, setMaxViewsInput] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [generatedLinks, setGeneratedLinks] = useState<{ videoTitle: string; accessUrl: string }[]>([]);
  const [copiedUrlIndex, setCopiedUrlIndex] = useState<number | null>(null);

  // Form State: Add / Upload Video
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [presetStorageKey, setPresetStorageKey] = useState('sample_product_training.mp4');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [vRes, aRes, lRes] = await Promise.all([
        fetch('/api/admin/videos'),
        fetch('/api/admin/tokens'),
        fetch('/api/admin/logs'),
      ]);

      const vData = await vRes.json();
      const aData = await aRes.json();
      const lData = await lRes.json();

      if (vData.videos) {
        setVideos(vData.videos);
        if (vData.videos.length > 0 && selectedVideoIds.length === 0) {
          const first = vData.videos[0];
          setSelectedVideoIds([first.id || first._id?.toString() || '']);
        }
      }
      if (aData.records) setAccessRecords(aData.records);
      if (lData.logs) setLogs(lData.logs);
    } catch (err) {
      console.error('Failed to load CMS data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Default expiration: 7 days from now
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setExpirationInput(d.toISOString().slice(0, 16));
  }, []);

  // Multi-Select Video Toggle Handler
  const toggleVideoSelection = (id: string) => {
    if (selectedVideoIds.includes(id)) {
      if (selectedVideoIds.length > 1) {
        setSelectedVideoIds(selectedVideoIds.filter((vId) => vId !== id));
      }
    } else {
      setSelectedVideoIds([...selectedVideoIds, id]);
    }
  };

  const selectAllVideos = () => {
    const allIds = videos.map((v: any) => v.id || v._id?.toString());
    setSelectedVideoIds(allIds);
  };

  // Handle Generate Link for Selected Videos
  const handleGenerateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setGeneratedLinks([]);

    const targetIds = selectedVideoIds.length > 0 
      ? selectedVideoIds 
      : (videos.length > 0 ? [videos[0].id || (videos[0] as any)._id?.toString()] : []);

    if (targetIds.length === 0 || !userEmailInput || !expirationInput) {
      setFormError('Please select at least one video, enter a user email, and pick an expiration date.');
      return;
    }

    try {
      const res = await fetch('/api/admin/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoIds: targetIds,
          userEmail: userEmailInput,
          expiresAt: expirationInput,
          maxViews: maxViewsInput ? parseInt(maxViewsInput, 10) : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to generate link.');
        return;
      }

      if (data.links && data.links.length > 0) {
        const fullLinks = data.links.map((l: any) => ({
          videoTitle: l.videoTitle,
          accessUrl: `${window.location.origin}${l.accessUrl}`,
        }));
        setGeneratedLinks(fullLinks);
        setFormSuccess(`Successfully generated ${fullLinks.length} secure access link(s) for ${userEmailInput}!`);
      }
      setUserEmailInput('');
      fetchData();
    } catch (err: any) {
      setFormError('Error generating secure link.');
    }
  };

  // Handle Upload / Create Video
  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) {
      alert('Please enter a video title');
      return;
    }

    setUploading(true);
    setUploadSuccessMsg('');

    try {
      const formData = new FormData();
      formData.append('title', newTitle);
      formData.append('description', newDesc);

      if (uploadFile) {
        formData.append('file', uploadFile);
      } else {
        formData.append('storageKey', presetStorageKey);
      }

      const res = await fetch('/api/admin/videos', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setNewTitle('');
        setNewDesc('');
        setUploadFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setUploadSuccessMsg(`Video "${data.video.title}" uploaded and stored in public/videos!`);
        fetchData();
      } else {
        alert(data.error || 'Failed to upload video');
      }
    } catch (e) {
      console.error('Failed to upload video', e);
      alert('Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  // Record Action: Reset Device or Revoke
  const handleRecordAction = async (recordId: string, action: 'reset_device' | 'revoke' | 'reactivate') => {
    try {
      const res = await fetch('/api/admin/tokens', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId, action }),
      });
      const data = await res.json();
      if (res.ok) {
        fetchData();
      } else {
        alert(data.error || 'Action failed');
      }
    } catch (e) {
      alert('Error updating record');
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedUrlIndex(index);
    setTimeout(() => setCopiedUrlIndex(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 sm:p-8">
      {/* Top Header */}
      <header className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono">
              Solution 2 Engine
            </span>
            <span className="text-xs text-slate-500">SHA-256 Hashing & Device Binding</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Secure Video CMS Admin
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition flex items-center gap-2 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Generator Form with Multi-Video Select (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <LinkIcon className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Generate Secure Video Links</h2>
                <p className="text-xs text-slate-400">Select one or multiple videos to assign</p>
              </div>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                {formError}
              </div>
            )}

            {formSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleGenerateLink} className="space-y-4">
              {/* Multi-Select Video Checkbox List */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Select Confidential Videos (Multi-Select)
                  </label>
                  <button
                    type="button"
                    onClick={selectAllVideos}
                    className="text-[11px] text-indigo-400 hover:underline"
                  >
                    Select All
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  {videos.map((v: any) => {
                    const val = v.id || v._id?.toString();
                    const isSelected = selectedVideoIds.includes(val);
                    return (
                      <div
                        key={val}
                        onClick={() => toggleVideoSelection(val)}
                        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-indigo-950/60 border-indigo-500/60 text-white'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600 shrink-0" />
                          )}
                          <span className="truncate font-medium">{v.title}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-2">{v.fileSize || 'MP4'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Authorized Prospect / User Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={userEmailInput}
                    onChange={(e) => setUserEmailInput(e.target.value)}
                    placeholder="e.g. rahul@gmail.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Expiration Date
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={expirationInput}
                    onChange={(e) => setExpirationInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Max Views (Optional)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={maxViewsInput}
                    onChange={(e) => setMaxViewsInput(e.target.value)}
                    placeholder="Unlimited"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-semibold py-2.5 px-4 rounded-xl text-xs shadow-lg shadow-indigo-600/25 transition flex items-center justify-center gap-2"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Generate {selectedVideoIds.length > 1 ? `${selectedVideoIds.length} Links` : 'Secure Access Link'}</span>
              </button>
            </form>

            {/* Generated Links List Display */}
            {generatedLinks.length > 0 && (
              <div className="mt-5 p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30 space-y-3">
                <div className="text-xs text-indigo-300 font-semibold flex items-center justify-between">
                  <span>Generated Access Links ({generatedLinks.length})</span>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {generatedLinks.map((item, idx) => (
                    <div key={idx} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
                      <div className="text-[11px] font-semibold text-slate-200 truncate">{item.videoTitle}</div>
                      <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
                        <span className="truncate mr-2">{item.accessUrl}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <a
                            href={item.accessUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-400"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <button
                            onClick={() => copyToClipboard(item.accessUrl, idx)}
                            className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
                          >
                            {copiedUrlIndex === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Upload Panel & Tabbed Lists (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <button
              onClick={() => setActiveTab('LINKS')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                activeTab === 'LINKS'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Active Access Links ({accessRecords.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('VIDEOS')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                activeTab === 'VIDEOS'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Upload & Video Library ({videos.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('LOGS')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                activeTab === 'LOGS'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Audit Access Logs ({logs.length})</span>
            </button>
          </div>

          {/* TAB 1: ACCESS LINKS */}
          {activeTab === 'LINKS' && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Generated Video Access Records</h3>
                <span className="text-xs text-slate-400">Solution 2 Device Binding Dashboard</span>
              </div>

              {accessRecords.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No access links generated yet. Select videos on the left to create one.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 overflow-x-auto">
                  {accessRecords.map((r) => {
                    const isExpired = new Date() > new Date(r.expiresAt) || r.status === 'expired';
                    return (
                      <div key={r.id} className="p-4 hover:bg-slate-800/40 transition space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white">{r.videoTitle}</span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  r.status === 'revoked'
                                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                    : isExpired
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                }`}
                              >
                                {r.status === 'revoked' ? 'REVOKED' : isExpired ? 'EXPIRED' : 'ACTIVE'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                              <span className="flex items-center gap-1 text-slate-200">
                                <Mail className="w-3 h-3 text-indigo-400" /> {r.userEmail}
                              </span>
                              <span>•</span>
                              <span>Expires: {new Date(r.expiresAt).toLocaleDateString()}</span>
                              <span>•</span>
                              <span>Views: {r.viewCount} {r.maxViews ? `/ ${r.maxViews}` : ''}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {r.registeredDeviceFingerprint ? (
                              <button
                                onClick={() => handleRecordAction(r.id, 'reset_device')}
                                className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition flex items-center gap-1.5"
                                title="Reset bound device to allow re-verification on new device"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Reset Device</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-500 italic px-2 py-1 bg-slate-950 rounded border border-slate-800">
                                Unbound Device
                              </span>
                            )}

                            {r.status === 'active' ? (
                              <button
                                onClick={() => handleRecordAction(r.id, 'revoke')}
                                className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold transition flex items-center gap-1.5"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                <span>Revoke</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleRecordAction(r.id, 'reactivate')}
                                className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition"
                              >
                                Activate
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Device Info & Active OTP bar */}
                        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-[11px] flex flex-wrap items-center justify-between gap-2 text-slate-400">
                          <div className="flex items-center gap-2">
                            <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                            <span>
                              Device:{' '}
                              <strong className="text-slate-300">
                                {r.registeredDeviceInfo?.userAgent || 'Not verified yet'}
                              </strong>
                            </span>
                          </div>
                          {r.activeOTP && (
                            <div className="flex items-center gap-1.5 text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded font-mono">
                              <KeyRound className="w-3 h-3 text-cyan-400" />
                              <span>Latest Active OTP: <strong>{r.activeOTP}</strong></span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: UPLOAD & VIDEOS */}
          {activeTab === 'VIDEOS' && (
            <div className="space-y-6">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-800">
                  <Upload className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">Upload New Video to Public Storage (`public/videos/`)</h3>
                </div>

                {uploadSuccessMsg && (
                  <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{uploadSuccessMsg}</span>
                  </div>
                )}

                <form onSubmit={handleAddVideo} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Video Title</label>
                      <input
                        type="text"
                        required
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="e.g. Sales Onboarding 2026"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Upload Video MP4 File
                      </label>
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="video/mp4,video/*"
                        onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-300 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                    <input
                      type="text"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="Internal details..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={uploading}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition shadow flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {uploading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>Upload Video to public/videos & Add Entry</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Video Assets List */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">All Videos in Storage ({videos.length})</h3>
                  <span className="text-xs text-slate-400">Stored in `public/videos/`</span>
                </div>
                <div className="divide-y divide-slate-800">
                  {videos.map((v: any) => {
                    const val = v.id || v._id?.toString();
                    const isSelected = selectedVideoIds.includes(val);
                    return (
                      <div key={val} className="p-4 flex items-center justify-between hover:bg-slate-800/40 transition">
                        <div>
                          <div className="flex items-center gap-2">
                            <FileVideo className="w-4 h-4 text-indigo-400 shrink-0" />
                            <span className="font-bold text-sm text-white">{v.title}</span>
                          </div>
                          {v.description && <div className="text-xs text-slate-400 mt-1">{v.description}</div>}
                          <div className="text-[11px] text-slate-500 font-mono mt-1">
                            Storage Key: <span className="text-indigo-300">{v.storageKey}</span> | Duration: {v.duration || 'N/A'} | Size: {v.fileSize || 'N/A'}
                          </div>
                        </div>

                        <button
                          onClick={() => toggleVideoSelection(val)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-500'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                          <span>{isSelected ? 'Selected' : 'Select'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LOGS */}
          {activeTab === 'LOGS' && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Security Audit Log</h3>
                <span className="text-xs text-slate-400">Real-time access events</span>
              </div>
              <div className="divide-y divide-slate-800/60 max-h-[500px] overflow-y-auto font-mono text-xs">
                {logs.map((log) => (
                  <div key={log.id} className="p-3 hover:bg-slate-800/40 transition">
                    <div className="flex items-center justify-between text-slate-400 mb-1 text-[11px]">
                      <span className="text-indigo-400 font-semibold">{log.event}</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-slate-200">{log.details}</div>
                    <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-3">
                      <span>User: {log.userEmail}</span>
                      <span>IP: {log.ipAddress}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
