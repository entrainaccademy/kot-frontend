"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { POSSidebar } from "../../../components/pos/POSSidebar";
import { useAuth } from "../../../context/AuthContext";
import { apiClient } from "../../../lib/apiClient";
import { getSocket } from "../../../lib/socket";
import { soundService } from "../../../lib/soundService";
import { SoundControl } from "../../../components/common/SoundControl";
import {
  UtensilsCrossed,
  Receipt,
  Search,
  RefreshCw,
  ArrowRight,
  Grid3X3,
  ShoppingBag,
  Truck,
  IndianRupee,
  CheckCircle2,
} from "lucide-react";

export default function RestaurantOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data?: any[] }>("/restaurant/orders");
      if (res.success && Array.isArray(res.data)) {
        setOrders(res.data);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();

    const socket = getSocket();
    if (!socket) return;

    const handleUpdate = () => {
      loadOrders();
    };

    const handleFoodReady = (data: any) => {
      loadOrders();
      const orderNum = data.orderNumber || "Order";
      const eventKey = `food-ready:${data.kotId || data.orderId || orderNum}`;

      // Play Food Ready "DING-DONG!" chime
      soundService.playFoodReady(eventKey);
    };

    socket.on("order:created", handleUpdate);
    socket.on("order:updated", handleUpdate);
    socket.on("kot:created", handleUpdate);
    socket.on("kot:updated", handleUpdate);
    socket.on("kitchen:order-ready", handleFoodReady);

    return () => {
      socket.off("order:created", handleUpdate);
      socket.off("order:updated", handleUpdate);
      socket.off("kot:created", handleUpdate);
      socket.off("kot:updated", handleUpdate);
      socket.off("kitchen:order-ready", handleFoodReady);
    };
  }, [loadOrders]);

  const getOrderTotal = (order: any) => {
    if (order.grandTotal !== undefined && order.grandTotal !== null && Number(order.grandTotal) > 0) {
      return Number(order.grandTotal).toFixed(2);
    }
    if (order.subtotal !== undefined && order.subtotal !== null && Number(order.subtotal) > 0) {
      return Number(order.subtotal).toFixed(2);
    }
    const calc = (order.items || []).reduce(
      (acc: number, item: any) =>
        acc + Number(item.itemTotal || (Number(item.price) || 0) * (Number(item.quantity) || 1)),
      0
    );
    return Number(calc).toFixed(2);
  };

  const getTableDetail = (order: any) => {
    if (order.orderType === "DINE_IN") {
      const tableNum =
        order.tableId?.tableNumber ||
        order.table?.tableNumber ||
        order.tableNumber ||
        (typeof order.tableId === "string" ? order.tableId : null);
      const floor = order.tableId?.floor ? ` (${order.tableId.floor})` : "";

      if (tableNum) {
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 font-bold text-xs border border-teal-200">
            <Grid3X3 className="w-3.5 h-3.5 text-teal-600" />
            <span>Table {tableNum}{floor}</span>
          </span>
        );
      }
      return (
        <span className="text-slate-500 font-medium text-xs">
          Dine-In (Table Unassigned)
        </span>
      );
    }

    if (order.orderType === "TAKEAWAY") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-semibold text-xs border border-amber-200">
          <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
          <span>{order.customerId?.name ? `Takeaway • ${order.customerId.name}` : "Takeaway / Parcel"}</span>
        </span>
      );
    }

    if (order.orderType === "DELIVERY") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 font-semibold text-xs border border-indigo-200">
          <Truck className="w-3.5 h-3.5 text-indigo-600" />
          <span>{order.customerId?.name ? `Delivery • ${order.customerId.name}` : "Home Delivery"}</span>
        </span>
      );
    }

    return <span className="text-slate-400">N/A</span>;
  };

  const filteredOrders = orders.filter((o) => {
    const q = search.toLowerCase();
    const tableNum = o.tableId?.tableNumber || o.table?.tableNumber || o.tableNumber || "";
    const customerName = o.customerId?.name || "";
    const priceStr = getOrderTotal(o);

    const matchesSearch =
      o.orderNumber?.toLowerCase().includes(q) ||
      tableNum.toLowerCase().includes(q) ||
      customerName.toLowerCase().includes(q) ||
      o.orderType?.toLowerCase().includes(q) ||
      o.status?.toLowerCase().includes(q) ||
      priceStr.includes(q);

    const matchesStatus =
      statusFilter === "ALL" || o.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate total revenue of all loaded orders
  const totalRevenue = orders.reduce((acc, o) => acc + Number(getOrderTotal(o)), 0);

  return (
    <div className="flex h-screen w-screen bg-slate-100 overflow-hidden font-sans">
      <div className="hidden lg:block shrink-0">
        <POSSidebar activePath="/restaurant/orders" />
      </div>

      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 h-full overflow-y-auto">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-700">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Restaurant Orders</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {orders.length} orders
                </span>
              </h1>
              <p className="text-[11px] text-slate-500">
                {user?.restaurantName || "Cobolt Kitchen & Bar"} • Live Orders, Billing Price & Status
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <SoundControl />

            <button
              onClick={loadOrders}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Refresh Orders"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-600" : ""}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/restaurant/pos"
              className="py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all"
            >
              <Receipt className="w-4 h-4" />
              <span>Create Order in POS</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </header>

        {/* Content */}
        <div className="p-6 max-w-7xl mx-auto w-full space-y-4">
          {/* Quick Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Revenue
                </span>
                <span className="text-xl font-black text-teal-700 font-mono">
                  ₹{totalRevenue.toFixed(2)}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-600">
                <IndianRupee className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Orders Placed
                </span>
                <span className="text-xl font-black text-slate-900 font-mono">
                  {orders.length}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600">
                <Receipt className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Completed / Paid Orders
                </span>
                <span className="text-xl font-black text-emerald-700 font-mono">
                  {orders.filter((o) => o.status === "COMPLETED").length}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Search bar & Filter Pills */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search orders by number, table (e.g. T-03), price, status..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500 focus:bg-white transition-all"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
              {["ALL", "PREPARING", "READY", "BILLED", "COMPLETED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
                    statusFilter === st
                      ? "bg-teal-600 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {st}
                </button>
              ))}
              <span className="text-slate-400 text-xs font-semibold px-1 shrink-0">
                {filteredOrders.length} Orders
              </span>
            </div>
          </div>

          {/* Table of Orders */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Table / Detail</th>
                    <th className="py-3 px-4">Items</th>
                    <th className="py-3 px-4 text-right">Price (Total)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-600" />
                        <span>Loading orders...</span>
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <UtensilsCrossed className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-slate-700">No Orders Found</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Create your first order using the POS Billing screen
                        </p>
                        <Link
                          href="/restaurant/pos"
                          className="mt-3 inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-teal-600 text-white text-xs font-bold"
                        >
                          Go to POS Billing
                        </Link>
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      const totalFormatted = getOrderTotal(order);
                      const isCompleted = order.status === "COMPLETED";
                      const isPreparing = order.status === "PREPARING" || order.status === "IN_KITCHEN";
                      const isReady = order.status === "READY";
                      const isBilled = order.status === "BILLED";

                      return (
                        <tr key={order._id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                            {order.orderNumber}
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-medium">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold">
                              {order.orderType}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {getTableDetail(order)}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            <span className="font-semibold text-slate-800">
                              {order.items?.length || 0} items
                            </span>
                          </td>
                          {/* Dedicated Price Column */}
                          <td className="py-3 px-4 text-right">
                            <span className="text-xs font-extrabold text-slate-900 font-mono bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                              ₹{totalFormatted}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                isCompleted
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : isReady
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                  : isBilled
                                  ? "bg-teal-50 text-teal-700 border-teal-200"
                                  : isPreparing
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
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
                              Open in POS →
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