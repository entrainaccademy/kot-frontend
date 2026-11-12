"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { POSSidebar } from "../../../components/pos/POSSidebar";
import { useAuth } from "../../../context/AuthContext";
import { apiClient } from "../../../lib/apiClient";
import {
  Grid3X3,
  Receipt,
  RefreshCw,
  ArrowRight,
  Users,
} from "lucide-react";

export default function RestaurantTablesPage() {
  const { user } = useAuth();
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTables = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data?: any[] }>("/restaurant/tables");
      if (res.success && Array.isArray(res.data)) {
        setTables(res.data);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, []);

  return (
    <div className="flex h-screen w-screen bg-slate-100 overflow-hidden font-sans">
      <div className="hidden lg:block shrink-0">
        <POSSidebar activePath="/restaurant/tables" />
      </div>

      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 h-full overflow-y-auto">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-700">
              <Grid3X3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
                Dining Floor & Tables
              </h1>
              <p className="text-[11px] text-slate-500">
                {user?.restaurantName || "Cobolt Kitchen & Bar"} • Real-time Table Occupancy
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadTables}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-600" : ""}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/restaurant/pos"
              className="py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all"
            >
              <Receipt className="w-4 h-4" />
              <span>Open POS Billing</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </header>

        {/* Content */}
        <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">
              Total Tables: {tables.length}
            </span>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Available
              </span>
              <span className="flex items-center gap-1.5 text-rose-600">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Occupied
              </span>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-400 text-xs">Loading tables...</div>
          ) : tables.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <Grid3X3 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="font-semibold text-slate-700">No tables found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {tables.map((t) => {
                const isOccupied = t.status === "OCCUPIED";
                return (
                  <div
                    key={t._id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                      isOccupied
                        ? "bg-rose-50/50 border-rose-200"
                        : "bg-white border-slate-200 hover:border-teal-300 shadow-xs"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-extrabold text-slate-900">
                          {t.tableNumber || t.name || t.tableName}
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isOccupied ? "bg-rose-500 animate-pulse" : "bg-emerald-500"
                          }`}
                        />
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <Users className="w-3.5 h-3.5" />
                        <span>Capacity: {t.capacity || 4}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          isOccupied ? "text-rose-600" : "text-emerald-600"
                        }`}
                      >
                        {t.status || "AVAILABLE"}
                      </span>
                      <Link
                        href="/restaurant/pos"
                        className="text-[11px] font-bold text-teal-600 hover:text-teal-700"
                      >
                        Bill →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

