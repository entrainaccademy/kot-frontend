"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { apiClient } from "../../../lib/apiClient";
import {
  ShieldCheck,
  Building2,
  CreditCard,
  IndianRupee,
  AlertTriangle,
  RefreshCw,
  LogOut,
  ExternalLink,
  Clock,
  ShieldAlert,
  Store,
} from "lucide-react";

interface SuperAdminDashboardData {
  totalRestaurants: number;
  activeRestaurants: number;
  suspendedRestaurants: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  monthlySubscriptionRevenue: number;
  recentRestaurants: Array<{
    _id: string;
    name: string;
    slug: string;
    email: string;
    phone: string;
    status: string;
    createdAt: string;
  }>;
  subscriptionExpiryAlerts: Array<{
    _id: string;
    restaurantId?: { _id: string; name: string; slug: string; email: string };
    planId?: { _id: string; name: string; price: number; billingCycle: string };
    endDate: string;
  }>;
}

export default function SuperAdminDashboardPage() {
  const router = useRouter();
  const { user, logout, loading: authLoading } = useAuth();
  const [data, setData] = useState<SuperAdminDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadAdminDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.get<{
        success: boolean;
        data?: SuperAdminDashboardData;
        message?: string;
      }>("/admin/dashboard");

      if (res.success && res.data) {
        setData(res.data);
      } else {
        throw new Error(res.message || "Failed to load platform admin metrics");
      }
    } catch (err: any) {
      console.error("Admin dashboard fetch error:", err);
      setErrorMsg(err.message || "Failed to load admin metrics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login");
        return;
      }
      if (user.role === "SUPER_ADMIN") {
        loadAdminDashboard();
      }
    }
  }, [user, authLoading, router, loadAdminDashboard]);

  // Authorization Check
  if (authLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-slate-300 text-xs">
        <RefreshCw className="w-6 h-6 animate-spin text-teal-400 mb-2" />
      </div>
    );
  }

  if (user && user.role !== "SUPER_ADMIN") {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 font-sans">
        <div className="max-w-md w-full bg-slate-950 p-8 rounded-3xl border border-rose-500/30 text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
          <h1 className="text-lg font-extrabold text-white">Access Restricted</h1>
          <p className="text-xs text-slate-400">
            This dashboard is reserved exclusively for Platform Super Administrators. Your current role is <strong>{user.role}</strong>.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              href="/restaurant/dashboard"
              className="py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all"
            >
              Go to Restaurant Dashboard
            </Link>
            <button
              onClick={() => logout()}
              className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Sign out & Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>Platform Super Admin</span>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase tracking-wider border border-purple-500/40">
                SaaS Control Center
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Multi-tenant Restaurant Management, SaaS Billing & Tenant Subscriptions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadAdminDashboard}
            className="p-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-purple-400" : ""}`} />
            <span>Refresh</span>
          </button>

          <Link
            href="/restaurant/dashboard"
            className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-all"
          >
            <Store className="w-4 h-4 text-teal-400" />
            <span>Restaurant App</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>

          <button
            onClick={() => logout()}
            className="py-2 px-3 rounded-xl bg-rose-950/40 border border-rose-800/50 hover:bg-rose-900/60 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Error Alert */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-300 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Failed to fetch metrics: {errorMsg}</span>
            </div>
            <button
              onClick={loadAdminDashboard}
              className="py-1 px-3 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-500 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* 4 Super Admin Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Restaurants */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Total Restaurants
              </span>
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-white font-mono">
                {loading ? "..." : data?.totalRestaurants ?? 0}
              </div>
              <div className="flex items-center gap-2 text-[11px] font-semibold mt-1">
                <span className="text-emerald-400">{data?.activeRestaurants ?? 0} Active</span>
                <span className="text-slate-600">•</span>
                <span className="text-rose-400">{data?.suspendedRestaurants ?? 0} Suspended</span>
              </div>
            </div>
          </div>

          {/* 2. Active Subscriptions */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Active Subscriptions
              </span>
              <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-white font-mono">
                {loading ? "..." : data?.activeSubscriptions ?? 0}
              </div>
              <span className="text-[11px] text-slate-400 font-semibold mt-1 block">
                {data?.expiredSubscriptions ?? 0} Expired subscriptions
              </span>
            </div>
          </div>

          {/* 3. Monthly Subscription Revenue */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Monthly SaaS Revenue
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <IndianRupee className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                {loading ? "..." : `₹${(data?.monthlySubscriptionRevenue ?? 0).toFixed(2)}`}
              </div>
              <span className="text-[11px] text-emerald-500 font-semibold mt-1 block">
                Verified paid subscription billing (MTD)
              </span>
            </div>
          </div>

          {/* 4. Expiring Subscriptions Alert */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Expiring in 7 Days
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-amber-400 font-mono">
                {loading ? "..." : data?.subscriptionExpiryAlerts?.length ?? 0}
              </div>
              <span className="text-[11px] text-amber-500 font-semibold mt-1 block">
                Requires renewal notice
              </span>
            </div>
          </div>
        </div>

        {/* Expiring Subscriptions Alert Banner & Table (if any) */}
        {data?.subscriptionExpiryAlerts && data.subscriptionExpiryAlerts.length > 0 && (
          <div className="bg-slate-900 rounded-2xl border border-amber-500/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-extrabold">
              <AlertTriangle className="w-4 h-4" />
              <span>Subscription Expiry Alerts (Next 7 Days)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-[10px] font-bold text-slate-400 uppercase">
                  <tr>
                    <th className="py-2 px-3">Restaurant</th>
                    <th className="py-2 px-3">Plan</th>
                    <th className="py-2 px-3">Price</th>
                    <th className="py-2 px-3">Expiry Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {data.subscriptionExpiryAlerts.map((sub, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="py-2 px-3 font-bold text-white">
                        {sub.restaurantId?.name || "Unknown Restaurant"}
                      </td>
                      <td className="py-2 px-3 text-slate-300">
                        {sub.planId?.name || "Standard Plan"}
                      </td>
                      <td className="py-2 px-3 font-mono text-emerald-400">
                        ₹{(sub.planId?.price || 0).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 font-mono text-amber-400">
                        {new Date(sub.endDate).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Restaurants Table */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
            <div>
              <h2 className="text-xs font-extrabold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-400" />
                <span>Recent Tenant Restaurants</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Latest provisioned restaurant tenant databases and credentials
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-xl">
              {data?.recentRestaurants?.length ?? 0} tenants
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Restaurant</th>
                  <th className="py-3 px-3">Slug</th>
                  <th className="py-3 px-3">Contact Email</th>
                  <th className="py-3 px-3">Phone</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-400" />
                      <span>Loading platform restaurants...</span>
                    </td>
                  </tr>
                ) : !data?.recentRestaurants || data.recentRestaurants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      <span>No restaurants provisioned yet.</span>
                    </td>
                  </tr>
                ) : (
                  data.recentRestaurants.map((rest) => (
                    <tr key={rest._id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">
                        {rest.name}
                      </td>
                      <td className="py-3 px-3 font-mono text-purple-300 text-[11px]">
                        {rest.slug}
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {rest.email}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400">
                        {rest.phone}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            rest.status === "ACTIVE"
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                          }`}
                        >
                          {rest.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-400 text-[11px] font-mono">
                        {new Date(rest.createdAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}