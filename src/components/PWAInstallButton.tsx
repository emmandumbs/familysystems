import React, { useState } from 'react';
import { Download, Smartphone, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running inside standalone PWA window, suppress button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop PWA prompt
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-[#C39A60] hover:bg-[#b08850] text-[#0A1E19] text-xs font-semibold shadow-xs transition-all cursor-pointer border border-[#E7D1AA]/40"
        title="Install FamilyOS app for full offline access"
      >
        <Download className="w-3.5 h-3.5 stroke-[2.5]" />
        <span className="hidden sm:inline">Install App</span>
      </button>
    );
  }

  // iOS Safari guidance button
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-stone-200 text-xs font-medium border border-white/20 transition-all cursor-pointer"
          title="Install FamilyOS on iPhone / iPad"
        >
          <Smartphone className="w-3.5 h-3.5 text-[#C39A60]" />
          <span className="hidden sm:inline">Add to Home Screen</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#0E2822] border border-[#C39A60]/30 p-6 shadow-2xl text-white">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-[#C39A60] flex items-center justify-center text-[#0E2822] font-serif font-bold text-sm">
                    F
                  </div>
                  <h3 className="text-sm font-bold tracking-wide">Install on iOS / Safari</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-stone-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs text-stone-300 leading-relaxed">
                <div className="flex items-start space-x-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#173D35] border border-[#C39A60]/40 flex items-center justify-center text-[10px] font-bold text-[#C39A60] shrink-0 mt-0.5">
                    1
                  </span>
                  <p>
                    Tap the <strong className="text-white">Share</strong> button in the bottom Safari toolbar (the box with an upward arrow).
                  </p>
                </div>
                <div className="flex items-start space-x-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#173D35] border border-[#C39A60]/40 flex items-center justify-center text-[10px] font-bold text-[#C39A60] shrink-0 mt-0.5">
                    2
                  </span>
                  <p>
                    Scroll down and select <strong className="text-white">Add to Home Screen</strong>.
                  </p>
                </div>
                <div className="flex items-start space-x-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#173D35] border border-[#C39A60]/40 flex items-center justify-center text-[10px] font-bold text-[#C39A60] shrink-0 mt-0.5">
                    3
                  </span>
                  <p>
                    Launch FamilyOS directly from your home screen with instant offline-first speed!
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full py-2 rounded-xl bg-[#C39A60] hover:bg-[#b08850] text-[#0E2822] font-semibold text-xs transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
