import React, { useState, useEffect } from "react";
import { 
  Smartphone, 
  Wifi, 
  Battery, 
  Signal, 
  Sparkles, 
  AlertTriangle,
  Monitor,
  Smartphone as PhoneIcon,
  HelpCircle
} from "lucide-react";
import { isUsingFirebase } from "../lib/firebase";

interface PhoneSimulatorProps {
  children: React.ReactNode;
}

export default function PhoneSimulator({ children }: PhoneSimulatorProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const firebaseConnected = isUsingFirebase();

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      setCurrentTime(`${hours}:${minutes} ${ampm}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans" id="phone-simulator-root">
      {/* Simulation Header */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 z-10">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-sky-500/10 text-sky-400 rounded-lg">
              <Sparkles size={18} />
            </span>
            <h1 className="text-lg font-bold tracking-tight text-white">
              Auto Parts <span className="text-sky-400">Expo Simulator</span>
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Highly polished high-fidelity mockup simulating a React Native Expo application.
          </p>
        </div>

        {/* Database Status and View Toggles */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Firestore Connection status banner */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
            firebaseConnected 
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
          }`}>
            <span className={`w-2 h-2 rounded-full ${firebaseConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
            {firebaseConnected ? "Firebase Firestore Connected" : "Local Storage Sandbox Active"}
          </div>

          {/* Toggle buttons */}
          <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
            <button
              onClick={() => setIsFullscreen(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                !isFullscreen 
                  ? "bg-slate-900 text-white shadow-sm" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
              id="btn-view-phone"
            >
              <PhoneIcon size={14} />
              Mobile Shell
            </button>
            <button
              onClick={() => setIsFullscreen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                isFullscreen 
                  ? "bg-slate-900 text-white shadow-sm" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
              id="btn-view-fullscreen"
            >
              <Monitor size={14} />
              Full Screen
            </button>
          </div>
        </div>
      </header>

      {/* Simulator Body */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-8 bg-gradient-to-b from-slate-900 to-slate-950 overflow-auto">
        {isFullscreen ? (
          /* Full screen web layout */
          <div className="w-full max-w-5xl bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[820px]">
            {/* Minimal Web Topbar with connection state */}
            <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex justify-between items-center text-slate-400 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Web Preview Mode</span>
              </div>
              <div>Expo Dev Build v49.0.0</div>
            </div>
            
            {/* Real app view */}
            <div className="flex-1 overflow-hidden relative bg-slate-900">
              {children}
            </div>
          </div>
        ) : (
          /* High Fidelity Smartphone Shell mockup */
          <div className="relative mx-auto my-4 transition-all duration-300">
            {/* External Volume & Power button accents */}
            <div className="absolute -left-1 top-24 w-1 h-12 bg-slate-700 rounded-r-sm" />
            <div className="absolute -left-1 top-40 w-1 h-10 bg-slate-700 rounded-r-sm" />
            <div className="absolute -left-1 top-52 w-1 h-10 bg-slate-700 rounded-r-sm" />
            <div className="absolute -right-1 top-32 w-1 h-16 bg-slate-700 rounded-l-sm" />

            {/* Main Phone Container */}
            <div className="w-[390px] h-[800px] bg-slate-950 rounded-[52px] p-3.5 shadow-2xl ring-12 ring-slate-800 border-4 border-slate-700 flex flex-col overflow-hidden relative">
              
              {/* Dynamic Island / Notch */}
              <div className="absolute left-1/2 -translate-x-1/2 top-5 w-28 h-6 bg-black rounded-full z-40 flex items-center justify-between px-3">
                <div className="w-2.5 h-2.5 bg-slate-900 rounded-full border border-slate-800" />
                <div className="w-1.5 h-1.5 bg-blue-900/40 rounded-full animate-pulse" />
              </div>

              {/* Native Status Bar */}
              <div className="h-8 flex justify-between items-center px-6 text-white text-xs font-semibold select-none z-30 pt-1">
                <span>{currentTime.split(" ")[0]}</span>
                <div className="flex items-center gap-1.5">
                  <Signal size={13} className="text-white" />
                  <Wifi size={13} className="text-white" />
                  <div className="flex items-center gap-0.5">
                    <span className="text-[9px] font-medium opacity-80">98%</span>
                    <Battery size={15} className="text-white" />
                  </div>
                </div>
              </div>

              {/* Embedded Expo Application View */}
              <div className="flex-1 rounded-[38px] overflow-hidden relative bg-white text-slate-900 flex flex-col">
                {children}
              </div>

              {/* iOS Home Indicator Bar */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-800 rounded-full z-40" />
            </div>
          </div>
        )}
      </main>

      {/* Simulator Footer Details */}
      <footer className="bg-slate-950 border-t border-slate-800 px-6 py-4 flex flex-col md:flex-row justify-between items-center text-slate-500 text-xs gap-3">
        <span>Developed utilizing React, Tailwind CSS and Firebase Firestore.</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><HelpCircle size={13} /> Firebase instructions provided in config panel</span>
          <span>© 2026 Automobile Spare Parts Marketplace</span>
        </div>
      </footer>
    </div>
  );
}
