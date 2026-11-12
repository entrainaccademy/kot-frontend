"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { POSSidebar } from "../../../components/pos/POSSidebar";
import { useAuth } from "../../../context/AuthContext";
import { apiClient } from "../../../lib/apiClient";
import {
  LayoutDashboard,
  Receipt,
  UtensilsCrossed,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Users,
  BookOpen,
  ChefHat,
  Grid3X3,
  IndianRupee,
  ShieldAlert,
} from "lucide-react";

interface DashboardMetrics {
  todaysOrders: number;
  todaysCompletedOrders: number;
  todaysVerifiedSales: number;
  activeTables: number;
  pendingKotCount: number;
  totalMenuItems: number;
  activeStaff: number;
  lowStockAlerts: number;
}

export default function RestaurantDashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    todaysOrders: 0,
    todaysCompletedOrders: 0,
    todaysVerifiedSales: 0,
    activeTables: 0,
    pendingKotCount: 0,
    totalMenuItems: 0,
    activeStaff: 0,
    lowStockAlerts: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [dashRes, ordersRes] = await Promise.all([
        apiClient.get<{ success: boolean; data?: DashboardMetrics }>("/restaurant/dashboard"),
        apiClient.get<{ success: boolean; data?: any[] }>("/restaurant/orders").catch(() => ({ success: false, data: [] })),
      ]);

      if (dashRes.success && dashRes.data) {
        setMetrics({
          todaysOrders: Number(dashRes.data.todaysOrders) || 0,
          todaysCompletedOrders: Number(dashRes.data.todaysCompletedOrders) || 0,
          todaysVerifiedSales: Number(dashRes.data.todaysVerifiedSales) || 0,
          activeTables: Number(dashRes.data.activeTables) || 0,
          pendingKotCount: Number(dashRes.data.pendingKotCount) || 0,
          totalMenuItems: Number(dashRes.data.totalMenuItems) || 0,
          activeStaff: Number(dashRes.data.activeStaff) || 0,
          lowStockAlerts: Number(dashRes.data.lowStockAlerts) || 0,
        });
      } else {
        throw new Error("Unable to retrieve dashboard metrics from server");
      }

      if (ordersRes.success && Array.isArray(ordersRes.data)) {
        setRecentOrders(ordersRes.data.slice(0, 6));
      }
    } catch (err: any) {
      console.error("Dashboard error:", err);
      setErrorMsg(err.message || "Failed to load dashboard metrics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Authorization notice for SuperAdmin accessing restaurant dashboard
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  return (
    <div className="flex h-screen w-screen bg-slate-100 overflow-hidden font-sans">
      <div className="hidden lg:block shrink-0">
        <POSSidebar activePath="/restaurant/dashboard" />
      </div>

      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 h-full overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-700">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Restaurant Dashboard</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </h1>
              <p className="text-[11px] text-slate-500">
                {user?.restaurantName || "Cobolt Kitchen & Bar"} • Live Real-time Operations & Sales
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadDashboard}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Refresh Dashboard"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-600" : ""}`} />
              <span>Refresh</span>
            </button>

            {isSuperAdmin && (
              <Link
                href="/admin/dashboard"
                className="py-2 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
              >
                <span>Platform Admin</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}

            <Link
              href="/restaurant/pos"
              className="py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all"
            >
              <Receipt className="w-4 h-4" />
              <span>Launch POS Billing</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </header>

        {/* Content */}
        <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
          {/* Error Banner */}
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Backend Connection Error: {errorMsg}</span>
              </div>
              <button
                onClick={loadDashboard}
                className="py-1 px-3 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* SuperAdmin Notice */}
          {isSuperAdmin && (
            <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-purple-600 shrink-0" />
                <span>You are signed in as <strong>SUPER_ADMIN</strong>. You can switch to the platform management dashboard anytime.</span>
              </div>
              <Link
                href="/admin/dashboard"
                className="py-1 px-3 rounded-lg bg-purple-700 text-white font-bold hover:bg-purple-800"
              >
                Go to Platform Admin
              </Link>
            </div>
          )}

          {/* 8 Primary Real Backend Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Today's Sales */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Today&apos;s Verified Sales
                </span>
                <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/80 flex items-center justify-center text-teal-700">
                  <IndianRupee className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  {loading ? (
                    <span className="text-slate-300">...</span>
                  ) : (
                    `₹${metrics.todaysVerifiedSales.toFixed(2)}`
                  )}
                </div>
                <span className="text-[11px] text-teal-700 font-semibold mt-1 block">
                  Completed paid billing transactions today
                </span>
              </div>
            </div>

            {/* 2. Total Orders */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Total Orders (Today)
                </span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-700">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  {loading ? <span className="text-slate-300">...</span> : metrics.todaysOrders}
                </div>
                <span className="text-[11px] text-blue-700 font-semibold mt-1 block">
                  All dine-in, takeaway & parcels
                </span>
              </div>
            </div>

            {/* 3. Completed Orders */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Completed Orders
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-emerald-700 font-mono">
                  {loading ? <span className="text-slate-300">...</span> : metrics.todaysCompletedOrders}
                </div>
                <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
                  Fulfilled & settled today
                </span>
              </div>
            </div>

            {/* 4. Active Tables */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Active Tables Occupied
                </span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-700">
                  <Grid3X3 className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  {loading ? <span className="text-slate-300">...</span> : metrics.activeTables}
                </div>
                <span className="text-[11px] text-amber-700 font-semibold mt-1 block">
                  Live seated dining tables
                </span>
              </div>
            </div>

            {/* 5. Pending KOTs */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Pending Kitchen KOTs
                </span>
                <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-700">
                  <ChefHat className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  {loading ? <span className="text-slate-300">...</span> : metrics.pendingKotCount}
                </div>
                <span className="text-[11px] text-rose-700 font-semibold mt-1 block">
                  Awaiting cooking or in preparation
                </span>
              </div>
            </div>

            {/* 6. Active Staff */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Active Staff
                </span>
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-700">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  {loading ? <span className="text-slate-300">...</span> : metrics.activeStaff}
                </div>
                <span className="text-[11px] text-indigo-700 font-semibold mt-1 block">
                  Active team members
                </span>
              </div>
            </div>

            {/* 7. Menu Items */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Active Menu Dishes
                </span>
                <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200/80 flex items-center justify-center text-cyan-700">
                  <BookOpen className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  {loading ? <span className="text-slate-300">...</span> : metrics.totalMenuItems}
                </div>
                <span className="text-[11px] text-cyan-700 font-semibold mt-1 block">
                  Available on live terminal
                </span>
              </div>
            </div>

            {/* 8. Low-Stock Alerts */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Low-Stock Alerts
                </span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-700">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  {loading ? <span className="text-slate-300">...</span> : metrics.lowStockAlerts}
                </div>
                <span className="text-[11px] text-amber-700 font-semibold mt-1 block">
                  Inventory items below threshold
                </span>
              </div>
            </div>
          </div>

          {/* Quick Module Shortcuts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/restaurant/pos"
              className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-teal-500 hover:shadow-md transition-all flex items-center gap-3.5 group"
            >
              <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-all">
                <Receipt className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-bold text-slate-900">New POS Order</h3>
                <p className="text-[11px] text-slate-500">Punch table & takeaway orders</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-all" />
            </Link>

            <Link
              href="/restaurant/kitchen"
              className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-teal-500 hover:shadow-md transition-all flex items-center gap-3.5 group"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-teal-400 border border-slate-800 flex items-center justify-center">
                <ChefHat className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-bold text-slate-900">Kitchen Display (KDS)</h3>
                <p className="text-[11px] text-slate-500">Live order cooking queue</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-all" />
            </Link>

            <Link
              href="/restaurant/menu"
              className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-teal-500 hover:shadow-md transition-all flex items-center gap-3.5 group"
            >
              <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-all">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-bold text-slate-900">Menu & Availability</h3>
                <p className="text-[11px] text-slate-500">Add dishes, prices & sold out</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-all" />
            </Link>
          </div>

          {/* Recent Orders Real Backend Feed */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-extrabold text-slate-900">Live Order Stream</h3>
                <p className="text-[11px] text-slate-500">Recent restaurant tickets and statuses</p>
              </div>
              <Link
                href="/restaurant/orders"
                className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
              >
                <span>View all orders</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Order #</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Table</th>
                    <th className="py-2.5 px-3">Items</th>
                    <th className="py-2.5 px-3 text-right">Price</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        <UtensilsCrossed className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                        <span>No orders found. Create your first order in the POS terminal.</span>
                      </td>
                    </tr>
                  ) : (
                    recentOrders.map((order) => {
                      const tableText = order.tableId?.tableNumber
                        ? `Table ${order.tableId.tableNumber}`
                        : order.orderType;

                      const priceVal =
                        Number(order.grandTotal || order.subtotal || 0).toFixed(2);

                      return (
                        <tr key={order._id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {order.orderNumber}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold">
                              {order.orderType}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-700">
                            {tableText}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {order.items?.length || 0} items
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                            ₹{priceVal}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                order.status === "COMPLETED"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : order.status === "READY"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                  : order.status === "BILLED"
                                  ? "bg-teal-50 text-teal-700 border-teal-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {order.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link
                              href="/restaurant/pos"
                              className="text-teal-600 hover:text-teal-700 font-bold text-[11px]"
                            >
                              Open →
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}