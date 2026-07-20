import React, { useState } from "react";
import { Smartphone, AlertCircle, Chrome } from "lucide-react";
import { signInWithGoogle } from "../lib/firebase";
import { User } from "../types";
import { motion } from "motion/react";

interface AuthScreenProps {
  onAuthSuccess: (user: User) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
      onAuthSuccess(user);
    } catch (err: any) {
      console.warn("Google Sign-In warning (handled):", err.message || err);
      let friendlyMessage = "Failed to sign in with Google. Please try again.";
      if (err.message) {
        friendlyMessage = err.message;
      }
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 justify-center text-slate-100 overflow-y-auto px-6 py-12 relative" id="auth-screen-container">
      
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center mt-4">
        <div className="w-20 h-20 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-3xl flex items-center justify-center shadow-lg shadow-sky-500/20 mb-6 animate-bounce">
          <Smartphone size={38} className="text-white" />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-white">
          Auto <span className="text-sky-400">Parts</span>
        </h2>
        <p className="text-slate-400 text-sm mt-2 max-w-xs leading-relaxed">
          The ultimate marketplace for buying and selling automobile spare parts locally.
        </p>
      </div>

      {/* Auth Card */}
      <div className="bg-slate-950/50 backdrop-blur-md border border-slate-800 rounded-3xl p-8 shadow-xl mt-8 max-w-md w-full mx-auto">
        <div className="border-b border-slate-800 pb-4 mb-6 text-center">
          <h3 className="text-lg font-bold text-white tracking-wide">
            Welcome to Auto Parts
          </h3>
          <p className="text-slate-500 text-xs mt-1">
            Sign in with your Google account to buy and sell automobile spare parts across India.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-400 flex items-start gap-3 animate-fade-in" id="auth-error-banner">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full bg-white hover:bg-slate-50 text-slate-900 font-semibold rounded-2xl py-3.5 px-4 text-sm flex items-center justify-center gap-3 transition-colors shadow-md active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          id="btn-google-signin"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Chrome size={18} className="text-red-500 fill-red-500" />
              <span>Continue with Google</span>
            </>
          )}
        </motion.button>

        <p className="text-center text-[11px] text-slate-500 mt-6 leading-relaxed">
          By signing in, you agree to our Terms of Service and Privacy Policy. All transactions are securely protected.
        </p>
      </div>
    </div>
  );
}
