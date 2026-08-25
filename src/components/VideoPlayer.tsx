'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Shield, AlertTriangle, Eye, Lock } from 'lucide-react';

interface VideoPlayerProps {
  token: string;
  userEmail: string;
  deviceFingerprint: string;
}

export default function VideoPlayer({ token, userEmail, deviceFingerprint }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [errorDetails, setErrorDetails] = useState('');

  // Anti-screen capture dynamic moving watermark coordinates
  const [watermarkPos, setWatermarkPos] = useState({ top: '15%', left: '20%' });

  // Stream URL points to private API route using token
  const streamUrl = `/api/stream/${token}`;

  useEffect(() => {
    // Move watermark randomly every 4 seconds to deter screen recording tools
    const interval = setInterval(() => {
      const top = Math.floor(Math.random() * 70 + 10) + '%';
      const left = Math.floor(Math.random() * 60 + 15) + '%';
      setWatermarkPos({ top, left });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch((err) => {
        setHasError(true);
        setErrorDetails('Unable to initiate stream playback.');
      });
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 1;
    setCurrentTime(cur);
    setDuration(dur);
    setProgress((cur / dur) * 100);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const seekTime = (parseFloat(e.target.value) / 100) * duration;
    videoRef.current.currentTime = seekTime;
    setProgress(parseFloat(e.target.value));
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      className="relative rounded-xl overflow-hidden bg-black border border-slate-800 shadow-2xl group select-none"
      onContextMenu={(e) => e.preventDefault()} // Disable right click context menu
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={streamUrl}
        className="w-full aspect-video object-contain bg-black cursor-pointer"
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        onError={(e) => {
          setHasError(true);
          setErrorDetails('Stream access restricted or invalid headers.');
        }}
        controlsList="nodownload no-remote-playback"
        disablePictureInPicture
        playsInline
      />

      {/* Security Watermark Overlay */}
      <div
        className="absolute transition-all duration-1000 ease-in-out pointer-events-none z-20 opacity-40 hover:opacity-75"
        style={{ top: watermarkPos.top, left: watermarkPos.left }}
      >
        <div className="bg-slate-950/80 border border-slate-700/60 px-3 py-1.5 rounded-md backdrop-blur-sm text-[11px] font-mono text-slate-300 shadow-lg flex items-center gap-1.5">
          <Shield className="w-3 h-3 text-cyan-400 shrink-0" />
          <span>CONFIDENTIAL | Authorized for: <strong className="text-white">{userEmail}</strong></span>
        </div>
      </div>

      {/* Custom Control Overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 transition-opacity duration-300 opacity-90 group-hover:opacity-100 flex flex-col gap-2 z-30">
        {/* Progress Bar */}
        <div className="relative w-full flex items-center">
          <input
            type="range"
            min="0"
            max="100"
            value={progress || 0}
            onChange={handleSeek}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
          />
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between text-xs font-mono text-slate-300 mt-1">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="p-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white transition flex items-center justify-center shadow"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
            </button>

            <button onClick={toggleMute} className="p-1.5 hover:text-white transition">
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <span>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Protected Chunk Streaming</span>
          </div>
        </div>
      </div>

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-40">
          <AlertTriangle className="w-12 h-12 text-red-400 mb-3" />
          <h3 className="text-lg font-bold text-white mb-1">Stream Load Error</h3>
          <p className="text-xs text-slate-400 max-w-sm mb-4">{errorDetails || 'Protected video stream could not be loaded.'}</p>
          <button
            onClick={() => {
              setHasError(false);
              if (videoRef.current) videoRef.current.load();
            }}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition"
          >
            Retry Connection
          </button>
        </div>
      )}
    </div>
  );
}
