"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../context/AuthContext";
import { POSProvider, usePOS } from "../../../context/POSContext";
import { POSSidebar } from "../../../components/pos/POSSidebar";
import { BillingSidebar } from "../../../components/pos/BillingSidebar";
import { SimpleBillReceiptModal } from "../../../components/pos/SimpleBillReceiptModal";
import { ToastContainer } from "../../../components/pos/Toast";
import { SoundControl } from "../../../components/common/SoundControl";
import { apiClient } from "../../../lib/apiClient";
import { getSocket } from "../../../lib/socket";
import { soundService } from "../../../lib/soundService";
import { BillRequestOrder, Invoice, MenuItem, PaymentMethod } from "../../../types/pos";
import {
  Receipt,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Utensils,
  ShoppingBag,
  Truck,
  CreditCard,
  User,
  ShieldAlert,
  ArrowRight,
  Eye,
  ChevronRight,
  Printer,
  Sparkles,
} from "lucide-react";

function POSBillingContent() {
  const router = useRouter();
  const { user, loading: authLoading, hasPermission } = useAuth();
  const { addToast } = usePOS();

  // Orders State
  const [orders, setOrders] = useState<BillRequestOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Selected Order for Right-Side Billing Sidebar
  const [selectedOrder, setSelectedOrder] = useState<BillRequestOrder | null>(null);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);

  // Mobile Billing Drawer state
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  // Menu items for add-on selection
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  // Simple Thermal Bill Receipt Modal state
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

  // Filter & Search states
  const [statusFilter, setStatusFilter] = useState<"REQUESTED" | "CONFIRMED" | "ALL">("REQUESTED");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Live Clock
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

  // Fetch Menu Items for Add-ons
  const fetchMenuItems = useCallback(async () => {
    try {
      const res = await apiClient.get<{ success: boolean; data: MenuItem[] }>(
        "/restaurant/menu/items"
      );
      if (res.success && Array.isArray(res.data)) {
        setMenuItems(res.data.filter((item) => item.isAvailable !== false));
      }
    } catch (err) {
      console.warn("Failed to load menu items for add-ons:", err);
    }
  }, []);

  // Fetch Bill Requests from shared backend
  const fetchBillRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "ALL") {
        params.status = statusFilter;
      } else {
        params.status = "ALL";
      }
      if (searchTerm.trim()) {
        params.tableNumber = searchTerm.trim();
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

        // Keep selectedOrder in sync if its status changed
        if (selectedOrder) {
          const updatedSelected = res.data.find((o) => o._id === selectedOrder._id);
          if (updatedSelected) {
            setSelectedOrder(updatedSelected);
          }
        }
      }
    } catch (err: any) {
      console.warn("Error fetching bill requests in POS:", err);
      addToast(err.message || "Failed to load bill requests", "error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm, selectedOrder, addToast]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchBillRequests();
      fetchMenuItems();
    }
  }, [authLoading, user, fetchBillRequests, fetchMenuItems]);

  // Real-time synchronization via Socket.IO
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleBillRequested = () => {
      soundService.playKitchenBell().catch(() => {});
      addToast("🔔 New bill request received from staff!", "info");
      fetchBillRequests();
    };

    const handleBillConfirmed = () => {
      fetchBillRequests();
    };

    const handleBillCancelled = () => {
      fetchBillRequests();
    };

    const handlePaymentRecorded = () => {
      fetchBillRequests();
    };

    socket.on("bill:requested", handleBillRequested);
    socket.on("bill:confirmed", handleBillConfirmed);
    socket.on("bill:cancelled", handleBillCancelled);
    socket.on("order:billed", handleBillConfirmed);
    socket.on("payment:recorded", handlePaymentRecorded);

    return () => {
      socket.off("bill:requested", handleBillRequested);
      socket.off("bill:confirmed", handleBillConfirmed);
      socket.off("bill:cancelled", handleBillCancelled);
      socket.off("order:billed", handleBillConfirmed);
      socket.off("payment:recorded", handlePaymentRecorded);
    };
  }, [fetchBillRequests, addToast]);

  // Protected route check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  if (authLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600 gap-3">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold">Loading POS Terminal...</span>
      </div>
    );
  }

  if (!user) return null;

  const canAccessPOS =
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN" ||
    user.role === "MANAGER" ||
    user.role === "CASHIER" ||
    hasPermission("billing:create") ||
    hasPermission("orders:create") ||
    hasPermission("billing:view");

  if (!canAccessPOS) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800 p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold">Access Restricted</h2>
        <p className="text-sm text-slate-500 max-w-sm mt-1">
          Your current staff role does not have permission to access the POS Billing terminal.
        </p>
        <button
          onClick={() => router.push("/login")}
          className="mt-5 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
        >
          Return to Login
        </button>
      </div>
    );
  }

  // Handle Select Bill
  const handleSelectOrder = (order: BillRequestOrder) => {
    setSelectedOrder(order);
    setIsMobileDrawerOpen(true);
  };

  // Confirm Bill Action (atomic invoice generation with discount, charges, customer info)
  const handleConfirmBill = async (
    orderId: string,
    billingOptions: {
      discount?: {
        type: "PERCENTAGE" | "FIXED";
        value: number;
        reason?: string;
      };
      serviceCharge?: number;
      customerName?: string;
      customerPhone?: string;
    }
  ): Promise<Invoice | null> => {
    setIsConfirming(true);
    try {
      const res = await apiClient.post<{
        success: boolean;
        message?: string;
        invoice?: Invoice;
        data?: BillRequestOrder;
      }>(`/restaurant/orders/${orderId}/bill-request/confirm`, billingOptions);

      if (res.success && res.invoice) {
        soundService.playFoodReady().catch(() => {});
        addToast(`Bill confirmed! Invoice #${res.invoice.invoiceNumber} generated.`, "success");
        await fetchBillRequests();
        return res.invoice;
      } else {
        throw new Error(res.message || "Failed to confirm bill");
      }
    } catch (err: any) {
      addToast(err.message || "Failed to confirm bill", "error");
      return null;
    } finally {
      setIsConfirming(false);
    }
  };

  // Record Payment Action
  const handleRecordPayment = async (
    invoiceId: string,
    paymentData: {
      amount: number;
      paymentMethod: PaymentMethod;
      cashDetails?: { cashReceived: number };
      transactionReference?: string;
      notes?: string;
    }
  ): Promise<boolean> => {
    try {
      const res = await apiClient.post<{ success: boolean; message?: string }>(
        `/restaurant/billing/invoices/${invoiceId}/payments`,
        paymentData
      );

      if (res.success) {
        addToast("Payment recorded successfully! Order settled.", "success");
        soundService.playFoodReady().catch(() => {});
        await fetchBillRequests();
        return true;
      } else {
        throw new Error(res.message || "Payment recording failed");
      }
    } catch (err: any) {
      addToast(err.message || "Payment recording failed", "error");
      return false;
    }
  };

  // Open Simple Thermal Print Receipt
  const handleOpenPrintBill = async (order: BillRequestOrder, invoiceProp?: Invoice) => {
    const invoiceId = invoiceProp?._id || order.billRequest?.invoiceId?._id;
    if (!invoiceId) {
      addToast("Invoice not found for this bill.", "error");
      return;
    }

    try {
      const res = await apiClient.get<{ success: boolean; data: Invoice }>(
        `/restaurant/billing/invoices/${invoiceId}`
      );
      if (res.success && res.data) {
        setPrintInvoice(res.data);
        setIsReceiptModalOpen(true);
      }
    } catch (err: any) {
      addToast(err.message || "Failed to load invoice receipt", "error");
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

  // Filter orders by search term
  const filteredOrders = orders.filter((order) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase().trim();
    const orderNo = order.orderNumber?.toLowerCase() || "";
    const tableNo = (
      order.tableId?.tableNumber ||
      order.billRequest?.tableNumber ||
      ""
    ).toLowerCase();
    const waiterName = (order.billRequest?.requestedBy?.name || "").toLowerCase();
    const orderType = order.orderType?.toLowerCase() || "";

    return (
      orderNo.includes(q) ||
      tableNo.includes(q) ||
      waiterName.includes(q) ||
      orderType.includes(q)
    );
  });

  return (
    <div className="flex h-screen w-screen bg-slate-100 overflow-hidden font-sans">
      {/* 1. Left Navigation Sidebar (Desktop) */}
      <div className="hidden lg:block shrink-0">
        <POSSidebar activePath="/restaurant/pos" />
      </div>

      {/* 2. Main Center Content Area: Bill Requests */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 h-full overflow-hidden">
        {/* Top Header */}
        <header className="h-16 px-4 sm:px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shadow-xs">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Restaurant POS Billing
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Online
                </span>
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse shadow-xs">
                    {pendingCount} Pending
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Staff Bill Requests Queue & Counter Billing
              </p>
            </div>
          </div>

          {/* Search Table / Order Number / Waiter */}
          <div className="flex-1 max-w-xs sm:max-w-md relative hidden md:block">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Table # (e.g. T-03), Order #, Waiter..."
              className="w-full pl-10 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2">
            <SoundControl />

            <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100/70 px-3 py-1.5 rounded-lg border border-slate-200/50">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span suppressHydrationWarning className="font-mono font-medium">
                {currentTime || "--:--:--"}
              </span>
            </div>

            <button
              onClick={fetchBillRequests}
              disabled={loading}
              title="Refresh Bill Requests"
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-teal-600" : ""}`} />
            </button>

            <Link
              href="/restaurant/bills"
              className="hidden sm:flex items-center gap-1.5 py-1.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs"
            >
              <span>Bills</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
            </Link>
          </div>
        </header>

        {/* Filter Tabs Bar */}
        <div className="px-4 sm:px-6 py-2.5 bg-white border-b border-slate-200/70 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setStatusFilter("REQUESTED")}
              className={`py-1.5 px-3 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                statusFilter === "REQUESTED"
                  ? "bg-white text-slate-900 shadow-xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Pending Requests</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-white">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setStatusFilter("CONFIRMED")}
              className={`py-1.5 px-3 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                statusFilter === "CONFIRMED"
                  ? "bg-white text-slate-900 shadow-xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Confirmed Bills</span>
            </button>

            <button
              onClick={() => setStatusFilter("ALL")}
              className={`py-1.5 px-3 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                statusFilter === "ALL"
                  ? "bg-white text-slate-900 shadow-xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>All Requests</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
            Click any bill card or &quot;Select Bill&quot; to open the billing sidebar
          </span>
        </div>

        {/* 3. Main Content: Bill Requests Grid */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            /* Loading Skeletons */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-slate-200 rounded-2xl p-5 h-64 animate-pulse flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <div className="h-5 bg-slate-200 rounded w-1/3" />
                      <div className="h-5 bg-slate-200 rounded w-1/4" />
                    </div>
                    <div className="h-8 bg-slate-100 rounded-xl" />
                    <div className="space-y-2 pt-2">
                      <div className="h-4 bg-slate-100 rounded w-full" />
                      <div className="h-4 bg-slate-100 rounded w-5/6" />
                    </div>
                  </div>
                  <div className="h-9 bg-slate-200 rounded-xl w-full" />
                </div>
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            /* Empty State */
            <div className="h-full min-h-[350px] flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-3 text-slate-400 shadow-2xs">
                <Receipt className="w-8 h-8" />
              </div>
              <h3 className="text-base font-extrabold text-slate-800">
                {statusFilter === "REQUESTED"
                  ? "No Pending Bill Requests"
                  : statusFilter === "CONFIRMED"
                  ? "No Confirmed Bills in this Period"
                  : "No Bill Records Found"}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                {statusFilter === "REQUESTED"
                  ? "When a Waiter / Orderman completes an order and taps 'Request Bill' in the Staff Mobile App, the request appears here instantly."
                  : "Try clearing search filters or check the All Requests tab."}
              </p>
            </div>
          ) : (
            /* Bill Requests Responsive Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredOrders.map((order) => {
                const billStatus = order.billRequest?.status || "NOT_REQUESTED";
                const isRequested = billStatus === "REQUESTED";
                const isConfirmed = billStatus === "CONFIRMED";
                const isCancelled = billStatus === "CANCELLED";
                const isSelected = selectedOrder?._id === order._id;

                const isDineIn = order.orderType === "DINE_IN";
                const tableText = isDineIn
                  ? order.tableId?.tableNumber
                    ? `Table ${order.tableId.tableNumber}${
                        order.tableId.floor ? ` (${order.tableId.floor})` : ""
                      }`
                    : order.billRequest?.tableNumber
                    ? `Table ${order.billRequest.tableNumber}`
                    : "Table (Dine-In)"
                  : order.orderType === "TAKEAWAY"
                  ? "Takeaway"
                  : "Delivery";

                return (
                  <div
                    key={order._id}
                    onClick={() => handleSelectOrder(order)}
                    className={`rounded-2xl border transition-all flex flex-col justify-between overflow-hidden cursor-pointer ${
                      isSelected
                        ? "bg-teal-50/30 border-teal-500 ring-2 ring-teal-500/50 shadow-md"
                        : isRequested
                        ? "bg-white border-amber-300 ring-1 ring-amber-300/40 shadow-xs hover:border-teal-400 hover:shadow-sm"
                        : isConfirmed
                        ? "bg-white border-emerald-300/80 shadow-2xs hover:border-teal-400"
                        : "bg-slate-50/80 border-slate-200 opacity-80"
                    }`}
                  >
                    {/* Top Status Accent Line */}
                    <div
                      className={`h-1.5 w-full ${
                        isSelected
                          ? "bg-teal-600"
                          : isRequested
                          ? "bg-amber-500 animate-pulse"
                          : isConfirmed
                          ? "bg-emerald-500"
                          : "bg-slate-300"
                      }`}
                    />

                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        {/* Header: Order #, Table Number & Status */}
                        <div className="flex items-start justify-between border-b border-slate-100 pb-2.5">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-black text-sm text-slate-900 tracking-tight">
                                {order.orderNumber}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>
                                  {getElapsedTime(order.billRequest?.requestedAt || order.createdAt)}
                                </span>
                              </span>
                            </div>

                            {/* MANDATORY Table Number Display */}
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 flex items-center gap-1 shadow-2xs">
                                {isDineIn ? (
                                  <Utensils className="w-3 h-3 text-teal-600" />
                                ) : order.orderType === "TAKEAWAY" ? (
                                  <ShoppingBag className="w-3 h-3 text-teal-600" />
                                ) : (
                                  <Truck className="w-3 h-3 text-teal-600" />
                                )}
                                <span>{tableText}</span>
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
                                <span>Pending</span>
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

                        {/* Requester Info Bar */}
                        <div className="mt-2 text-[11px] text-slate-600 flex items-center gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200/60">
                          <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span className="truncate">
                            Staff:{" "}
                            <strong className="text-slate-800">
                              {order.billRequest?.requestedBy?.name || "Waiter"}
                            </strong>{" "}
                            ({order.billRequest?.requestedBy?.role || "WAITER"})
                          </span>
                        </div>

                        {/* Ordered Items List with Quantities */}
                        <div className="mt-2.5 space-y-1.5 max-h-32 overflow-y-auto pr-1">
                          {order.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50/80 border border-slate-200/50"
                            >
                              <div className="flex items-baseline gap-1.5 truncate pr-2">
                                <span className="font-black text-[11px] text-teal-800 bg-teal-100 px-1 rounded shrink-0 font-mono">
                                  {item.quantity}×
                                </span>
                                <span className="font-semibold text-slate-800 truncate">
                                  {item.name}
                                </span>
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
                            <span>GST (Taxes):</span>
                            <span className="font-mono">₹{order.tax.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1 border-t border-dashed border-slate-200">
                            <span>Grand Total:</span>
                            <span className="font-mono text-teal-700 text-base font-black">
                              ₹{order.grandTotal.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer: Select Bill Action */}
                      <div className="pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectOrder(order);
                          }}
                          className={`w-full py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-2xs ${
                            isSelected
                              ? "bg-teal-700 text-white shadow-xs"
                              : "bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200"
                          }`}
                        >
                          <span>{isSelected ? "Currently Billing" : "Select Bill"}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* Mobile Floating Bar when Bill is Selected */}
        {selectedOrder && (
          <div className="lg:hidden p-3 bg-white border-t border-slate-200 flex items-center justify-between shadow-lg">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-bold uppercase">
                Selected Order
              </span>
              <span className="text-sm font-black text-teal-800 font-mono">
                {selectedOrder.orderNumber}
              </span>
            </div>

            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="py-2 px-4 rounded-xl bg-teal-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-teal-600/30"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Open Billing Panel</span>
            </button>
          </div>
        )}
      </div>

      {/* 4. Desktop Right-Side Billing Sidebar */}
      <div className="hidden lg:block shrink-0 h-full">
        <BillingSidebar
          order={selectedOrder}
          onDeselect={() => setSelectedOrder(null)}
          menuItems={menuItems}
          onConfirmBill={handleConfirmBill}
          onRecordPayment={handleRecordPayment}
          onPrintBill={handleOpenPrintBill}
          onOrderUpdated={fetchBillRequests}
          isConfirming={isConfirming}
        />
      </div>

      {/* 5. Mobile Slide-Over Bottom Sheet Drawer */}
      {isMobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right">
            <BillingSidebar
              order={selectedOrder}
              onDeselect={() => {
                setSelectedOrder(null);
                setIsMobileDrawerOpen(false);
              }}
              menuItems={menuItems}
              onConfirmBill={async (id, opts) => {
                const inv = await handleConfirmBill(id, opts);
                return inv;
              }}
              onRecordPayment={async (id, data) => {
                const ok = await handleRecordPayment(id, data);
                if (ok) setIsMobileDrawerOpen(false);
                return ok;
              }}
              onPrintBill={handleOpenPrintBill}
              onOrderUpdated={fetchBillRequests}
              isConfirming={isConfirming}
            />
          </div>
        </div>
      )}

      {/* 6. Simple Thermal Bill Receipt Modal (Clean, Minimal, 80mm/58mm/PDF) */}
      <SimpleBillReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        invoice={printInvoice}
      />

      {/* Toast Notification Container */}
      <ToastContainer />
    </div>
  );
}

export default function POSPage() {
  return (
    <POSProvider>
      <POSBillingContent />
    </POSProvider>
  );
}
