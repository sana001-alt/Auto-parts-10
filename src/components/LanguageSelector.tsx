import React from "react";
import { useLanguage } from "../lib/LanguageContext";
import { Globe, ChevronDown } from "lucide-react";
import { Language } from "../lib/translations";

export default function LanguageSelector() {
  const { language, setLanguage } = useLanguage();

  const languages: { code: Language; label: string; nativeLabel: string }[] = [
    { code: "en", label: "English", nativeLabel: "English" },
    { code: "ta", label: "Tamil", nativeLabel: "தமிழ்" },
    { code: "hi", label: "Hindi", nativeLabel: "हिंदी" }
  ];

  return (
    <div className="relative inline-flex items-center" id="language-selector-wrapper">
      <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-full py-1 px-2.5 shadow-sm transition-all cursor-pointer group">
        <Globe size={13} className="text-sky-400 group-hover:animate-pulse" />
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          className="bg-transparent text-[11px] font-bold text-slate-100 focus:outline-none cursor-pointer border-none pr-1 pl-0.5 appearance-none select-none"
          id="language-select"
          style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code} className="bg-slate-900 text-white text-xs">
              {lang.nativeLabel}
            </option>
          ))}
        </select>
        <ChevronDown size={11} className="text-slate-400 shrink-0 pointer-events-none" />
      </div>
    </div>
  );
}
