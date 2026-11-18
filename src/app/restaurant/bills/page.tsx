"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { POSSidebar } from "../../../components/pos/POSSidebar";
import { BillReviewModal } from "../../../components/pos/BillReviewModal";
import { useAuth } from "../../../context/AuthContext";
import { apiClient } from "../../../lib/apiClient";
import { getSocket } from "../../../lib/socket";
import { soundService } from "../../../lib/soundService";
import {
  FileText,
  Receipt,
  RefreshCw,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Printer,
  Download,
  Search,
  Calendar,
  Utensils,
  CreditCard,
  User,
  Check,
  X,
  Loader2,
  Filter,
  Eye,
  ShoppingBag,
} from "lucide-react";
import { BillRequestOrder } from "../../../types/pos";

export default function BillsPage() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState<boolean>(false);
  const [orders, setOrders] = useState<BillRequestOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Review Modal State ("View Bill / Generate Bill")
  const [reviewOrder, setReviewOrder] = useState<BillRequestOrder | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);

  // Filters State
  const [statusFilter, setStatusFilter] = useState<"REQUESTED" | "CONFIRMED" | "ALL">("REQUESTED");
  const [tableSearch, setTableSearch] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Receipt Modal State
  const [receiptModalOrder, setReceiptModalOrder] = useState<BillRequestOrder | null>(null);
  const [receiptData, setReceiptData] = useState<any | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState<boolean>(false);
  const [paperWidth, setPaperWidth] = useState<"58mm" | "80mm">("80mm");
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchBillRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "ALL") {
        params.status = statusFilter;
      } else {
        params.status = "ALL";
      }
      if (tableSearch.trim()) {
        params.tableNumber = tableSearch.trim();
      }
      if (dateFilter) {
        params.date = dateFilter;
      }

      const res = await apiClient.get<{
        success: boolean;
        data?: BillRequestOrder[];
        pendingCount?: number;
      }>("/restaurant/bill-requests", params);

      if (res.success && Array.isArray(res.data)) {
        setOrders(res.data);
        if (typeof res.pendingCount === "number") {
          setPendingCount(res.pendingCount);
        }
      }
    } catch (err: any) {
      console.warn("Error fetching bill requests:", err);
      showToast(err.message || "Failed to load bill requests", "error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, tableSearch, dateFilter]);

  useEffect(() => {
    fetchBillRequests();
  }, [fetchBillRequests]);

  // Real-time synchronization
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleBillRequested = () => {
      soundService.playKitchenBell().catch(() => {});
      showToast("🔔 New bill request received from staff!", "info");
      fetchBillRequests();
    };

    const handleBillConfirmed = () => {
      fetchBillRequests();
    };

    const handleBillCancelled = () => {
      fetchBillRequests();
    };

    socket.on("bill:requested", handleBillRequested);
    socket.on("bill:confirmed", handleBillConfirmed);
    socket.on("bill:cancelled", handleBillCancelled);
    socket.on("order:billed", handleBillConfirmed);

    return () => {
      socket.off("bill:requested", handleBillRequested);
      socket.off("bill:confirmed", handleBillConfirmed);
      socket.off("bill:cancelled", handleBillCancelled);
      socket.off("order:billed", handleBillConfirmed);
    };
  }, [fetchBillRequests]);

  // Confirm Bill Action
  const handleConfirmBill = async (order: BillRequestOrder) => {
    if (!confirm(`Confirm bill request for ${order.orderNumber} (Table ${order.billRequest?.tableNumber || "Takeaway"}) and generate final invoice?`)) {
      return;
    }

    setConfirmingId(order._id);
    try {
      const res = await apiClient.post<{
        success: boolean;
        message?: string;
        invoice?: any;
        data?: BillRequestOrder;
      }>(`/restaurant/orders/${order._id}/bill-request/confirm`);

      if (res.success) {
        showToast(`Bill confirmed! Invoice #${res.invoice?.invoiceNumber || ""} generated.`, "success");
        soundService.playFoodReady().catch(() => {});
        await fetchBillRequests();

        // Automatically offer receipt printing
        if (res.invoice) {
          const updatedOrder: BillRequestOrder = {
            ...order,
            status: "BILLED",
            billRequest: {
              ...order.billRequest,
              status: "CONFIRMED",
              invoiceId: res.invoice,
            },
          };
          openReceiptModal(updatedOrder);
        }
      } else {
        throw new Error(res.message || "Failed to confirm bill request");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to confirm bill request", "error");
    } finally {
      setConfirmingId(null);
    }
  };

  // Cancel Bill Request Action
  const handleCancelRequest = async (order: BillRequestOrder) => {
    const reason = prompt("Enter cancellation reason:", "Order items modified / Guest not ready for bill");
    if (reason === null) return; // User cancelled prompt

    setCancellingId(order._id);
    try {
      const res = await apiClient.post<{ success: boolean; message?: string }>(
        `/restaurant/orders/${order._id}/bill-request/cancel`,
        { reason }
      );

      if (res.success) {
        showToast("Bill request cancelled.", "info");
        await fetchBillRequests();
      } else {
        throw new Error(res.message || "Failed to cancel bill request");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to cancel bill request", "error");
    } finally {
      setCancellingId(null);
    }
  };

  // Open Receipt Modal
  const openReceiptModal = async (order: BillRequestOrder) => {
    const invoiceId = order.billRequest?.invoiceId?._id;
    if (!invoiceId) {
      showToast("No generated invoice found for this order.", "error");
      return;
    }

    setReceiptModalOrder(order);
    setLoadingReceipt(true);
    setReceiptData(null);

    try {
      const res = await apiClient.get<{ success: boolean; data: any }>(
        `/restaurant/billing/invoices/${invoiceId}/receipt?format=${paperWidth}`
      );
      if (res.success && res.data) {
        setReceiptData(res.data);
      }
    } catch (err: any) {
      showToast(err.message || "Failed to fetch thermal receipt", "error");
    } finally {
      setLoadingReceipt(false);
    }
  };

  // Trigger Thermal Browser Print via hidden iframe
  const handlePrintReceipt = () => {
    if (!receiptData?.htmlReceipt) return;

    const printFrame = document.createElement("iframe");
    printFrame.style.position = "absolute";
    printFrame.style.top = "-9999px";
    printFrame.style.left = "-9999px";
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(receiptData.htmlReceipt);
      frameDoc.close();

      setTimeout(() => {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
        setTimeout(() => document.body.removeChild(printFrame), 1000);
      }, 350);
    }
  };

  // Download A4 PDF Invoice
  const handleDownloadPdf = async (order: BillRequestOrder) => {
    const invoiceId = order.billRequest?.invoiceId?._id;
    if (!invoiceId) return;

    setDownloadingPdfId(order._id);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("kot_access_token") : null;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://kot-backend-za5d.onrender.com/api";
      const response = await fetch(`${apiUrl}/restaurant/billing/invoices/${invoiceId}/pdf`, {
        headers: {
          Authorization: `Bearer ${token || ""}`,
        },
      });

      if (!response.ok) throw new Error("Failed to download PDF invoice");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${order.billRequest?.invoiceId?.invoiceNumber || "Bill"}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast("Invoice PDF downloaded!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to download PDF", "error");
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const getElapsedTime = (isoString?: string) => {
    if (!isoString) return "Just now";
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins === 1) return "1 min ago";
    return `${diffMins} mins ago`;
  };

  return (
    <div className="flex h-screen w-screen bg-slate-100 overflow-hidden font-sans">
      <div className="hidden lg:block shrink-0">
        <POSSidebar activePath="/restaurant/bills" />
      </div>

      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 h-full overflow-y-auto">
        {/* Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shadow-2xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Bill Requests & Invoices</span>
                {pendingCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white shadow-xs">
                    {pendingCount} Ready
                  </span>
                )}
              </h1>
              <p suppressHydrationWarning className="text-[11px] text-slate-500 hidden sm:block">
                {(mounted && user?.restaurantName) || "Cobolt Kitchen & Bar"} • Staff Waiter Bill Requests
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchBillRequests}
              disabled={loading}
              className="py-1.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-600" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <Link
              href="/restaurant/pos"
              className="py-1.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>POS Billing</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </header>

        {/* Content Container */}
        <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-4">
          {/* Top Status & Summary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ready Bills</p>
                <p className="text-xl font-black text-emerald-600 mt-0.5">{pendingCount}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Bill requests ready for checkout</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Displayed Requests</p>
                <p className="text-xl font-black text-slate-800 mt-0.5">{orders.length}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Matching current active filters</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
                <Filter className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Value (Current View)</p>
                <p className="text-xl font-black text-slate-900 mt-0.5">
                  ₹{orders.reduce((sum, o) => sum + (o.grandTotal || 0), 0).toFixed(2)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Gross bill request volume</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <button
                onClick={() => setStatusFilter("REQUESTED")}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  statusFilter === "REQUESTED"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>Ready Bills</span>
                {pendingCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-white text-emerald-700 font-extrabold">
                    {pendingCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setStatusFilter("CONFIRMED")}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  statusFilter === "CONFIRMED"
                    ? "bg-teal-700 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Confirmed Bills
              </button>

              <button
                onClick={() => setStatusFilter("ALL")}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  statusFilter === "ALL"
                    ? "bg-slate-800 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All Requests
              </button>
            </div>

            {/* Search and Date Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:w-44">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Table number..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-teal-500 bg-slate-50/50"
                />
              </div>

              <div className="relative">
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="py-1.5 px-3 rounded-xl border border-slate-200 text-xs focus:outline-teal-500 bg-slate-50/50 text-slate-700"
                />
              </div>

              {(tableSearch || dateFilter) && (
                <button
                  onClick={() => {
                    setTableSearch("");
                    setDateFilter("");
                  }}
                  className="py-1.5 px-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-all cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Orders Grid */}
          {loading ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-teal-600" />
              <span>Loading bill requests...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-3 border border-teal-100">
                <FileText className="w-7 h-7" />
              </div>
              <h3 className="text-base font-extrabold text-slate-800">No Bill Requests in this Queue</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                When waiters click &quot;Request Bill&quot; in the Staff Mobile PWA, ready bill requests will appear here.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[760px]">
                  <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Order # & Time</th>
                      <th className="py-3.5 px-4">Table / Service</th>
                      <th className="py-3.5 px-4">Requested By</th>
                      <th className="py-3.5 px-4">Items</th>
                      <th className="py-3.5 px-4 text-right">Amount</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.map((order) => {
                      const billStatus = order.billRequest?.status || "NOT_REQUESTED";
                      const isRequested = billStatus === "REQUESTED";
                      const isConfirmed = billStatus === "CONFIRMED";
                      const isCancelled = billStatus === "CANCELLED";

                      const tableLabel = order.tableId?.tableNumber
                        ? `Table ${order.tableId.tableNumber}${order.tableId.floor ? ` (${order.tableId.floor})` : ""}`
                        : order.billRequest?.tableNumber
                        ? `Table ${order.billRequest.tableNumber}`
                        : order.orderType;

                      return (
                        <tr
                          key={order._id}
                          className="hover:bg-slate-50/80 transition-colors group"
                        >
                          {/* Order # & Time */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="font-mono font-black text-slate-900 text-xs tracking-tight">
                              {order.orderNumber}
                            </div>
                            <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span suppressHydrationWarning>{getElapsedTime(order.billRequest?.requestedAt || order.createdAt)}</span>
                            </div>
                          </td>

                          {/* Table / Service */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="flex flex-col gap-1 items-start">
                              {order.orderType === "DINE_IN" ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200/80 text-teal-800 text-xs font-extrabold shadow-2xs">
                                  <Utensils className="w-3.5 h-3.5 text-teal-600" />
                                  <span>{tableLabel}</span>
                                </span>
                              ) : order.orderType === "TAKEAWAY" ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-bold shadow-2xs">
                                  <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Takeaway</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200/80 text-indigo-800 text-xs font-bold shadow-2xs">
                                  <span>{order.orderType}</span>
                                </span>
                              )}
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                                {order.orderType}
                              </span>
                            </div>
                          </td>

                          {/* Requested By */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="flex items-center gap-2 text-xs">
                              <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-700 shrink-0">
                                <User className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <span className="font-bold text-slate-800 block text-xs">
                                  {order.billRequest?.requestedBy?.name || "Staff"}
                                </span>
                                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                                  {order.billRequest?.requestedBy?.role || "WAITER"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Items Summary */}
                          <td className="py-3.5 px-4 align-top max-w-xs">
                            <div className="space-y-1">
                              {order.items.slice(0, 3).map((item, idx) => (
                                <div key={idx} className="flex items-baseline gap-1.5 text-xs text-slate-700 truncate">
                                  <span className="font-black text-[10px] text-teal-800 bg-teal-50 border border-teal-200/60 px-1 rounded shrink-0">
                                    {item.quantity}x
                                  </span>
                                  <span className="font-semibold truncate text-slate-800">
                                    {item.name}
                                  </span>
                                  {item.notes && (
                                    <span className="text-[10px] text-amber-700 italic truncate">
                                      ({item.notes})
                                    </span>
                                  )}
                                </div>
                              ))}
                              {order.items.length > 3 && (
                                <span className="text-[10px] text-slate-400 font-semibold italic block">
                                  +{order.items.length - 3} more items
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Total Amount */}
                          <td className="py-3.5 px-4 align-top text-right">
                            <div className="font-mono font-black text-slate-900 text-sm">
                              ₹{order.grandTotal.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              Sub: ₹{order.subtotal.toFixed(2)} • GST: ₹{order.tax.toFixed(2)}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 align-top text-center">
                            {isRequested ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span>Ready</span>
                              </span>
                            ) : isConfirmed ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 shadow-2xs">
                                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                                <span>Billed</span>
                              </span>
                            ) : isCancelled ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs">
                                <XCircle className="w-3.5 h-3.5 text-slate-400" />
                                <span>Cancelled</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span>Ready</span>
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 align-top text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setReviewOrder(order);
                                  setIsReviewModalOpen(true);
                                }}
                                className="py-1.5 px-3 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer hover:shadow-xs"
                              >
                                <Eye className="w-3.5 h-3.5 text-teal-700" />
                                <span>View Bill</span>
                              </button>

                              {isConfirmed && (
                                <>
                                  <button
                                    onClick={() => openReceiptModal(order)}
                                    className="py-1.5 px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold inline-flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                                    title="Print Thermal Receipt"
                                  >
                                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                                    <span>Print</span>
                                  </button>

                                  <button
                                    onClick={() => handleDownloadPdf(order)}
                                    disabled={downloadingPdfId === order._id}
                                    className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all cursor-pointer disabled:opacity-50"
                                    title="Download A4 PDF"
                                  >
                                    {downloadingPdfId === order._id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Download className="w-3.5 h-3.5" />
                                    )}
                                  </button>

                                  <Link
                                    href="/restaurant/pos"
                                    className="py-1.5 px-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold inline-flex items-center gap-1 shadow-xs transition-all"
                                  >
                                    <span>Settle</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </Link>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bill Review Modal */}
      <BillReviewModal
        isOpen={isReviewModalOpen}
        order={reviewOrder}
        onClose={() => setIsReviewModalOpen(false)}
        onConfirm={async (order) => {
          await handleConfirmBill(order);
          setIsReviewModalOpen(false);
        }}
        onPrintReceipt={openReceiptModal}
        onDownloadPdf={handleDownloadPdf}
        onSettlePayment={() => {
          window.location.href = "/restaurant/pos";
        }}
        isConfirming={confirmingId === reviewOrder?._id}
      />

      {/* Thermal Receipt Print Modal */}
      {receiptModalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Print Thermal Receipt</h3>
                  <p className="text-[11px] text-slate-500">
                    Order #{receiptModalOrder.orderNumber}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setReceiptModalOrder(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Receipt Paper Size:</span>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                  <button
                    onClick={() => {
                      setPaperWidth("80mm");
                      openReceiptModal(receiptModalOrder);
                    }}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      paperWidth === "80mm" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-500"
                    }`}
                  >
                    80mm (Standard)
                  </button>
                  <button
                    onClick={() => {
                      setPaperWidth("58mm");
                      openReceiptModal(receiptModalOrder);
                    }}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      paperWidth === "58mm" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-500"
                    }`}
                  >
                    58mm (Compact)
                  </button>
                </div>
              </div>

              {loadingReceipt ? (
                <div className="py-16 text-center text-slate-400 text-xs">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
                  <span>Formatting receipt layout...</span>
                </div>
              ) : receiptData?.rawText ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-72 overflow-y-auto">
                  <pre className="font-mono text-[10px] sm:text-xs text-slate-800 whitespace-pre leading-relaxed">
                    {receiptData.rawText}
                  </pre>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">Unable to load receipt preview.</div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setReceiptModalOrder(null)}
                className="py-2 px-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={handlePrintReceipt}
                disabled={!receiptData}
                className="py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-5">
          <div
            className={`px-4 py-3 rounded-2xl shadow-lg border text-xs font-bold flex items-center gap-2 ${
              toast.type === "success"
                ? "bg-emerald-600 text-white border-emerald-500"
                : toast.type === "error"
                ? "bg-rose-600 text-white border-rose-500"
                : "bg-slate-900 text-white border-slate-800"
            }`}
          >
            {toast.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-200" />}
            {toast.type === "error" && <AlertCircle className="w-4 h-4 text-rose-200" />}
            {toast.type === "info" && <FileText className="w-4 h-4 text-teal-300" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
