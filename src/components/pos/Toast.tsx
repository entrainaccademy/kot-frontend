"use client";

import React from "react";
import { usePOS } from "../../context/POSContext";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export const ToastContainer = () => {
  const { toasts, removeToast } = usePOS();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-xl shadow-lg border text-sm transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 ${
            toast.type === "success"
              ? "bg-teal-50 border-teal-200 text-teal-900"
              : toast.type === "error"
              ? "bg-rose-50 border-rose-200 text-rose-900"
              : "bg-slate-50 border-slate-200 text-slate-800"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toast.type === "success" && (
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
            )}
            {toast.type === "error" && (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            {toast.type === "info" && (
              <Info className="w-4 h-4 text-slate-600 shrink-0" />
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="p-1 hover:bg-black/5 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};

