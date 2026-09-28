import React, { useState, useEffect } from 'react';
import { Shield, Flame, CheckCircle, Sparkles, Zap } from 'lucide-react';

/**
 * GarenaSplashLoader
 * Ultra-premium, esports-grade splash screen loader.
 * Plays on initial site load / reload with high-tech Garena branding,
 * rotating HUD rings, glowing flame aura, and progressive status stream.
 */
export default function GarenaSplashLoader({ onFinished, minDisplayMs = 1400 }) {
  const [progress, setProgress] = useState(12);
  const [statusText, setStatusText] = useState("INITIALIZING FREE FIRE ESCROW CORE...");
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const startTime = Date.now();

    // Staged progress ticker
    const timer1 = setTimeout(() => {
      setProgress(42);
      setStatusText("SECURING FREE FIRE PROTOCOLS...");
    }, 350);

    const timer2 = setTimeout(() => {
      setProgress(78);
      setStatusText("VERIFYING OFFICIAL FREE FIRE NETWORK...");
    }, 750);

    const timer3 = setTimeout(() => {
      setProgress(100);
      setStatusText("FREE FIRE OFFICIAL CORE VERIFIED • ACCESS GRANTED");
    }, 1150);

    const timer4 = setTimeout(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, minDisplayMs - elapsed);

      setTimeout(() => {
        setExiting(true);
        setTimeout(() => {
          if (onFinished) onFinished();
        }, 380);
      }, remaining);
    }, 1250);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [minDisplayMs, onFinished]);

  return (
    <div 
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#07080c] select-none overflow-hidden transition-all duration-400 ${
        exiting ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Dynamic Cyber Gaming Background Grid & Embers - Low Green */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(16, 185, 129, 0.12) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(16, 185, 129, 0.12) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(circle at center, black 40%, transparent 85%)'
        }}
      />

      {/* Cyber Radiant Low Green Core Glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-emerald-600/20 via-teal-600/15 to-green-500/5 blur-[110px] pointer-events-none animate-pulse" />

      {/* Center Gaming Logo Rig */}
      <div className="relative z-10 flex flex-col items-center space-y-7 max-w-sm px-6 text-center">
        
        {/* Animated HUD Emblem Holder */}
        <div className="relative flex items-center justify-center w-36 h-36">
          
          {/* Outer Rotating Cyber Ring 1 (Clockwise) */}
          <div 
            className="absolute inset-0 rounded-full border-2 border-emerald-500/40 border-dashed animate-spin pointer-events-none"
            style={{ animationDuration: '9s' }}
          />

          {/* Counter Rotating Ring 2 (Anti-clockwise with emerald accents) */}
          <div 
            className="absolute -inset-3 rounded-full border border-teal-500/30 border-t-emerald-400 border-b-teal-600 animate-spin pointer-events-none"
            style={{ animationDuration: '6s', animationDirection: 'reverse' }}
          />

          {/* Garena Glowing Hexagon / Shield Base - Low Green Cyber */}
          <div className="relative w-28 h-28 rounded-3xl bg-gradient-to-b from-[#071c14] via-[#04140e] to-[#020b08] border-2 border-emerald-500/65 flex items-center justify-center shadow-[0_0_45px_rgba(16,185,129,0.35)] p-4 group">
            {/* Ambient Green Shine */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-emerald-600/25 to-teal-400/15 opacity-80 blur-sm pointer-events-none" />
            
            {/* Free Fire Official Logo */}
            <img 
              src="/garena-logo.png" 
              alt="Free Fire Official" 
              className="relative z-10 w-full h-full object-contain filter drop-shadow-[0_0_16px_rgba(16,185,129,0.65)] transform transition-transform duration-500 scale-105"
            />
          </div>

          {/* Top Corner Official Garena Watermark Badge */}
          <div className="absolute -top-1 -right-1 z-20 flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-[8px] font-black text-white uppercase tracking-widest shadow-lg shadow-emerald-600/40 border border-white/20">
            <Flame className="w-2.5 h-2.5 fill-white" />
            <span>VIP</span>
          </div>
        </div>

        {/* Brand Text Header */}
        <div className="space-y-1.5 pt-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-[10px] font-black uppercase tracking-widest shadow-sm">
            <Shield className="w-3 h-3 text-emerald-400 fill-emerald-400/20" />
            <span>FREE FIRE OFFICIAL NETWORK</span>
          </div>

          <h1 className="text-3xl font-black uppercase tracking-tight text-white flex items-center justify-center gap-1">
            <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent drop-shadow-sm">
              FREE FIRE
            </span>
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-green-400 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(16,185,129,0.6)]">
              OFFICIAL
            </span>
          </h1>

          <p className="text-[11px] font-bold text-gray-400 tracking-wider uppercase opacity-90">
            Official Free Fire ID & Escrow Marketplace
          </p>
        </div>

        {/* Cyber Loading Progress Bar & Status Text */}
        <div className="w-full space-y-2 pt-2">
          {/* Progress Bar Track */}
          <div className="relative w-full h-2 rounded-full bg-gray-900 border border-emerald-500/30 overflow-hidden shadow-inner p-0.5">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.7)] transition-all duration-300 ease-out relative"
              style={{ width: `${progress}%` }}
            >
              {/* Laser Front Edge Glow */}
              <div className="absolute right-0 top-0 bottom-0 w-2.5 bg-white rounded-full blur-[1px] animate-pulse" />
            </div>
          </div>

          {/* Status Details & Percentage */}
          <div className="flex items-center justify-between text-[10px] font-mono tracking-wider">
            <span className="text-emerald-400 font-bold flex items-center gap-1.5 truncate max-w-[240px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
              <span>{statusText}</span>
            </span>
            <span className="text-teal-300 font-black shrink-0">
              {progress}%
            </span>
          </div>
        </div>

      </div>

      {/* Footer Ecosystem Watermark */}
      <div className="absolute bottom-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500/80">
        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
        <span>Free Fire Official Secure Ecosystem 2026</span>
      </div>
    </div>
  );
}
