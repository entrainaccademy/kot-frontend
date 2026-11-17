"use client";

import React, { useState } from "react";
import { useAuth, AuthProvider } from "../../context/AuthContext";
import { Store, Lock, Mail, ArrowRight, Loader2, AlertCircle, Sparkles } from "lucide-react";

function LoginContent() {
  const { login } = useAuth();

  const [email, setEmail] = useState<string>("cashier@cobolt.com");
  const [password, setPassword] = useState<string>("Password@123");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const handleQuickFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMsg("");
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Please enter both email and password");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await login(email.trim(), password);
      if (res.success) {
        // Check if there is a redirect URL specified (e.g. from Waiter App billing handoff)
        const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
        const redirectTarget = params.get("redirect");

        if (redirectTarget && redirectTarget.startsWith("/")) {
          window.location.href = redirectTarget;
        } else if (res.user?.role === "SUPER_ADMIN") {
          window.location.href = "/admin/dashboard";
        } else if (res.user?.role === "ADMIN" || res.user?.role === "MANAGER") {
          window.location.href = "/restaurant/dashboard";
        } else {
          window.location.href = "/restaurant/pos";
        }
      } else {
        setErrorMsg(res.message || "Invalid credentials. Please try again.");
      }
    } catch (err: any) {
      console.error("Login attempt failed:", err);
      if (err.message && (err.message.includes("404") || err.message.includes("Failed to fetch") || err.message.includes("NetworkError"))) {
        setErrorMsg(
          "Cannot reach backend server. Please verify your connection or check that the backend is online."
        );
      } else {
        setErrorMsg(err.message || "Authentication failed. Please verify credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-screen flex flex-col items-center justify-center p-4"
      style={{ backgroundColor: "#f8fafc", color: "#0f172a", fontFamily: "system-ui, sans-serif" }}
    >
      <div
        className="w-full max-w-md rounded-3xl p-8 border"
        style={{
          backgroundColor: "#ffffff",
          borderColor: "#e2e8f0",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02)",
        }}
      >
        {/* Brand Icon & Heading */}
        <div className="flex flex-col items-center text-center mb-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-3"
            style={{ backgroundColor: "#0d9488", boxShadow: "0 4px 12px rgba(13, 148, 136, 0.25)" }}
          >
            <Store className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: "#0f172a" }}>
            Restaurant POS Portal
          </h1>
          <p className="text-xs mt-1" style={{ color: "#64748b" }}>
            Sign in to access your billing counter & kitchen terminal
          </p>
        </div>

        {/* Quick Demo Fill Buttons */}
        <div
          className="mb-5 p-3 rounded-2xl border"
          style={{ backgroundColor: "#f0fdfa", borderColor: "#ccfbf1" }}
        >
          <div className="flex items-center gap-1.5 text-xs font-bold mb-2" style={{ color: "#0f766e" }}>
            <Sparkles className="w-3.5 h-3.5" />
            <span>Quick Demo Credentials</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickFill("cashier@cobolt.com", "Password@123")}
              className="py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all text-left"
              style={{
                backgroundColor: email === "cashier@cobolt.com" ? "#0d9488" : "#ffffff",
                color: email === "cashier@cobolt.com" ? "#ffffff" : "#334155",
                borderColor: "#99f6e4",
              }}
            >
              <div className="font-bold">Cashier</div>
              <div className="text-[9px] opacity-80 truncate">cashier@cobolt.com</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill("admin@cobolt.com", "Password@123")}
              className="py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all text-left"
              style={{
                backgroundColor: email === "admin@cobolt.com" ? "#0d9488" : "#ffffff",
                color: email === "admin@cobolt.com" ? "#ffffff" : "#334155",
                borderColor: "#99f6e4",
              }}
            >
              <div className="font-bold">Rest. Admin</div>
              <div className="text-[9px] opacity-80 truncate">admin@cobolt.com</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill("superadmin@kotplatform.com", "Password@123")}
              className="py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all text-left"
              style={{
                backgroundColor: email === "superadmin@kotplatform.com" ? "#0d9488" : "#ffffff",
                color: email === "superadmin@kotplatform.com" ? "#ffffff" : "#334155",
                borderColor: "#99f6e4",
              }}
            >
              <div className="font-bold">Super Admin</div>
              <div className="text-[9px] opacity-80 truncate">superadmin@...</div>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div
            className="mb-5 p-3 rounded-xl border flex items-start gap-2 text-xs"
            style={{ backgroundColor: "#fff1f2", borderColor: "#fecdd3", color: "#9f1239" }}
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#e11d48" }} />
            <span className="leading-tight">{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: "#334155" }}>
              Staff Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none" style={{ color: "#94a3b8" }}>
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@restaurant.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-semibold border outline-none transition-all"
                style={{
                  backgroundColor: "#f8fafc",
                  borderColor: "#e2e8f0",
                  color: "#0f172a",
                }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: "#334155" }}>
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none" style={{ color: "#94a3b8" }}>
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-semibold border outline-none transition-all"
                style={{
                  backgroundColor: "#f8fafc",
                  borderColor: "#e2e8f0",
                  color: "#0f172a",
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-3 py-3 rounded-xl text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            style={{
              backgroundColor: "#0d9488",
              boxShadow: "0 2px 8px rgba(13, 148, 136, 0.3)",
            }}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <span>Sign In to Terminal</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-5 border-t text-center" style={{ borderColor: "#f1f5f9" }}>
          <p className="text-[11px]" style={{ color: "#94a3b8" }}>
            KOT & Restaurant Billing SaaS Platform • Multi-Tenant Terminal
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthProvider>
      <LoginContent />
    </AuthProvider>
  );
}
