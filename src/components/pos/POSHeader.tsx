"use client";

import React, { useState, useEffect } from "react";
import { usePOS } from "../../context/POSContext";
import { Search, RefreshCw, Clock } from "lucide-react";

export const POSHeader: React.FC = () => {
  const { searchQuery, setSearchQuery, loadMenu, loadingMenu, selectedTable, orderType } = usePOS();
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
      {/* Title & Live Status */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Restaurant POS Terminal
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Online
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="capitalize">{orderType.toLowerCase().replace("_", "-")}</span>
            {selectedTable && (
              <>
                <span>•</span>
                <span className="font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded">
                  Table {selectedTable.tableNumber}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Food Search Input */}
      <div className="flex-1 max-w-md relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search food by name, ingredient, code..."
          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-slate-600"
          >
            Clear
          </button>
        )}
      </div>

      {/* Right Controls: Clock & Refresh */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100/70 px-3 py-1.5 rounded-lg border border-slate-200/50">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span suppressHydrationWarning className="font-mono font-medium">{currentTime || "--:--:--"}</span>
        </div>

        <button
          onClick={() => loadMenu()}
          disabled={loadingMenu}
          title="Refresh Menu Items"
          className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loadingMenu ? "animate-spin text-teal-600" : ""}`} />
        </button>
      </div>
    </header>
  );
};
