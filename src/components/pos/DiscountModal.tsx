"use client";

import React, { useState } from "react";
import { usePOS } from "../../context/POSContext";
import { X, Percent, Tag } from "lucide-react";

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DiscountModal: React.FC<DiscountModalProps> = ({ isOpen, onClose }) => {
  const { discount, applyDiscount, subtotal } = usePOS();

  const [type, setType] = useState<"PERCENTAGE" | "FIXED">(
    discount?.type || "PERCENTAGE"
  );
  const [value, setValue] = useState<string>(
    discount ? String(discount.value) : ""
  );
  const [reason, setReason] = useState<string>(discount?.reason || "");

  if (!isOpen) return null;

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    const numVal = parseFloat(value);
    if (isNaN(numVal) || numVal <= 0) {
      applyDiscount(null);
      onClose();
      return;
    }

    applyDiscount({
      type,
      value: numVal,
      reason: reason.trim() || undefined,
    });
    onClose();
  };

  const handleClear = () => {
    applyDiscount(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Apply Order Discount</h2>
            <p className="text-xs text-slate-500">Order Subtotal: ₹{subtotal.toFixed(2)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleApply} className="p-6 space-y-4">
          {/* Type Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setType("PERCENTAGE")}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                type === "PERCENTAGE"
                  ? "bg-white text-teal-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              <span>Percentage (%)</span>
            </button>
            <button
              type="button"
              onClick={() => setType("FIXED")}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                type === "FIXED"
                  ? "bg-white text-teal-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Fixed Amount (₹)</span>
            </button>
          </div>

          {/* Preset Buttons for Percentage */}
          {type === "PERCENTAGE" && (
            <div className="flex items-center gap-2">
              {[5, 10, 15, 20].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setValue(String(preset))}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                    value === String(preset)
                      ? "bg-teal-50 border-teal-600 text-teal-700"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {preset}%
                </button>
              ))}
            </div>
          )}

          {/* Discount Value Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {type === "PERCENTAGE" ? "Discount Percentage (%)" : "Discount Amount (₹)"}
            </label>
            <input
              type="number"
              step="any"
              min="0"
              max={type === "PERCENTAGE" ? 100 : subtotal}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={type === "PERCENTAGE" ? "e.g. 10" : "e.g. 100"}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              autoFocus
            />
          </div>

          {/* Reason Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason (Optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Manager Courtesy, Regular Guest"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-3">
            {discount && (
              <button
                type="button"
                onClick={handleClear}
                className="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors"
              >
                Remove
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-sm shadow-teal-600/20"
            >
              Apply Discount
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
