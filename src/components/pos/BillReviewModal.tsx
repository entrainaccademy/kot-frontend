"use client";

import React, { useState } from "react";
import { BillRequestOrder } from "../../types/pos";
import {
  X,
  Receipt,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  Check,
  Printer,
  Download,
  CreditCard,
  AlertTriangle,
  Loader2,
  Utensils,
  ShoppingBag,
  Truck,
} from "lucide-react";

interface BillReviewModalProps {
  order: BillRequestOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (order: BillRequestOrder) => Promise<void>;
  onCancelRequest?: (order: BillRequestOrder) => Promise<void>;
  onPrintReceipt?: (order: BillRequestOrder) => void;
  onDownloadPdf?: (order: BillRequestOrder) => void;
  onSettlePayment?: (order: BillRequestOrder) => void;
  isConfirming: boolean;
}

export const BillReviewModal: React.FC<BillReviewModalProps> = ({
  order,
  isOpen,
  onClose,
  onConfirm,
  onCancelRequest,
  onPrintReceipt,
  onDownloadPdf,
  onSettlePayment,
  isConfirming,
}) => {
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  if (!isOpen || !order) return null;

  const billStatus = order.billRequest?.status || "NOT_REQUESTED";
  const isRequested = billStatus === "REQUESTED";
  const isConfirmed = billStatus === "CONFIRMED";
  const isCancelled = billStatus === "CANCELLED";

  const isDineIn = order.orderType === "DINE_IN";
  const tableDisplay = isDineIn
    ? order.tableId?.tableNumber
      ? `Table ${order.tableId.tableNumber}${order.tableId.floor ? ` (${order.tableId.floor})` : ""}`
      : order.billRequest?.tableNumber
      ? `Table ${order.billRequest.tableNumber}`
      : "Table (Dine-In)"
    : order.orderType === "TAKEAWAY"
    ? "Takeaway Order"
    : "Delivery Order";

  const formatTime = (iso?: string) => {
    if (!iso) return "N/A";
    const date = new Date(iso);
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getElapsedTime = (iso?: string) => {
    if (!iso) return "";
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins === 1) return "1 min ago";
    return `${diffMins} mins ago`;
  };

  const handlePdfDownload = async () => {
    if (!onDownloadPdf) return;
    setDownloadingPdf(true);
    try {
      await onDownloadPdf(order);
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shadow-xs">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Bill Review & Confirmation
                </h2>
                {isRequested && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                    Pending
                  </span>
                )}
                {isConfirmed && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Confirmed
                  </span>
                )}
                {isCancelled && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
                    Cancelled
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-mono">
                Order #{order.orderNumber}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Key Attributes Bar: Table & Staff info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Mandatory Table Information */}
            <div className="p-3 rounded-2xl bg-teal-50/80 border border-teal-200/80 flex flex-col justify-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-teal-700">
                Table / Service
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isDineIn ? (
                  <Utensils className="w-4 h-4 text-teal-700 shrink-0" />
                ) : order.orderType === "TAKEAWAY" ? (
                  <ShoppingBag className="w-4 h-4 text-teal-700 shrink-0" />
                ) : (
                  <Truck className="w-4 h-4 text-teal-700 shrink-0" />
                )}
                <span className="font-extrabold text-sm text-teal-950 truncate">
                  {tableDisplay}
                </span>
              </div>
            </div>

            {/* 2. Requested By Staff */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Requested By
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <User className="w-4 h-4 text-slate-600 shrink-0" />
                <span className="font-bold text-xs text-slate-800 truncate">
                  {order.billRequest?.requestedBy?.name || "Waiter / Staff"}
                </span>
                <span className="text-[10px] text-slate-500 bg-slate-200/80 px-1 rounded uppercase font-semibold">
                  {order.billRequest?.requestedBy?.role || "WAITER"}
                </span>
              </div>
            </div>

            {/* 3. Request Timestamp */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Request Time
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="font-mono text-xs font-semibold text-slate-800">
                  {formatTime(order.billRequest?.requestedAt || order.createdAt)}
                </span>
                {order.billRequest?.requestedAt && (
                  <span className="text-[10px] text-slate-400">
                    ({getElapsedTime(order.billRequest.requestedAt)})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Confirmed Invoice Callout */}
          {isConfirmed && order.billRequest?.invoiceId && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                  Generated Invoice Number
                </span>
                <div className="font-mono font-extrabold text-sm text-emerald-950">
                  {order.billRequest.invoiceId.invoiceNumber}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                  Payment Status
                </span>
                <div>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-black uppercase bg-emerald-200 text-emerald-900 border border-emerald-300">
                    {order.billRequest.invoiceId.paymentStatus || "UNPAID"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Order Items Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center justify-between">
              <span>Ordered Items ({order.items.length})</span>
              <span className="text-[11px] font-normal text-slate-500">
                Prices include item pricing & taxes
              </span>
            </h3>

            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-2 text-center w-16">Qty</th>
                    <th className="py-2.5 px-3 text-right w-24">Price</th>
                    <th className="py-2.5 px-3 text-right w-28">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-800">{item.name}</div>
                        {item.notes && (
                          <div className="text-[10px] text-amber-700 italic">
                            Note: {item.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className="font-extrabold px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 font-mono">
                          {item.quantity}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                        ₹{item.price.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        ₹{item.itemTotal.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Breakdown Section */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono font-semibold">₹{order.subtotal.toFixed(2)}</span>
            </div>

            {order.discount > 0 && (
              <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                <span>Discount Applied:</span>
                <span className="font-mono">-₹{order.discount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-xs text-slate-600">
              <span>Taxes (GST):</span>
              <span className="font-mono font-semibold">₹{order.tax.toFixed(2)}</span>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
              <div>
                <span className="text-sm font-black text-slate-900">Grand Total</span>
                <span className="text-[11px] text-slate-400 block">Inclusive of all taxes</span>
              </div>
              <span className="font-mono text-xl sm:text-2xl font-black text-teal-700">
                ₹{order.grandTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Guidance note for cashier */}
          {isRequested && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                Confirming this request will generate official invoice{" "}
                <strong>INV-YYYYMMDD-XXXX</strong>. The order will be billed, and the table
                will remain assigned until payment is settled.
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          {/* Left: Cancel option for pending requests */}
          {isRequested && onCancelRequest ? (
            <button
              onClick={() => onCancelRequest(order)}
              disabled={isConfirming}
              className="py-2 px-3.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel Request
            </button>
          ) : (
            <div />
          )}

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="py-2 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              Close
            </button>

            {isRequested && (
              <button
                onClick={() => onConfirm(order)}
                disabled={isConfirming}
                className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-black flex items-center gap-2 shadow-sm shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50"
              >
                {isConfirming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Confirm & Generate Bill</span>
              </button>
            )}

            {isConfirmed && (
              <>
                {onPrintReceipt && (
                  <button
                    onClick={() => onPrintReceipt(order)}
                    className="py-2 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                    <span>Print Receipt</span>
                  </button>
                )}

                {onDownloadPdf && (
                  <button
                    onClick={handlePdfDownload}
                    disabled={downloadingPdf}
                    className="py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {downloadingPdf ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>PDF</span>
                  </button>
                )}

                {onSettlePayment && (
                  <button
                    onClick={() => onSettlePayment(order)}
                    className="py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Settle Payment</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
