"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { POSSidebar } from "../../../components/pos/POSSidebar";
import { useAuth } from "../../../context/AuthContext";
import { apiClient } from "../../../lib/apiClient";
import { getSocket } from "../../../lib/socket";
import {
  ChefHat,
  Receipt,
  RefreshCw,
  ArrowRight,
  Clock,
  Flame,
  BellRing,
  Utensils,
  Check,
  Loader2,
  X,
  Printer,
  Download,
  CreditCard,
  Smartphone,
  Banknote,
  CheckCircle2,
  AlertCircle,
  FileText,
  Sun,
  Moon,
} from "lucide-react";

export default function KitchenDisplayPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<"ALL" | "PREPARING" | "READY" | "BILLED">("ALL");
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
  
  // Theme state: defaults to 'light' per user request, with option to toggle
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // In-Screen Bill State (NO redirection to /restaurant/pos)
  const [activeBillInvoice, setActiveBillInvoice] = useState<any | null>(null);
  const [isBillModalOpen, setIsBillModalOpen] = useState<boolean>(false);
  const [generatingBillId, setGeneratingBillId] = useState<string | null>(null);
  const [settlingPayment, setSettlingPayment] = useState<boolean>(false);
  const [printingReceipt, setPrintingReceipt] = useState<boolean>(false);
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);

  // Toast Banner State
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    setCurrentTimeMs(Date.now());
    const interval = setInterval(() => setCurrentTimeMs(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);

  const loadKitchenOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data?: any[] }>("/restaurant/orders");
      if (res.success && Array.isArray(res.data)) {
        // Active kitchen orders include CONFIRMED, PREPARING, IN_KITCHEN, READY, SERVED, and BILLED
        const active = res.data.filter(
          (o) =>
            o.status === "CONFIRMED" ||
            o.status === "IN_KITCHEN" ||
            o.status === "PREPARING" ||
            o.status === "READY" ||
            o.status === "SERVED" ||
            o.status === "BILLED"
        );
        setOrders(active);
      }
    } catch (err) {
      console.warn("Failed to load kitchen tickets:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKitchenOrders();

    // Listen to real-time socket events for new orders & status updates
    const socket = getSocket();
    if (!socket) return;

    const handleUpdate = () => {
      loadKitchenOrders();
    };

    socket.on("order:created", handleUpdate);
    socket.on("order:updated", handleUpdate);
    socket.on("kot:updated", handleUpdate);
    socket.on("kitchen:order-ready", handleUpdate);

    return () => {
      socket.off("order:created", handleUpdate);
      socket.off("order:updated", handleUpdate);
      socket.off("kot:updated", handleUpdate);
      socket.off("kitchen:order-ready", handleUpdate);
    };
  }, [loadKitchenOrders]);

  // Update order status: PREPARING (Working) -> READY (Food Ready) -> SERVED -> COMPLETED
  const updateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      const res = await apiClient.patch<{ success: boolean; data?: any }>(
        `/restaurant/orders/${orderId}`,
        { status: newStatus }
      );
      if (res.success) {
        if (newStatus === "COMPLETED") {
          // Remove from active kitchen queue
          setOrders((prev) => prev.filter((o) => o._id !== orderId));
          showToast("Order completed and cleared from kitchen display!", "success");
        } else {
          setOrders((prev) =>
            prev.map((o) => (o._id === orderId ? { ...o, status: newStatus } : o))
          );
          showToast(`Status updated to ${newStatus}`, "info");
        }
      }
    } catch (err: any) {
      showToast("Failed to update status: " + (err.message || "Unknown error"), "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // Generate Bill directly ON SCREEN (Does NOT navigate away to /restaurant/pos)
  const handleGenerateBillOnScreen = async (order: any) => {
    setGeneratingBillId(order._id);
    try {
      // 1. First check if an invoice has already been generated for this order
      const listRes = await apiClient.get<{ success: boolean; invoices?: any[]; data?: any[] }>(
        "/restaurant/billing/invoices",
        { orderId: order._id }
      );
      const invoices = listRes.invoices || (Array.isArray(listRes.data) ? listRes.data : []);
      let invoice = invoices.find(
        (inv: any) =>
          inv.orderId === order._id ||
          inv.orderId?._id === order._id ||
          inv.orderId?.toString?.() === order._id
      );

      // 2. If not generated yet, call the invoice creation API
      if (!invoice) {
        const createRes = await apiClient.post<{ success: boolean; data?: any }>(
          "/restaurant/billing/invoices",
          {
            orderId: order._id,
            idempotencyKey: `inv-${order._id}-${Date.now()}`,
          }
        );
        if (createRes.success && createRes.data) {
          invoice = createRes.data;
        }
      }

      if (invoice) {
        setActiveBillInvoice(invoice);
        setIsBillModalOpen(true);
        // Mark local order as BILLED
        setOrders((prev) =>
          prev.map((o) =>
            o._id === order._id
              ? {
                  ...o,
                  status: "BILLED",
                  invoiceNumber: invoice.invoiceNumber,
                  invoiceId: invoice._id,
                }
              : o
          )
        );
        showToast(`Tax Invoice #${invoice.invoiceNumber} generated!`, "success");
      } else {
        showToast("Could not generate invoice. Please retry.", "error");
      }
    } catch (err: any) {
      const msg = err.message || "";
      // If invoice was already issued, recover it
      if (msg.includes("already been issued") || msg.includes("already exists")) {
        try {
          const listRes = await apiClient.get<any>("/restaurant/billing/invoices", {
            orderId: order._id,
          });
          const list = listRes.invoices || (Array.isArray(listRes.data) ? listRes.data : []);
          if (list.length > 0) {
            setActiveBillInvoice(list[0]);
            setIsBillModalOpen(true);
            return;
          }
        } catch {}
      }
      showToast(msg || "Failed to generate bill on screen", "error");
    } finally {
      setGeneratingBillId(null);
    }
  };

  // Quick Payment Settlement right in the on-screen bill modal
  const handleQuickSettlePayment = async (method: "CASH" | "UPI" | "CARD") => {
    if (!activeBillInvoice) return;
    setSettlingPayment(true);
    try {
      const amount = Number(activeBillInvoice.balanceAmount || activeBillInvoice.grandTotal || 0);
      const payload: any = {
        amount,
        paymentMethod: method,
        idempotencyKey: `pay-${activeBillInvoice._id}-${Date.now()}`,
        notes: `Settled from Kitchen Screen (${method})`,
      };
      if (method === "CASH") {
        payload.cashDetails = { cashReceived: amount };
      } else if (method === "UPI") {
        payload.transactionReference = `UPI-${Date.now().toString().slice(-6)}`;
      } else if (method === "CARD") {
        payload.transactionReference = `CARD-POS-${Date.now().toString().slice(-4)}`;
      }

      const res = await apiClient.post<{ success: boolean; data?: any }>(
        `/restaurant/billing/invoices/${activeBillInvoice._id}/payments`,
        payload
      );

      if (res.success) {
        showToast(`Payment of ₹${amount.toFixed(2)} received via ${method}!`, "success");
        setActiveBillInvoice((prev: any) =>
          prev
            ? {
                ...prev,
                paymentStatus: "PAID",
                paidAmount: amount,
                balanceAmount: 0,
              }
            : null
        );
        // Refresh orders list
        loadKitchenOrders();
      }
    } catch (err: any) {
      showToast("Payment failed: " + (err.message || "Unknown error"), "error");
    } finally {
      setSettlingPayment(false);
    }
  };

  // Print Thermal Receipt using hidden iframe directly on screen
  const handlePrintReceipt = async () => {
    if (!activeBillInvoice) return;
    setPrintingReceipt(true);
    try {
      const res = await apiClient.get<{
        success: boolean;
        data?: { htmlReceipt?: string };
      }>(`/restaurant/billing/invoices/${activeBillInvoice._id}/receipt`);

      if (res.success && res.data?.htmlReceipt) {
        const printFrame = document.createElement("iframe");
        printFrame.style.position = "absolute";
        printFrame.style.top = "-9999px";
        printFrame.style.left = "-9999px";
        document.body.appendChild(printFrame);

        const frameDoc = printFrame.contentWindow?.document;
        if (frameDoc) {
          frameDoc.open();
          frameDoc.write(res.data.htmlReceipt);
          frameDoc.close();

          setTimeout(() => {
            printFrame.contentWindow?.focus();
            printFrame.contentWindow?.print();
            setTimeout(() => {
              if (document.body.contains(printFrame)) {
                document.body.removeChild(printFrame);
              }
            }, 1000);
          }, 300);
        }
      } else {
        window.print();
      }
      showToast("Print command dispatched!", "info");
    } catch {
      window.print();
    } finally {
      setPrintingReceipt(false);
    }
  };

  // Download PDF tax invoice
  const handleDownloadPdf = async () => {
    if (!activeBillInvoice) return;
    setDownloadingPdf(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("kot_access_token") : null;
      const response = await fetch(
        `http://localhost:5000/api/restaurant/billing/invoices/${activeBillInvoice._id}/pdf`,
        {
          headers: {
            Authorization: `Bearer ${token || ""}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to download PDF invoice");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${activeBillInvoice.invoiceNumber || "Bill"}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast("Invoice PDF downloaded!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to download PDF", "error");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const getElapsedTime = (createdAt: string) => {
    if (!createdAt || !currentTimeMs) return "Just now";
    const diffMs = currentTimeMs - new Date(createdAt).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins === 1) return "1 min ago";
    return `${diffMins} mins ago`;
  };

  const filteredOrders = orders.filter((o) => {
    if (filterTab === "PREPARING") {
      return o.status === "PREPARING" || o.status === "CONFIRMED";
    }
    if (filterTab === "READY") {
      return o.status === "READY" || o.status === "SERVED";
    }
    if (filterTab === "BILLED") {
      return o.status === "BILLED";
    }
    return true;
  });

  const preparingCount = orders.filter(
    (o) => o.status === "PREPARING" || o.status === "CONFIRMED"
  ).length;
  const readyCount = orders.filter(
    (o) => o.status === "READY" || o.status === "SERVED"
  ).length;
  const billedCount = orders.filter((o) => o.status === "BILLED").length;

  return (
    <div className="flex h-screen w-screen bg-slate-100 overflow-hidden font-sans">
      <div className="hidden lg:block shrink-0">
        <POSSidebar activePath="/restaurant/kitchen" />
      </div>

      <main
        className={`flex-1 flex flex-col min-w-0 h-full overflow-y-auto transition-colors duration-200 ${
          isDarkMode ? "bg-slate-900 text-white" : "bg-slate-50/80 text-slate-900"
        }`}
      >
        {/* Header Bar */}
        <header
          className={`h-16 px-6 flex items-center justify-between shrink-0 border-b transition-colors duration-200 ${
            isDarkMode
              ? "bg-slate-950 border-slate-800"
              : "bg-white border-slate-200/90 shadow-2xs"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${
                isDarkMode
                  ? "bg-teal-500/10 border border-teal-500/30 text-teal-400"
                  : "bg-teal-50 border border-teal-200 text-teal-700 shadow-2xs"
              }`}
            >
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h1
                className={`text-base font-extrabold tracking-tight flex items-center gap-2 ${
                  isDarkMode ? "text-white" : "text-slate-900"
                }`}
              >
                <span>Kitchen Display System (KDS)</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              </h1>
              <p
                className={`text-[11px] font-medium ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                {user?.restaurantName || "Cobolt Kitchen & Bar"} • Live Kitchen Expediter
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Theme Toggle (Light / Dark) */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                isDarkMode
                  ? "border-slate-800 bg-slate-900 text-amber-300 hover:bg-slate-800"
                  : "border-slate-200 bg-slate-100/80 text-slate-700 hover:bg-slate-200"
              }`}
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Light Theme</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-indigo-600" />
                  <span className="hidden sm:inline">Dark Theme</span>
                </>
              )}
            </button>

            {/* Refresh Button */}
            <button
              onClick={loadKitchenOrders}
              className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                isDarkMode
                  ? "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-600" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* POS Billing Link */}
            <Link
              href="/restaurant/pos"
              className="py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all"
            >
              <Receipt className="w-4 h-4" />
              <span>Go to POS</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </header>

        {/* Content Container */}
        <div className="p-6 max-w-7xl mx-auto w-full space-y-5">
          {/* Top Filter Tabs & Stats Bar */}
          <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-2xl border transition-colors ${
              isDarkMode
                ? "bg-slate-950 border-slate-800"
                : "bg-white border-slate-200/90 shadow-2xs"
            }`}
          >
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setFilterTab("ALL")}
                className={`py-1.5 px-3 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
                  filterTab === "ALL"
                    ? "bg-teal-600 text-white shadow-xs"
                    : isDarkMode
                    ? "text-slate-400 hover:text-white hover:bg-slate-900"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                All Tickets ({orders.length})
              </button>

              <button
                onClick={() => setFilterTab("PREPARING")}
                className={`py-1.5 px-3 rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  filterTab === "PREPARING"
                    ? "bg-amber-500 text-white shadow-xs"
                    : isDarkMode
                    ? "text-slate-400 hover:text-white hover:bg-slate-900"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Working / Preparing ({preparingCount})</span>
              </button>

              <button
                onClick={() => setFilterTab("READY")}
                className={`py-1.5 px-3 rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  filterTab === "READY"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : isDarkMode
                    ? "text-slate-400 hover:text-white hover:bg-slate-900"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>Food Ready ({readyCount})</span>
              </button>

              <button
                onClick={() => setFilterTab("BILLED")}
                className={`py-1.5 px-3 rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  filterTab === "BILLED"
                    ? "bg-teal-700 text-white shadow-xs"
                    : isDarkMode
                    ? "text-slate-400 hover:text-white hover:bg-slate-900"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Billed ({billedCount})</span>
              </button>
            </div>

            <div
              className={`flex items-center gap-4 text-xs font-bold px-3 py-1 rounded-xl transition-colors ${
                isDarkMode ? "text-slate-400" : "text-slate-600 bg-slate-50 border border-slate-200/60"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <span>Cooking: {preparingCount}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Ready: {readyCount}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                <span>Billed: {billedCount}</span>
              </span>
            </div>
          </div>

          {/* Cards Grid */}
          {loading ? (
            <div className="py-24 text-center text-slate-500 text-xs">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-teal-600" />
              <span className="font-semibold">Syncing kitchen display...</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div
              className={`py-20 text-center rounded-3xl p-8 border border-dashed transition-colors ${
                isDarkMode
                  ? "border-slate-800 bg-slate-950/40"
                  : "border-slate-300 bg-white shadow-xs"
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 mx-auto mb-3">
                <ChefHat className="w-7 h-7" />
              </div>
              <p
                className={`text-base font-extrabold ${
                  isDarkMode ? "text-slate-200" : "text-slate-800"
                }`}
              >
                All Cooking Orders Cleared!
              </p>
              <p
                className={`text-xs mt-1 max-w-md mx-auto ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                No active orders in this queue. New KOTs dispatched from POS billing will appear here in real-time.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredOrders.map((order) => {
                const isReady = order.status === "READY";
                const isPreparing = order.status === "PREPARING";
                const isConfirmed = order.status === "CONFIRMED";
                const isServed = order.status === "SERVED";
                const isBilled = order.status === "BILLED";
                const isUpdating = updatingId === order._id;
                const isGenerating = generatingBillId === order._id;

                const tableText = order.tableId?.tableNumber
                  ? `Table ${order.tableId.tableNumber}${order.tableId.floor ? ` (${order.tableId.floor})` : ""}`
                  : order.table?.tableName
                  ? `Table ${order.table.tableName}`
                  : order.orderType;

                // Consolidate identical items in ticket display
                const consolidatedItems: any[] = [];
                const itemMap = new Map<string, any>();
                (order.items || []).forEach((item: any) => {
                  const key = `${item.menuItemId || item._id}-${item.notes || ""}`;
                  const qty = Number(item.quantity) || 1;
                  const price = Number(item.price) || 0;
                  if (itemMap.has(key)) {
                    itemMap.get(key).quantity += qty;
                  } else {
                    const record = {
                      name: item.name || item.itemName,
                      quantity: qty,
                      price: price,
                      notes: item.notes,
                    };
                    itemMap.set(key, record);
                    consolidatedItems.push(record);
                  }
                });

                return (
                  <div
                    key={order._id}
                    className={`rounded-2xl border flex flex-col justify-between transition-all duration-200 overflow-hidden ${
                      isDarkMode
                        ? isReady
                          ? "bg-slate-950 border-emerald-500/80 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/50"
                          : isBilled
                          ? "bg-slate-950 border-teal-500/70 shadow-md shadow-teal-500/5 ring-1 ring-teal-500/30"
                          : isPreparing
                          ? "bg-slate-950 border-amber-500/50 shadow-md shadow-amber-500/5 ring-1 ring-amber-500/30"
                          : "bg-slate-950 border-slate-800 shadow-sm"
                        : isReady
                        ? "bg-white border-emerald-400 ring-2 ring-emerald-400/30 shadow-lg shadow-emerald-500/5"
                        : isBilled
                        ? "bg-white border-teal-400 ring-1 ring-teal-400/30 shadow-md shadow-teal-500/5"
                        : isPreparing
                        ? "bg-white border-amber-400 ring-1 ring-amber-400/30 shadow-md shadow-amber-500/5"
                        : "bg-white border-slate-200 shadow-xs hover:shadow-md"
                    }`}
                  >
                    {/* Top Status Accent Bar */}
                    <div
                      className={`h-1.5 w-full ${
                        isReady
                          ? "bg-emerald-500"
                          : isBilled
                          ? "bg-teal-600"
                          : isPreparing
                          ? "bg-amber-500"
                          : "bg-slate-300"
                      }`}
                    />

                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Card Header: Order #, Table, Elapsed Time */}
                        <div
                          className={`flex items-start justify-between pb-3.5 mb-3.5 border-b ${
                            isDarkMode ? "border-slate-800" : "border-slate-100"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-base font-black font-mono tracking-tight ${
                                  isDarkMode ? "text-teal-400" : "text-slate-900"
                                }`}
                              >
                                {order.orderNumber}
                              </span>
                              <span
                                className={`text-[11px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded-md ${
                                  isDarkMode
                                    ? "text-slate-400 bg-slate-900 border border-slate-800"
                                    : "text-slate-600 bg-slate-100 border border-slate-200/70"
                                }`}
                              >
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>{getElapsedTime(order.createdAt)}</span>
                              </span>
                            </div>

                            <div className="mt-1.5 flex items-center gap-2">
                              <span
                                className={`text-xs font-black px-2.5 py-0.5 rounded-lg border ${
                                  isDarkMode
                                    ? "bg-slate-900 border-slate-700 text-teal-300"
                                    : "bg-teal-50 border-teal-200 text-teal-800"
                                }`}
                              >
                                {tableText}
                              </span>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border shadow-2xs ${
                              isReady
                                ? isDarkMode
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse"
                                  : "bg-emerald-100 text-emerald-800 border-emerald-300 animate-pulse"
                                : isBilled
                                ? isDarkMode
                                  ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                                  : "bg-teal-100 text-teal-800 border-teal-300"
                                : isPreparing
                                ? isDarkMode
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                  : "bg-amber-100 text-amber-800 border-amber-300"
                                : isServed
                                ? isDarkMode
                                  ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                                  : "bg-blue-100 text-blue-800 border-blue-300"
                                : isDarkMode
                                ? "bg-slate-800 text-slate-300 border-slate-700"
                                : "bg-slate-100 text-slate-700 border-slate-300"
                            }`}
                          >
                            {order.status}
                          </span>
                        </div>

                        {/* Ready Food Callout */}
                        {isReady && (
                          <div
                            className={`mb-3.5 p-3 rounded-xl border flex items-center gap-2.5 text-xs font-extrabold ${
                              isDarkMode
                                ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300"
                                : "bg-emerald-50/90 border-emerald-200 text-emerald-800 shadow-2xs"
                            }`}
                          >
                            <BellRing className="w-4 h-4 text-emerald-600 animate-bounce shrink-0" />
                            <span>Food is Prepared & Ready to Serve!</span>
                          </div>
                        )}

                        {/* Billed Callout */}
                        {isBilled && (
                          <div
                            className={`mb-3.5 p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                              isDarkMode
                                ? "bg-teal-950/60 border-teal-500/50 text-teal-300"
                                : "bg-teal-50/90 border-teal-200 text-teal-900 shadow-2xs"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Receipt className="w-4 h-4 text-teal-600" />
                              <span>Invoice Generated</span>
                            </span>
                            <span className="font-mono font-black text-[11px]">
                              {order.invoiceNumber || ""}
                            </span>
                          </div>
                        )}

                        {/* Items List (Consolidated with readable Rupee Prices) */}
                        <div className="space-y-2 mb-4">
                          {consolidatedItems.map((item: any, idx: number) => (
                            <div
                              key={idx}
                              className={`flex items-start justify-between text-xs p-2.5 rounded-xl border transition-colors ${
                                isDarkMode
                                  ? "bg-slate-900/60 border-slate-800/80 text-slate-200"
                                  : "bg-slate-50/90 border-slate-200/70 text-slate-800 hover:bg-slate-100/60"
                              }`}
                            >
                              <div className="flex-1 pr-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-1.5 py-0.5 rounded font-black text-xs ${
                                      isDarkMode
                                        ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                                        : "bg-teal-100 text-teal-800 border border-teal-200"
                                    }`}
                                  >
                                    {item.quantity}x
                                  </span>
                                  <span
                                    className={`font-bold text-sm ${
                                      isDarkMode ? "text-white" : "text-slate-900"
                                    }`}
                                  >
                                    {item.name}
                                  </span>
                                </div>
                                {item.notes && (
                                  <div className="mt-1">
                                    <span
                                      className={`text-[11px] font-semibold px-2 py-0.5 rounded border inline-block ${
                                        isDarkMode
                                          ? "text-amber-300 bg-amber-950/50 border-amber-500/40"
                                          : "text-amber-900 bg-amber-50 border-amber-200"
                                      }`}
                                    >
                                      Special Note: &quot;{item.notes}&quot;
                                    </span>
                                  </div>
                                )}
                              </div>
                              <span
                                className={`text-xs font-mono font-bold shrink-0 ${
                                  isDarkMode ? "text-slate-300" : "text-slate-700"
                                }`}
                              >
                                ₹{(item.price * item.quantity).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Bottom Action Controls */}
                      <div
                        className={`pt-3.5 border-t space-y-2 ${
                          isDarkMode ? "border-slate-800/80" : "border-slate-100"
                        }`}
                      >
                        {/* Step 1: CONFIRMED -> Click "Start Preparing (Working)" */}
                        {isConfirmed && (
                          <button
                            onClick={() => updateStatus(order._id, "PREPARING")}
                            disabled={isUpdating}
                            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            {isUpdating ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Flame className="w-4 h-4 text-white" />
                            )}
                            <span>Start Preparing (Working)</span>
                          </button>
                        )}

                        {/* Step 2: PREPARING -> Click "Mark Food as Ready" */}
                        {isPreparing && (
                          <button
                            onClick={() => updateStatus(order._id, "READY")}
                            disabled={isUpdating}
                            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            {isUpdating ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4 text-white" />
                            )}
                            <span>Mark Food as Ready</span>
                          </button>
                        )}

                        {/* Step 3: READY -> Generate Bill Directly On Screen + Mark as Served */}
                        {isReady && (
                          <div className="space-y-2">
                            <button
                              onClick={() => handleGenerateBillOnScreen(order)}
                              disabled={isGenerating}
                              className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                            >
                              {isGenerating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Receipt className="w-4 h-4" />
                              )}
                              <span>Generate Bill (On Screen)</span>
                            </button>

                            <button
                              onClick={() => updateStatus(order._id, "SERVED")}
                              disabled={isUpdating}
                              className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                                isDarkMode
                                  ? "bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300"
                                  : "bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700"
                              }`}
                            >
                              <Utensils className="w-3.5 h-3.5 text-blue-600" />
                              <span>Mark as Served</span>
                            </button>
                          </div>
                        )}

                        {/* Step 4: SERVED -> Generate Bill Directly On Screen */}
                        {isServed && (
                          <div className="space-y-2">
                            <button
                              onClick={() => handleGenerateBillOnScreen(order)}
                              disabled={isGenerating}
                              className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                            >
                              {isGenerating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Receipt className="w-4 h-4" />
                              )}
                              <span>Generate Bill (On Screen)</span>
                            </button>
                          </div>
                        )}

                        {/* Step 5: BILLED -> View & Print Bill On Screen + Complete */}
                        {isBilled && (
                          <div className="space-y-2">
                            <button
                              onClick={() => handleGenerateBillOnScreen(order)}
                              disabled={isGenerating}
                              className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                            >
                              <Receipt className="w-4 h-4" />
                              <span>View & Print Bill</span>
                            </button>

                            <button
                              onClick={() => updateStatus(order._id, "COMPLETED")}
                              disabled={isUpdating}
                              className={`w-full py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                                isDarkMode
                                  ? "bg-slate-900 border border-emerald-600/50 hover:bg-emerald-950/40 text-emerald-300"
                                  : "bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Mark Completed & Clear</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Toast Notification Container */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold transition-all animate-in slide-in-from-bottom-5 ${
            isDarkMode
              ? "bg-slate-950 border-slate-700 text-white"
              : "bg-white border-slate-200 text-slate-900"
          }`}
        >
          {toast.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
          {toast.type === "error" && <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
          {toast.type === "info" && <Receipt className="w-4 h-4 text-teal-600 shrink-0" />}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* On-Screen Tax Invoice & Bill Modal (DOES NOT LEAVE KITCHEN SCREEN) */}
      {isBillModalOpen && activeBillInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white text-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shadow-2xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-slate-900">
                      Tax Invoice & Bill
                    </h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        activeBillInvoice.paymentStatus === "PAID"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {activeBillInvoice.paymentStatus || "UNPAID"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono font-medium">
                    #{activeBillInvoice.invoiceNumber} • {user?.restaurantName || "Cobolt Kitchen & Bar"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                  title="Download Tax Invoice PDF"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>{downloadingPdf ? "Exporting..." : "PDF"}</span>
                </button>

                <button
                  onClick={handlePrintReceipt}
                  disabled={printingReceipt}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 text-white hover:bg-teal-700 text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  title="Print Thermal 80mm/58mm Receipt"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{printingReceipt ? "Printing..." : "Print Bill"}</span>
                </button>

                <button
                  onClick={() => setIsBillModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Scrollable Bill Details */}
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Restaurant & Bill Metadata Box */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                    Order / Table
                  </span>
                  <span className="font-extrabold text-slate-800">
                    {activeBillInvoice.tableNumber ? `Table ${activeBillInvoice.tableNumber}` : "Direct Order"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                    Date & Time
                  </span>
                  <span className="font-bold text-slate-800">
                    {activeBillInvoice.issuedAt || activeBillInvoice.createdAt
                      ? new Date(activeBillInvoice.issuedAt || activeBillInvoice.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })
                      : "Just now"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                    Payment Status
                  </span>
                  <span
                    className={`font-black ${
                      activeBillInvoice.paymentStatus === "PAID" ? "text-emerald-600" : "text-amber-600"
                    }`}
                  >
                    {activeBillInvoice.paymentStatus === "PAID" ? "Settled (PAID)" : "Pending Payment"}
                  </span>
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4">Item</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Price</th>
                      <th className="py-2.5 px-4 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(activeBillInvoice.items || []).map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-4 font-bold text-slate-800">
                          {item.name}
                        </td>
                        <td className="py-2.5 px-3 text-center font-extrabold text-teal-700">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          ₹{Number(item.price || 0).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                          ₹{Number(item.itemTotal || item.price * item.quantity || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals & Tax Calculation Breakdown */}
              <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>Subtotal:</span>
                  <span className="font-mono font-bold text-slate-800">
                    ₹{Number(activeBillInvoice.subtotal || 0).toFixed(2)}
                  </span>
                </div>

                {activeBillInvoice.taxDetails?.cgst > 0 && (
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>CGST (2.5%):</span>
                    <span className="font-mono">
                      ₹{Number(activeBillInvoice.taxDetails.cgst).toFixed(2)}
                    </span>
                  </div>
                )}

                {activeBillInvoice.taxDetails?.sgst > 0 && (
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>SGST (2.5%):</span>
                    <span className="font-mono">
                      ₹{Number(activeBillInvoice.taxDetails.sgst).toFixed(2)}
                    </span>
                  </div>
                )}

                {activeBillInvoice.discount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Discount:</span>
                    <span className="font-mono">
                      -₹{Number(activeBillInvoice.discount).toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-extrabold text-slate-900">
                  <span className="text-base">Grand Total:</span>
                  <span className="text-xl font-mono text-teal-700">
                    ₹{Number(activeBillInvoice.grandTotal || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Quick Payment Settlement in Modal (Cash, UPI, Card) */}
              {activeBillInvoice.paymentStatus !== "PAID" && (
                <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-200/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-teal-700" />
                      <span>Settle Bill Payment Right Now:</span>
                    </span>
                    <span className="text-xs font-mono font-bold text-teal-800">
                      Amount: ₹{Number(activeBillInvoice.balanceAmount || activeBillInvoice.grandTotal || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleQuickSettlePayment("CASH")}
                      disabled={settlingPayment}
                      className="py-2.5 px-3 rounded-xl bg-white border border-teal-300 text-teal-800 hover:bg-teal-100/60 text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Banknote className="w-4 h-4 text-emerald-600" />
                      <span>Pay Cash</span>
                    </button>

                    <button
                      onClick={() => handleQuickSettlePayment("UPI")}
                      disabled={settlingPayment}
                      className="py-2.5 px-3 rounded-xl bg-white border border-teal-300 text-teal-800 hover:bg-teal-100/60 text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Smartphone className="w-4 h-4 text-blue-600" />
                      <span>Pay UPI</span>
                    </button>

                    <button
                      onClick={() => handleQuickSettlePayment("CARD")}
                      disabled={settlingPayment}
                      className="py-2.5 px-3 rounded-xl bg-white border border-teal-300 text-teal-800 hover:bg-teal-100/60 text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                    >
                      <CreditCard className="w-4 h-4 text-purple-600" />
                      <span>Pay Card</span>
                    </button>
                  </div>
                </div>
              )}

              {activeBillInvoice.paymentStatus === "PAID" && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>This invoice has been settled in full. Receipt is ready to hand to customer.</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/80">
              <span className="text-xs text-slate-500 font-medium">
                KDS In-Screen Billing Terminal
              </span>
              <button
                onClick={() => setIsBillModalOpen(false)}
                className="py-2 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Close Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
