"use client";

import React, { useState, useEffect } from "react";
import {
  Volume2,
  VolumeX,
  Bell,
  Sliders,
  Play,
  X,
} from "lucide-react";
import { soundService } from "../../lib/soundService";

interface SoundControlProps {
  className?: string;
}

export const SoundControl: React.FC<SoundControlProps> = ({
  className = "",
}) => {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [volume, setVolume] = useState<number>(0.8);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    setEnabled(soundService.isEnabled());
    setVolume(soundService.getVolume());
  }, []);

  const toggleSound = () => {
    const next = !enabled;
    setEnabled(next);
    soundService.setEnabled(next);
    if (next) {
      soundService.unlockAudio();
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    soundService.setVolume(val);
  };

  const [playingTest, setPlayingTest] = useState<string | null>(null);

  const handleTestKitchenBell = async () => {
    setPlayingTest("kitchen-bell");
    await soundService.unlockAudio();
    await soundService.playKitchenBell();
    setTimeout(() => setPlayingTest(null), 1200);
  };

  const handleTestFoodReady = async () => {
    setPlayingTest("food-ready");
    await soundService.unlockAudio();
    await soundService.playFoodReady();
    setTimeout(() => setPlayingTest(null), 1500);
  };

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Sound Toggle Button */}
      <div className="flex items-center gap-1">
        <button
          onClick={toggleSound}
          className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            enabled
              ? "bg-teal-50 border-teal-200 text-teal-800 hover:bg-teal-100 shadow-2xs"
              : "bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200"
          }`}
          title={enabled ? "Sound Notifications Active (Click to Mute)" : "Sound Notifications Muted (Click to Unmute)"}
        >
          {enabled ? (
            <>
              <Volume2 className="w-4 h-4 text-teal-700" />
              <span className="hidden sm:inline">Sound On</span>
            </>
          ) : (
            <>
              <VolumeX className="w-4 h-4 text-slate-400" />
              <span className="hidden sm:inline">Muted</span>
            </>
          )}
        </button>

        {/* Settings Dropdown Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 shadow-2xs transition-all cursor-pointer"
          title="Adjust Notification Volume & Test Sounds"
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Popover Settings Panel */}
      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 space-y-3.5 animate-in fade-in zoom-in-95 font-sans text-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-extrabold text-slate-900">
                Audio Notifications
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Sound Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              Notification Sounds:
            </span>
            <button
              onClick={toggleSound}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                enabled
                  ? "bg-teal-600 text-white shadow-2xs"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {enabled ? "Enabled" : "Muted"}
            </button>
          </div>

          {/* Volume Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span>Volume</span>
              <span className="font-mono">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={handleVolumeChange}
              disabled={!enabled}
              className="w-full accent-teal-600 cursor-pointer disabled:opacity-50"
            />
          </div>

          {/* Test Buttons */}
          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Test Audio Tones
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleTestKitchenBell}
                disabled={!enabled}
                className={`py-2 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 ${
                  playingTest === "kitchen-bell"
                    ? "bg-amber-500 text-white border-amber-600 ring-2 ring-amber-300"
                    : "bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-900"
                }`}
              >
                <Play className={`w-3.5 h-3.5 ${playingTest === "kitchen-bell" ? "animate-spin" : "text-amber-700"}`} />
                <span>{playingTest === "kitchen-bell" ? "Playing Bell..." : "Kitchen Bell"}</span>
              </button>
              <button
                onClick={handleTestFoodReady}
                disabled={!enabled}
                className={`py-2 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 ${
                  playingTest === "food-ready"
                    ? "bg-emerald-500 text-white border-emerald-600 ring-2 ring-emerald-300"
                    : "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-900"
                }`}
              >
                <Play className={`w-3.5 h-3.5 ${playingTest === "food-ready" ? "animate-spin" : "text-emerald-700"}`} />
                <span>{playingTest === "food-ready" ? "Playing Chime..." : "Food Ready"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
