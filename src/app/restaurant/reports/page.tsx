"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { POSSidebar } from "../../../components/pos/POSSidebar";
import { useAuth } from "../../../context/AuthContext";
import { apiClient } from "../../../lib/apiClient";
import {
  BarChart3,
  Receipt,
  ArrowRight,
  RefreshCw,
  Download,
  Printer,
  IndianRupee,
  CheckCircle2,
  Clock,
  Search,
  TrendingUp,
  FileSpreadsheet,
} from "lucide-react";

export default function ReportsPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState<"ALL" | "TODAY" | "THIS_WEEK">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PAID" | "UNPAID">("ALL");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, orderRes] = await Promise.all([
        apiClient.get<{ success: boolean; invoices?: any[]; data?: any[] }>(
          "/restaurant/billing/invoices",
          { limit: 100 }
        ),
        apiClient.get<{ success: boolean; data?: any[] }>("/restaurant/orders"),
      ]);

      // Note: Backend returns { success: true, invoices: [...] }
      const loadedInvoices =
        invRes.invoices || (Array.isArray(invRes.data) ? invRes.data : []);
      setInvoices(loadedInvoices);

      if (orderRes.success && Array.isArray(orderRes.data)) {
        setOrders(orderRes.data);
      }
    } catch (err) {
      console.warn("Failed to load reports data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Date Filtering Helper
  const isWithinTimeRange = (dateString?: string) => {
    if (!dateString || timeFilter === "ALL") return true;
    const date = new Date(dateString);
    const now = new Date();

    if (timeFilter === "TODAY") {
      return (
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    }

    if (timeFilter === "THIS_WEEK") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      return date >= sevenDaysAgo;
    }

    return true;
  };

  // Filtered invoices
  const filteredInvoices = invoices.filter((inv) => {
    const q = search.toLowerCase();
    const invNum = inv.invoiceNumber?.toLowerCase() || "";
    const table = inv.tableNumber?.toLowerCase() || "";
    const type = inv.orderType?.toLowerCase() || "";

    const matchesSearch =
      !search.trim() ||
      invNum.includes(q) ||
      table.includes(q) ||
      type.includes(q);

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "PAID" && (inv.paymentStatus === "PAID" || inv.status === "PAID")) ||
      (statusFilter === "UNPAID" && inv.paymentStatus !== "PAID" && inv.status !== "PAID");

    const matchesTime = isWithinTimeRange(inv.issuedAt || inv.createdAt);

    return matchesSearch && matchesStatus && matchesTime;
  });

  // Financial aggregates
  const totalInvoicedSales = filteredInvoices.reduce(
    (sum, inv) => sum + Number(inv.grandTotal || 0),
    0
  );

  const totalGSTCollected = filteredInvoices.reduce(
    (sum, inv) =>
      sum + Number(inv.tax || inv.taxDetails?.totalTax || 0),
    0
  );

  const totalPaidVolume = filteredInvoices.reduce(
    (sum, inv) =>
      sum +
      Number(
        inv.paymentStatus === "PAID"
          ? inv.grandTotal
          : inv.paidAmount || 0
      ),
    0
  );

  const totalUnpaidVolume = Math.max(0, totalInvoicedSales - totalPaidVolume);

  // Orders revenue fallback (sum of all completed orders if no invoices exist yet)
  const completedOrdersTotal = orders
    .filter((o) => o.status === "COMPLETED" || o.status === "BILLED")
    .reduce((sum, o) => sum + Number(o.grandTotal || o.subtotal || 0), 0);

  // Print thermal receipt for single invoice
  const handlePrintReceipt = async (inv: any) => {
    try {
      const res = await apiClient.get<{
        success: boolean;
        data?: { htmlReceipt?: string };
      }>(`/restaurant/billing/invoices/${inv._id}/receipt`);

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
    } catch {
      window.print();
    }
  };

  // Download PDF tax invoice
  const handleDownloadPdf = async (inv: any) => {
    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("kot_access_token")
          : null;
      const response = await fetch(
        `http://localhost:5000/api/restaurant/billing/invoices/${inv._id}/pdf`,
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
      a.download = `Invoice-${inv.invoiceNumber || inv._id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert("Failed to download PDF: " + err.message);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-100 overflow-hidden font-sans">
      <div className="hidden lg:block shrink-0">
        <POSSidebar activePath="/restaurant/reports" />
      </div>

      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 h-full overflow-y-auto">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-700">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Billing & Tax Reports</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {invoices.length} invoices
                </span>
              </h1>
              <p className="text-[11px] text-slate-500">
                {user?.restaurantName || "Cobolt Kitchen & Bar"} • Financial Ledger, Revenue & GST Breakdown
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Refresh Reports"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-600" : ""}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/restaurant/pos"
              className="py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all"
            >
              <Receipt className="w-4 h-4" />
              <span>POS Billing</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-6 max-w-7xl mx-auto w-full space-y-5">
          {/* Top Time Range Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-bold text-slate-500 mr-1 text-[11px] uppercase tracking-wider">
                Timeframe:
              </span>
              <button
                onClick={() => setTimeFilter("ALL")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  timeFilter === "ALL"
                    ? "bg-teal-600 text-white shadow-2xs"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                All Time
              </button>
              <button
                onClick={() => setTimeFilter("TODAY")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  timeFilter === "TODAY"
                    ? "bg-teal-600 text-white shadow-2xs"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setTimeFilter("THIS_WEEK")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  timeFilter === "THIS_WEEK"
                    ? "bg-teal-600 text-white shadow-2xs"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                Last 7 Days
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Gross Sales Volume: ₹{(totalInvoicedSales || completedOrdersTotal).toFixed(2)}</span>
            </div>
          </div>

          {/* 4 Financial Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Billed Volume */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total Billed Sales
                </span>
                <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                  <IndianRupee className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  ₹{totalInvoicedSales.toFixed(2)}
                </div>
                <span className="text-[11px] text-teal-700 font-semibold mt-1 block">
                  Across {filteredInvoices.length} invoices issued
                </span>
              </div>
            </div>

            {/* Card 2: Total GST Collected */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total GST Tax
                </span>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  ₹{totalGSTCollected.toFixed(2)}
                </div>
                <span className="text-[11px] text-indigo-700 font-semibold mt-1 block">
                  CGST (2.5%) + SGST (2.5%)
                </span>
              </div>
            </div>

            {/* Card 3: Settled Paid Amount */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Settled (Paid)
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-emerald-700 font-mono">
                  ₹{totalPaidVolume.toFixed(2)}
                </div>
                <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
                  {filteredInvoices.filter((i) => i.paymentStatus === "PAID").length} settled bills
                </span>
              </div>
            </div>

            {/* Card 4: Pending Balance */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Pending Balance
                </span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-amber-700 font-mono">
                  ₹{totalUnpaidVolume.toFixed(2)}
                </div>
                <span className="text-[11px] text-amber-600 font-semibold mt-1 block">
                  Unpaid or open tab balances
                </span>
              </div>
            </div>
          </div>

          {/* Search Bar & Payment Status Filters */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoices by INV #, table number, or type..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500 focus:bg-white transition-all"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <button
                onClick={() => setStatusFilter("ALL")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  statusFilter === "ALL"
                    ? "bg-teal-600 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All Status
              </button>
              <button
                onClick={() => setStatusFilter("PAID")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  statusFilter === "PAID"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Paid
              </button>
              <button
                onClick={() => setStatusFilter("UNPAID")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  statusFilter === "UNPAID"
                    ? "bg-amber-600 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Unpaid
              </button>
            </div>
          </div>

          {/* Recent Invoices Ledger Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div>
                <span className="text-xs font-extrabold text-slate-900 block">
                  Tax Invoices & Financial Ledger
                </span>
                <span className="text-[11px] text-slate-500">
                  Itemized GST compliance and sequential invoice audit records
                </span>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-white px-2.5 py-1 rounded-xl border border-slate-200">
                {filteredInvoices.length} entries
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Type / Table</th>
                    <th className="py-3 px-3 text-right">Subtotal</th>
                    <th className="py-3 px-3 text-right">CGST</th>
                    <th className="py-3 px-3 text-right">SGST</th>
                    <th className="py-3 px-3 text-right">Grand Total</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-600" />
                        <span>Loading financial reports...</span>
                      </td>
                    </tr>
                  ) : filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        <p className="font-bold text-slate-700 text-sm">No Invoices Found</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Invoices are generated when billing orders in the POS or KDS.
                        </p>
                        <Link
                          href="/restaurant/pos"
                          className="mt-3 inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl bg-teal-600 text-white text-xs font-bold shadow-xs"
                        >
                          Launch POS Billing
                        </Link>
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => {
                      const cgst = inv.taxDetails?.cgst || (inv.tax ? inv.tax / 2 : 0);
                      const sgst = inv.taxDetails?.sgst || (inv.tax ? inv.tax / 2 : 0);
                      const isPaid = inv.paymentStatus === "PAID" || inv.status === "PAID";
                      const dateStr = inv.issuedAt || inv.createdAt;

                      return (
                        <tr key={inv._id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-extrabold text-slate-900 font-mono">
                            {inv.invoiceNumber}
                          </td>
                          <td className="py-3 px-3 text-slate-500 text-[11px]">
                            {dateStr
                              ? new Date(dateStr).toLocaleDateString([], {
                                  month: "short",
                                  day: "numeric",
                                })
                              : "N/A"}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-slate-700">
                              {inv.tableNumber ? `Table ${inv.tableNumber}` : inv.orderType}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-600">
                            ₹{Number(inv.subtotal || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-500 text-[11px]">
                            ₹{Number(cgst || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-500 text-[11px]">
                            ₹{Number(sgst || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-black text-slate-900">
                            ₹{Number(inv.grandTotal || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                isPaid
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {isPaid ? "PAID" : "UNPAID"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handlePrintReceipt(inv)}
                                className="p-1.5 rounded-lg bg-slate-50 hover:bg-teal-50 text-slate-600 hover:text-teal-700 border border-slate-200 transition-all cursor-pointer"
                                title="Print Thermal Receipt"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDownloadPdf(inv)}
                                className="p-1.5 rounded-lg bg-slate-50 hover:bg-teal-50 text-slate-600 hover:text-teal-700 border border-slate-200 transition-all cursor-pointer"
                                title="Download PDF Tax Invoice"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </div>
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