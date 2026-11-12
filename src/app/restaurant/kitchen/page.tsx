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
  Bell,
  Volume2,
} from "lucide-react";
import { soundService } from "../../../lib/soundService";
import { SoundControl } from "../../../components/common/SoundControl";

export default function KitchenDisplayPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<"ALL" | "PREPARING" | "READY" | "BILLED">("ALL");
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
  
  // Theme state: defaults to 'light' per user request, with option to toggle
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [highlightedTicketIds, setHighlightedTicketIds] = useState<Set<string>>(new Set());
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(false);
  const initialLoadRef = React.useRef<boolean>(false);

  useEffect(() => {
    const checkAudio = () => {
      if (soundService.isAudioUnlocked()) {
        setAudioUnlocked(true);
      }
    };
    checkAudio();
    const handleGesture = () => {
      soundService.unlockAudio().then(() => setAudioUnlocked(true));
    };
    window.addEventListener("click", handleGesture, { once: true });
    window.addEventListener("keydown", handleGesture, { once: true });
    return () => {
      window.removeEventListener("click", handleGesture);
      window.removeEventListener("keydown", handleGesture);
    };
  }, []);

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
      // Mark initial load complete so sounds only trigger for real-time live orders
      setTimeout(() => {
        initialLoadRef.current = true;
      }, 1000);
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

    // Kitchen Bell Notification for New Orders / KOTs
    const handleKotCreated = (data: any) => {
      loadKitchenOrders();

      // Avoid playing sound during historical load on initial page load / refresh
      if (!initialLoadRef.current) return;

      const kotId = data.kot?._id || data.orderId || data.kot?.kotNumber || data.orderNumber || `${Date.now()}`;
      const eventKey = `kot-created:${kotId}`;

      // 1. Play realistic service bell "DING!"
      soundService.playKitchenBell(eventKey);

      // 2. Highlight new KOT card with glowing border
      const targetOrderId = data.orderId || data.kot?.orderId || data.kot?._id;
      if (targetOrderId) {
        setHighlightedTicketIds((prev) => new Set(prev).add(targetOrderId));
        setTimeout(() => {
          setHighlightedTicketIds((prev) => {
            const next = new Set(prev);
            next.delete(targetOrderId);
            return next;
          });
        }, 8000);
      }

      // 3. Visual notification
      const orderNum = data.orderNumber || data.kot?.orderNumber || "New Order";
      const tableInfo = data.tableNumber || data.kot?.tableNumber || "Kitchen Dispatch";
      const itemsSummary = (data.items || data.kot?.items || [])
        .slice(0, 3)
        .map((i: any) => `${i.quantity}x ${i.name}`)
        .join(", ");

      showToast(
        `🔔 New Kitchen Order – ${orderNum} (${tableInfo})${itemsSummary ? `: ${itemsSummary}` : ""}`,
        "info"
      );
    };

    socket.on("kot:created", handleKotCreated);
    socket.on("order:created", handleKotCreated);
    socket.on("order:updated", handleUpdate);
    socket.on("kot:updated", handleUpdate);
    socket.on("kitchen:order-ready", handleUpdate);

    return () => {
      socket.off("kot:created", handleKotCreated);
      socket.off("order:created", handleKotCreated);
      socket.off("order:updated", handleUpdate);
      socket.off("kot:updated", handleUpdate);
      socket.off("kitchen:order-ready", handleUpdate);
    };
  }, [loadKitchenOrders]);

  // Update order status: PREPARING (Working) -> READY (Food Ready) -> SERVED -> COMPLETED
  const updateStatus = async (orderId: string, newStatus: string) => {
    // Immediate audio feedback on button click
    soundService.unlockAudio();
    if (newStatus === "READY") {
      soundService.playFoodReady();
    } else {
      soundService.playKitchenBell();
    }

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
    <div className={`kds-minimal ${isDarkMode ? "kds-dark" : "kds-light"} flex h-screen w-screen bg-white overflow-hidden font-sans`}>
      <div className="hidden lg:block shrink-0">
        <POSSidebar activePath="/restaurant/kitchen" />
      </div>

      <main
        className={`kds-board flex-1 flex flex-col min-w-0 h-full overflow-y-auto transition-colors duration-200 ${
          isDarkMode ? "bg-slate-900 text-white" : "bg-slate-50/80 text-slate-900"
        }`}
      >
        {/* Compact Header Bar */}
        <header
          className={`h-13 px-4 sm:px-6 flex items-center justify-between shrink-0 border-b transition-colors duration-200 ${
            isDarkMode
              ? "bg-slate-950 border-slate-800"
              : "bg-white border-slate-200/90 shadow-2xs"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                isDarkMode
                  ? "bg-teal-500/10 border border-teal-500/30 text-teal-400"
                  : "bg-teal-50 border border-teal-200 text-teal-700 shadow-2xs"
              }`}
            >
              <ChefHat className="w-4 h-4" />
            </div>
            <div>
              <h1
                className={`text-sm font-extrabold tracking-tight flex items-center gap-1.5 ${
                  isDarkMode ? "text-white" : "text-slate-900"
                }`}
              >
                <span>Kitchen Display System (KDS)</span>
              
              </h1>
              <p
                className={`text-[10px] font-medium hidden sm:block ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                {user?.restaurantName || "Cobolt Kitchen & Bar"} • Compact Kitchen Expediter
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme Toggle (Light / Dark) */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`py-1.5 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                isDarkMode
                  ? "border-slate-800 bg-slate-900 text-amber-300 hover:bg-slate-800"
                  : "border-slate-200 bg-slate-100/80 text-slate-700 hover:bg-slate-200"
              }`}
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline text-[11px]">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden sm:inline text-[11px]">Dark</span>
                </>
              )}
            </button>

            {/* Notification Sound Control (Mute/Unmute & Volume) */}
            <SoundControl />

            {/* Refresh Button */}
            <button
              onClick={loadKitchenOrders}
              className={`py-1.5 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                isDarkMode
                  ? "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-600" : ""}`} />
              <span className="hidden sm:inline text-[11px]">Refresh</span>
            </button>

            {/* POS Billing Link */}
            <Link
              href="/restaurant/pos"
              className="py-1.5 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>POS</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </header>

        {/* Audio Autoplay Unlock Banner */}
        {!audioUnlocked && (
          <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-xs font-bold shrink-0 shadow-xs animate-in slide-in-from-top">
            <div className="flex items-center gap-2">
              <Volume2 className="w-3.5 h-3.5 animate-bounce" />
              <span className="text-[11px]">Click anywhere on screen to enable real-time kitchen bell sound notifications.</span>
            </div>
            <button
              onClick={async () => {
                await soundService.unlockAudio();
                await soundService.playKitchenBell();
                setAudioUnlocked(true);
              }}
              className="py-1 px-3 rounded-lg bg-white text-amber-900 font-extrabold text-[11px] shadow-xs hover:bg-amber-50 transition-all cursor-pointer"
            >
              🔔 Enable Sound
            </button>
          </div>
        )}

        {/* Space-Efficient Content Container (Expanded for full widescreen 4-column layout) */}
        <div className="p-2 sm:p-3 max-w-none mx-auto w-full space-y-2">
          {/* Top Filter Tabs & Stats Bar - Space Efficient */}
          <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-1.5 rounded-xl border transition-colors ${
              isDarkMode
                ? "bg-slate-950 border-slate-800"
                : "bg-white border-slate-200/90 shadow-2xs"
            }`}
          >
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 sm:pb-0">
              <button
                onClick={() => setFilterTab("ALL")}
                className={`py-1 px-2.5 rounded-lg text-[11px] font-extrabold transition-all shrink-0 cursor-pointer ${
                  filterTab === "ALL"
                    ? "bg-teal-600 text-white shadow-xs"
                    : isDarkMode
                    ? "text-slate-400 hover:text-white hover:bg-slate-900"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                All ({orders.length})
              </button>

              <button
                onClick={() => setFilterTab("PREPARING")}
                className={`py-1 px-2.5 rounded-lg text-[11px] font-extrabold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                  filterTab === "PREPARING"
                    ? "bg-amber-500 text-white shadow-xs"
                    : isDarkMode
                    ? "text-slate-400 hover:text-white hover:bg-slate-900"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Flame className="w-3 h-3" />
                <span>Preparing ({preparingCount})</span>
              </button>

              <button
                onClick={() => setFilterTab("READY")}
                className={`py-1 px-2.5 rounded-lg text-[11px] font-extrabold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                  filterTab === "READY"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : isDarkMode
                    ? "text-slate-400 hover:text-white hover:bg-slate-900"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <BellRing className="w-3 h-3" />
                <span>Food Ready ({readyCount})</span>
              </button>

              <button
                onClick={() => setFilterTab("BILLED")}
                className={`py-1 px-2.5 rounded-lg text-[11px] font-extrabold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                  filterTab === "BILLED"
                    ? "bg-teal-700 text-white shadow-xs"
                    : isDarkMode
                    ? "text-slate-400 hover:text-white hover:bg-slate-900"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Receipt className="w-3 h-3" />
                <span>Billed ({billedCount})</span>
              </button>
            </div>

            <div
              className={`flex items-center gap-3 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors ${
                isDarkMode ? "text-slate-400" : "text-slate-600 bg-slate-50 border border-slate-200/60"
              }`}
            >
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Cooking: {preparingCount}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Ready: {readyCount}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-teal-500" />
                <span>Billed: {billedCount}</span>
              </span>
            </div>
          </div>

          {/* High-Density Responsive Grid Layout:
              - Mobile (<768px): 1 col
              - Tablet (768px-1023px): 2 cols
              - Laptop (1024px-1439px): 3 cols
              - Desktop (1440px+): 4 cols
          */}
          {loading ? (
            <div className="py-20 text-center text-slate-500 text-xs">
              <Loader2 className="w-7 h-7 animate-spin mx-auto mb-2 text-teal-600" />
              <span className="font-semibold text-xs">Syncing kitchen display...</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div
              className={`py-16 text-center rounded-2xl p-6 border border-dashed transition-colors ${
                isDarkMode
                  ? "border-slate-800 bg-slate-950/40"
                  : "border-slate-300 bg-white shadow-xs"
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 mx-auto mb-2.5">
                <ChefHat className="w-6 h-6" />
              </div>
              <p
                className={`text-sm font-extrabold ${
                  isDarkMode ? "text-slate-200" : "text-slate-800"
                }`}
              >
                All Cooking Orders Cleared!
              </p>
              <p
                className={`text-[11px] mt-0.5 max-w-sm mx-auto ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                No active orders in this queue. New KOTs dispatched from POS billing will appear here in real-time.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-[1700px]:grid-cols-5 gap-2 items-start">
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

                const isHighlighted = highlightedTicketIds.has(order._id);

                return (
                  <div
                    key={order._id}
                    className={`kds-ticket rounded-md border flex flex-col transition-all duration-200 overflow-hidden ${
                      isHighlighted
                        ? "border-amber-400 ring-2 ring-amber-400/40 shadow-lg shadow-amber-500/10 animate-pulse bg-amber-50/10"
                        : isDarkMode
                        ? isReady
                          ? "bg-slate-950 border-emerald-500/80 shadow-md ring-1 ring-emerald-500/40"
                          : isBilled
                          ? "bg-slate-950 border-teal-500/70 shadow-sm ring-1 ring-teal-500/30"
                          : isPreparing
                          ? "bg-slate-950 border-amber-500/50 shadow-sm ring-1 ring-amber-500/30"
                          : "bg-slate-950 border-slate-800 shadow-xs"
                        : isReady
                        ? "bg-white border-emerald-400 ring-1 ring-emerald-400/30 shadow-md shadow-emerald-500/5"
                        : isBilled
                        ? "bg-white border-teal-400 ring-1 ring-teal-400/30 shadow-xs"
                        : isPreparing
                        ? "bg-white border-amber-400 ring-1 ring-amber-400/30 shadow-xs"
                        : "bg-white border-slate-200 shadow-xs hover:shadow-md"
                    }`}
                  >
                    {/* Top Status Accent Bar - Thin 2px */}
                    <div
                      className={`h-0.5 w-full ${
                        isHighlighted
                          ? "bg-amber-500 animate-pulse"
                          : isReady
                          ? "bg-emerald-500"
                          : isBilled
                          ? "bg-teal-600"
                          : isPreparing
                          ? "bg-amber-500"
                          : "bg-slate-300"
                      }`}
                    />

                    <div className="p-2.5 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Compact Card Header: Order #, Elapsed Time & Status Badge */}
                        <div
                          className={`flex items-start justify-between pb-2 mb-2 border-b ${
                            isDarkMode ? "border-slate-800" : "border-slate-100"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-xs font-black font-mono tracking-tight ${
                                  isDarkMode ? "text-teal-400" : "text-slate-900"
                                }`}
                              >
                                {order.orderNumber}
                              </span>

                              {isHighlighted && (
                                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-500 text-white animate-bounce flex items-center gap-0.5 shadow-xs">
                                  <Bell className="w-2.5 h-2.5" />
                                  <span>NEW</span>
                                </span>
                              )}

                              <span
                                className={`text-[10px] font-semibold flex items-center gap-0.5 px-1.5 py-0.2 rounded ${
                                  isDarkMode
                                    ? "text-slate-400 bg-slate-900 border border-slate-800"
                                    : "text-slate-600 bg-slate-100 border border-slate-200/70"
                                }`}
                              >
                                <Clock className="w-2.5 h-2.5 text-slate-400" />
                                <span>{getElapsedTime(order.createdAt)}</span>
                              </span>
                            </div>

                            {/* Table & Dining Area Info Badge */}
                            <div className="mt-1 flex items-center gap-1.5">
                              <span
                                className={`text-[11px] font-extrabold px-2 py-0.5 rounded border leading-tight ${
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
                            className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border shadow-2xs shrink-0 ${
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

                        {/* Compact Ready Callout */}
                        {isReady && (
                          <div
                            className={`mb-2 p-1.5 rounded-lg border flex items-center gap-1.5 text-[11px] font-extrabold ${
                              isDarkMode
                                ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300"
                                : "bg-emerald-50/90 border-emerald-200 text-emerald-800 shadow-2xs"
                            }`}
                          >
                            <BellRing className="w-3.5 h-3.5 text-emerald-600 animate-bounce shrink-0" />
                            <span>Food Ready to Serve!</span>
                          </div>
                        )}

                        {/* Compact Billed Callout */}
                        {isBilled && (
                          <div
                            className={`mb-2 p-1.5 rounded-lg border flex items-center justify-between text-[11px] font-bold ${
                              isDarkMode
                                ? "bg-teal-950/60 border-teal-500/50 text-teal-300"
                                : "bg-teal-50/90 border-teal-200 text-teal-900 shadow-2xs"
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <Receipt className="w-3.5 h-3.5 text-teal-600" />
                              <span>Invoice Generated</span>
                            </span>
                            <span className="font-mono font-black text-[10px]">
                              {order.invoiceNumber || ""}
                            </span>
                          </div>
                        )}

                        {/* Compact Items List (Max-height scrollable for multi-item orders) */}
                        <div className="space-y-1 mb-2 max-h-44 overflow-y-auto pr-0.5">
                          {consolidatedItems.map((item: any, idx: number) => (
                            <div
                              key={idx}
                              className={`flex items-start justify-between text-xs py-1 px-2 rounded-lg border transition-colors ${
                                isDarkMode
                                  ? "bg-slate-900/60 border-slate-800/80 text-slate-200"
                                  : "bg-slate-50/90 border-slate-200/70 text-slate-800 hover:bg-slate-100/60"
                              }`}
                            >
                              <div className="flex-1 pr-1.5">
                                <div className="flex items-baseline gap-1.5">
                                  <span
                                    className={`px-1 py-0.2 rounded font-black text-[11px] shrink-0 ${
                                      isDarkMode
                                        ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                                        : "bg-teal-100 text-teal-800 border border-teal-200"
                                    }`}
                                  >
                                    {item.quantity}x
                                  </span>
                                  <span
                                    className={`font-bold text-xs leading-tight ${
                                      isDarkMode ? "text-white" : "text-slate-900"
                                    }`}
                                  >
                                    {item.name}
                                  </span>
                                </div>
                                {item.notes && (
                                  <div className="mt-0.5">
                                    <span
                                      className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border inline-block leading-tight ${
                                        isDarkMode
                                          ? "text-amber-300 bg-amber-950/50 border-amber-500/40"
                                          : "text-amber-900 bg-amber-50 border-amber-200"
                                      }`}
                                    >
                                      Note: &quot;{item.notes}&quot;
                                    </span>
                                  </div>
                                )}
                              </div>
                              <span
                                className={`text-[10px] font-mono font-bold shrink-0 ${
                                  isDarkMode ? "text-slate-300" : "text-slate-700"
                                }`}
                              >
                                ₹{(item.price * item.quantity).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Compact Footer Action Controls - Height ~34-36px */}
                      <div
                        className={`pt-2 border-t space-y-1.5 ${
                          isDarkMode ? "border-slate-800/80" : "border-slate-100"
                        }`}
                      >
                        {/* Step 1: CONFIRMED -> Click "Start Preparing (Working)" */}
                        {isConfirmed && (
                          <button
                            onClick={() => updateStatus(order._id, "PREPARING")}
                            disabled={isUpdating}
                            className="w-full py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 min-h-[34px]"
                          >
                            {isUpdating ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Flame className="w-3.5 h-3.5 text-white" />
                            )}
                            <span>Start Preparing (Working)</span>
                          </button>
                        )}

                        {/* Step 2: PREPARING -> Click "Mark Food as Ready" */}
                        {isPreparing && (
                          <button
                            onClick={() => updateStatus(order._id, "READY")}
                            disabled={isUpdating}
                            className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 min-h-[34px]"
                          >
                            {isUpdating ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-white" />
                            )}
                            <span>Mark Food as Ready</span>
                          </button>
                        )}

                        {/* Step 3: READY -> Generate Bill Directly On Screen + Mark as Served */}
                        {isReady && (
                          <div className="space-y-1.5">
                            <button
                              onClick={() => handleGenerateBillOnScreen(order)}
                              disabled={isGenerating}
                              className="w-full py-1.5 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 min-h-[34px]"
                            >
                              {isGenerating ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Receipt className="w-3.5 h-3.5" />
                              )}
                              <span>Generate Bill (On Screen)</span>
                            </button>

                            <button
                              onClick={() => updateStatus(order._id, "SERVED")}
                              disabled={isUpdating}
                              className={`w-full py-1 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 min-h-[30px] ${
                                isDarkMode
                                  ? "bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300"
                                  : "bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700"
                              }`}
                            >
                              <Utensils className="w-3 h-3 text-blue-600" />
                              <span>Mark as Served</span>
                            </button>
                          </div>
                        )}

                        {/* Step 4: SERVED -> Generate Bill Directly On Screen */}
                        {isServed && (
                          <div className="space-y-1.5">
                            <button
                              onClick={() => handleGenerateBillOnScreen(order)}
                              disabled={isGenerating}
                              className="w-full py-1.5 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 min-h-[34px]"
                            >
                              {isGenerating ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Receipt className="w-3.5 h-3.5" />
                              )}
                              <span>Generate Bill (On Screen)</span>
                            </button>
                          </div>
                        )}

                        {/* Step 5: BILLED -> View & Print Bill On Screen + Complete */}
                        {isBilled && (
                          <div className="space-y-1.5">
                            <button
                              onClick={() => handleGenerateBillOnScreen(order)}
                              disabled={isGenerating}
                              className="w-full py-1.5 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 min-h-[34px]"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              <span>View & Print Bill</span>
                            </button>

                            <button
                              onClick={() => updateStatus(order._id, "COMPLETED")}
                              disabled={isUpdating}
                              className={`w-full py-1 px-2.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 min-h-[30px] ${
                                isDarkMode
                                  ? "bg-slate-900 border border-emerald-600/50 hover:bg-emerald-950/40 text-emerald-300"
                                  : "bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              <Check className="w-3 h-3 text-emerald-600" />
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


      <style jsx global>{`
        .kds-minimal.kds-light .kds-board { background: #ffffff !important; }
        .kds-minimal .kds-board > header { height: 44px !important; min-height: 44px; box-shadow: none !important; }
        .kds-minimal .kds-board > header h1 { font-size: 13px !important; font-weight: 600 !important; }
        .kds-minimal .kds-board > header p { font-size: 10px !important; }
        .kds-minimal .kds-ticket { min-height: 0 !important; box-shadow: none !important; border-radius: 7px !important; }
        .kds-minimal.kds-light .kds-ticket { background: #fff !important; border-color: #e5e7eb !important; }
        .kds-minimal .kds-ticket > div:first-child { height: 2px !important; }
        .kds-minimal .kds-ticket .font-black,
        .kds-minimal .kds-ticket .font-extrabold { font-weight: 600 !important; }
        .kds-minimal .kds-ticket .text-xs { font-size: 11px !important; line-height: 1.35 !important; }
        .kds-minimal .kds-ticket .text-sm { font-size: 12px !important; }
        .kds-minimal .kds-ticket .text-\[11px\] { font-size: 10px !important; }
        .kds-minimal .kds-ticket .text-\[10px\] { font-size: 10px !important; }
        .kds-minimal .kds-ticket button { min-height: 30px !important; padding: 5px 8px !important; font-size: 10px !important; font-weight: 600 !important; border-radius: 5px !important; box-shadow: none !important; }
        .kds-minimal .kds-ticket .rounded-lg { border-radius: 5px !important; }
        .kds-minimal.kds-light .kds-ticket .bg-slate-50\/90,
        .kds-minimal.kds-light .kds-ticket .bg-slate-100 { background: #fff !important; }
        .kds-minimal .kds-ticket .animate-pulse,
        .kds-minimal .kds-ticket .animate-bounce { animation: none !important; }
        .kds-minimal.kds-light .kds-board > div > div:first-child { box-shadow: none !important; }
        .kds-minimal .kds-ticket .shadow-xs,
        .kds-minimal .kds-ticket .shadow-md { box-shadow: none !important; }
        @media (max-width: 640px) {
          .kds-minimal .kds-board > header { padding-left: 10px; padding-right: 10px; }
        }
      `}</style>

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
