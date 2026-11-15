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
} from "lucide-react";
import { BillRequestOrder } from "../../../types/pos";

export default function BillsPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<BillRequestOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

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
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse shadow-xs">
                    {pendingCount} Pending
                  </span>
                )}
              </h1>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                {user?.restaurantName || "Cobolt Kitchen & Bar"} • Staff Waiter Bill Confirmation Workflow
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
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending Confirmation</p>
                <p className="text-xl font-black text-amber-600 mt-0.5">{pendingCount}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Awaiting cashier authorization</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <Clock className="w-5 h-5" />
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
                    ? "bg-amber-500 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>Pending Requests</span>
                {pendingCount > 0 && <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-white text-amber-700 font-extrabold">{pendingCount}</span>}
              </button>

              <button
                onClick={() => setStatusFilter("CONFIRMED")}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  statusFilter === "CONFIRMED"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Confirmed Bills
              </button>

              <button
                onClick={() => setStatusFilter("ALL")}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  statusFilter === "ALL"
                    ? "bg-teal-700 text-white shadow-xs"
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
                When waiters click &quot;Request Bill / Generate Invoice&quot; in the Staff Mobile PWA, the requests will appear here for cashier confirmation.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {orders.map((order) => {
                const billStatus = order.billRequest?.status || "NOT_REQUESTED";
                const isRequested = billStatus === "REQUESTED";
                const isConfirmed = billStatus === "CONFIRMED";
                const isCancelled = billStatus === "CANCELLED";
                const isConfirming = confirmingId === order._id;
                const isCancelling = cancellingId === order._id;

                const tableLabel = order.tableId?.tableNumber
                  ? `Table ${order.tableId.tableNumber}${order.tableId.floor ? ` (${order.tableId.floor})` : ""}`
                  : order.billRequest?.tableNumber
                  ? `Table ${order.billRequest.tableNumber}`
                  : order.orderType;

                return (
                  <div
                    key={order._id}
                    className={`rounded-2xl border transition-all flex flex-col justify-between overflow-hidden ${
                      isRequested
                        ? "bg-white border-amber-300 ring-1 ring-amber-300/40 shadow-sm"
                        : isConfirmed
                        ? "bg-white border-emerald-300/80 shadow-2xs"
                        : "bg-slate-50/80 border-slate-200 opacity-80"
                    }`}
                  >
                    {/* Top Status Accent Bar */}
                    <div
                      className={`h-1.5 w-full ${
                        isRequested
                          ? "bg-amber-500 animate-pulse"
                          : isConfirmed
                          ? "bg-emerald-500"
                          : "bg-slate-300"
                      }`}
                    />

                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        {/* Header: Order #, Table & Status */}
                        <div className="flex items-start justify-between border-b border-slate-100 pb-2.5">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-black text-sm text-slate-900 tracking-tight">
                                {order.orderNumber}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>{getElapsedTime(order.billRequest?.requestedAt || order.createdAt)}</span>
                              </span>
                            </div>

                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="text-xs font-extrabold px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-800">
                                {tableLabel}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 uppercase px-1.5 py-0.5 rounded bg-slate-100">
                                {order.orderType}
                              </span>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div>
                            {isRequested && (
                              <span className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 animate-pulse flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>Pending Approval</span>
                              </span>
                            )}
                            {isConfirmed && (
                              <span className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Confirmed</span>
                              </span>
                            )}
                            {isCancelled && (
                              <span className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                                <XCircle className="w-3 h-3" />
                                <span>Cancelled</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Requester Info */}
                        <div className="mt-2 text-[11px] text-slate-600 flex items-center gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200/60">
                          <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span className="truncate">
                            Requested by:{" "}
                            <strong className="text-slate-800">
                              {order.billRequest?.requestedBy?.name || "Staff"}
                            </strong>{" "}
                            ({order.billRequest?.requestedBy?.role || "WAITER"})
                          </span>
                        </div>

                        {/* Items List */}
                        <div className="mt-2.5 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {order.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50/80 border border-slate-200/50"
                            >
                              <div className="flex items-baseline gap-1.5 truncate pr-2">
                                <span className="font-black text-[11px] text-teal-800 bg-teal-100 px-1 rounded shrink-0">
                                  {item.quantity}x
                                </span>
                                <span className="font-semibold text-slate-800 truncate">
                                  {item.name}
                                </span>
                                {item.notes && (
                                  <span className="text-[10px] text-amber-700 italic truncate">
                                    ({item.notes})
                                  </span>
                                )}
                              </div>
                              <span className="font-mono font-bold text-slate-700 shrink-0">
                                ₹{item.itemTotal.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Price Breakdown */}
                        <div className="mt-3 pt-2.5 border-t border-slate-200/70 space-y-1 text-xs">
                          <div className="flex justify-between text-slate-500">
                            <span>Subtotal:</span>
                            <span className="font-mono">₹{order.subtotal.toFixed(2)}</span>
                          </div>
                          {order.discount > 0 && (
                            <div className="flex justify-between text-emerald-600 font-semibold">
                              <span>Discount:</span>
                              <span className="font-mono">-₹{order.discount.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-slate-500">
                            <span>Taxes (GST):</span>
                            <span className="font-mono">₹{order.tax.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1 border-t border-dashed border-slate-200">
                            <span>Grand Total:</span>
                            <span className="font-mono text-teal-700 text-base">₹{order.grandTotal.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Confirmed Invoice Info Banner */}
                        {isConfirmed && order.billRequest?.invoiceId && (
                          <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1 text-xs">
                            <div className="flex items-center justify-between font-bold text-emerald-900">
                              <span>Invoice Generated:</span>
                              <span className="font-mono">{order.billRequest.invoiceId.invoiceNumber}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-emerald-700">
                              <span>Payment Status:</span>
                              <span className="font-extrabold uppercase">
                                {order.billRequest.invoiceId.paymentStatus || "UNPAID"}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        {isRequested && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setReviewOrder(order);
                                setIsReviewModalOpen(true);
                              }}
                              className="flex-1 py-2 px-3 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer min-h-[36px]"
                            >
                              <Eye className="w-3.5 h-3.5 text-teal-700" />
                              <span>View Bill</span>
                            </button>

                            <button
                              onClick={() => handleConfirmBill(order)}
                              disabled={isConfirming || isCancelling}
                              className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50 min-h-[36px]"
                            >
                              {isConfirming ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                              <span>Confirm Bill</span>
                            </button>

                            <button
                              onClick={() => handleCancelRequest(order)}
                              disabled={isConfirming || isCancelling}
                              className="py-2 px-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 min-h-[36px]"
                              title="Cancel this request"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {isConfirmed && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openReceiptModal(order)}
                              className="flex-1 py-1.5 px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer min-h-[34px]"
                            >
                              <Printer className="w-3.5 h-3.5 text-slate-600" />
                              <span>Print Receipt</span>
                            </button>

                            <button
                              onClick={() => handleDownloadPdf(order)}
                              disabled={downloadingPdfId === order._id}
                              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all cursor-pointer disabled:opacity-50 min-h-[34px]"
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
                              className="py-1.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition-all min-h-[34px]"
                            >
                              <span>Settle</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
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

      {/* Bill Review & Confirmation Modal */}
      <BillReviewModal
        isOpen={isReviewModalOpen}
        order={reviewOrder}
        onClose={() => setIsReviewModalOpen(false)}
        onConfirm={async (order) => {
          await handleConfirmBill(order);
          setIsReviewModalOpen(false);
        }}
        onCancelRequest={handleCancelRequest}
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
