"use client";

import React, { useState } from "react";
import { usePOS } from "../../context/POSContext";
import { PaymentMethod } from "../../types/pos";
import { apiClient } from "../../lib/apiClient";
import { formatCurrency } from "../../lib/utils";
import {
  X,
  Banknote,
  QrCode,
  CreditCard,
  Building2,
  CheckCircle2,
  ArrowRight,
  Printer,
  FileText,
  Loader2,
} from "lucide-react";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenReceipt: () => void;
  onOpenInvoice: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onOpenReceipt,
  onOpenInvoice,
}) => {
  const { activeInvoice, addToast, refreshActiveInvoice, clearCart } = usePOS();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [amount, setAmount] = useState<string>("");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [transactionRef, setTransactionRef] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [paymentSuccess, setPaymentSuccess] = useState<boolean>(false);
  const [lastPaymentResult, setLastPaymentResult] = useState<any>(null);

  if (!isOpen || !activeInvoice) return null;

  const grandTotal = activeInvoice.grandTotal;
  const paidAmount = activeInvoice.paidAmount || 0;
  const balanceDue = activeInvoice.balanceAmount ?? grandTotal - paidAmount;

  // Initialize amount with balance due if empty
  const currentPayAmount = amount ? parseFloat(amount) : balanceDue;
  const numCashReceived = cashReceived ? parseFloat(cashReceived) : currentPayAmount;
  const changeDue = Math.max(0, Math.round((numCashReceived - currentPayAmount) * 100) / 100);

  const handleQuickCash = (received: number) => {
    setCashReceived(String(received));
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (currentPayAmount <= 0) {
      addToast("Payment amount must be greater than zero", "error");
      return;
    }

    if (currentPayAmount > balanceDue + 0.001) {
      addToast(`Payment amount cannot exceed balance due of ₹${balanceDue.toFixed(2)}`, "error");
      return;
    }

    if (paymentMethod === "CASH" && numCashReceived < currentPayAmount) {
      addToast("Cash received is less than payment amount", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        amount: currentPayAmount,
        paymentMethod,
        transactionReference: transactionRef.trim() || undefined,
        notes: notes.trim() || undefined,
        idempotencyKey: `pay-${activeInvoice._id}-${Date.now()}`,
      };

      if (paymentMethod === "CASH") {
        payload.cashDetails = {
          cashReceived: numCashReceived,
        };
      }

      const res = await apiClient.post<{ success: boolean; data: any }>(
        `/restaurant/billing/invoices/${activeInvoice._id}/payments`,
        payload
      );

      if (res.success) {
        setPaymentSuccess(true);
        setLastPaymentResult(res.data);
        await refreshActiveInvoice();
        addToast(
          `Payment of ₹${currentPayAmount.toFixed(2)} recorded successfully!`,
          "success"
        );
      }
    } catch (err: any) {
      addToast(err.message || "Failed to record payment", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinishAndNewOrder = () => {
    clearCart();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Payment & Settlement
            </h2>
            <p className="text-xs text-slate-500">
              Invoice #{activeInvoice.invoiceNumber}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {paymentSuccess ? (
          /* Payment Success State */
          <div className="p-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h3 className="text-xl font-bold text-slate-900">
              Payment Confirmed!
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Payment transaction #{lastPaymentResult?.payment?.paymentNumber}
            </p>

            <div className="bg-slate-50 rounded-xl p-4 my-6 w-full max-w-md border border-slate-200 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice Total:</span>
                <span className="font-bold text-slate-800">
                  {formatCurrency(activeInvoice.grandTotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Settled:</span>
                <span className="font-bold text-emerald-600">
                  {formatCurrency(currentPayAmount)} via {paymentMethod}
                </span>
              </div>
              {paymentMethod === "CASH" && changeDue > 0 && (
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="font-semibold text-slate-700">Change Returned:</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(changeDue)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-slate-200 font-bold">
                <span>Remaining Balance:</span>
                <span className={balanceDue - currentPayAmount <= 0.001 ? "text-emerald-600" : "text-amber-600"}>
                  {formatCurrency(Math.max(0, balanceDue - currentPayAmount))}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full max-w-md">
              <button
                onClick={() => {
                  onClose();
                  onOpenReceipt();
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all"
              >
                <Printer className="w-4 h-4 text-slate-500" />
                <span>Print Receipt</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  onOpenInvoice();
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all"
              >
                <FileText className="w-4 h-4 text-slate-500" />
                <span>View Invoice</span>
              </button>
            </div>

            <button
              onClick={handleFinishAndNewOrder}
              className="mt-4 w-full max-w-md py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-sm shadow-teal-600/20"
            >
              Start New Order
            </button>
          </div>
        ) : (
          /* Payment Entry Form */
          <form onSubmit={handleRecordPayment} className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Balance Due Banner */}
            <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-teal-800 uppercase tracking-wider block">
                  Balance Due
                </span>
                <span className="text-2xl font-extrabold text-teal-950">
                  {formatCurrency(balanceDue)}
                </span>
              </div>
              <div className="text-right text-xs text-slate-500">
                <div>Grand Total: {formatCurrency(grandTotal)}</div>
                {paidAmount > 0 && (
                  <div className="text-emerald-700 font-medium">
                    Paid: {formatCurrency(paidAmount)}
                  </div>
                )}
              </div>
            </div>

            {/* Payment Method Tabs */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Select Payment Method
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: "CASH", label: "Cash", icon: Banknote },
                  { id: "UPI", label: "UPI / QR", icon: QrCode },
                  { id: "CARD", label: "Card", icon: CreditCard },
                  { id: "NET_BANKING", label: "Net Bank", icon: Building2 },
                ].map((m) => {
                  const Icon = m.icon;
                  const isSelected = paymentMethod === m.id;

                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all ${
                        isSelected
                          ? "bg-teal-600 border-teal-600 text-white shadow-xs"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="w-5 h-5 mb-1" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Payment Amount Field (Supports Partial/Split) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Payment Amount (₹)
                </label>
                {balanceDue > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(balanceDue))}
                    className="text-[11px] font-bold text-teal-600 hover:text-teal-700"
                  >
                    Pay Full Balance
                  </button>
                )}
              </div>
              <input
                type="number"
                step="any"
                min="0.01"
                max={balanceDue}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={String(balanceDue)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>

            {/* Cash-Specific Fields: Quick Presets & Change Return */}
            {paymentMethod === "CASH" && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Cash Received</span>
                  <div className="flex gap-1.5">
                    {[currentPayAmount, 500, 1000, 2000]
                      .filter((val) => val >= currentPayAmount)
                      .slice(0, 3)
                      .map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleQuickCash(val)}
                          className="px-2 py-1 text-[11px] font-bold bg-white border border-slate-200 rounded-lg text-slate-700 hover:border-teal-500"
                        >
                          ₹{val}
                        </button>
                      ))}
                  </div>
                </div>

                <input
                  type="number"
                  step="any"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder={`e.g. ${currentPayAmount}`}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/80">
                  <span className="font-semibold text-slate-600">Change to Return:</span>
                  <span className="font-extrabold text-sm text-slate-900">
                    {formatCurrency(changeDue)}
                  </span>
                </div>
              </div>
            )}

            {/* UPI or Card Transaction Reference */}
            {(paymentMethod === "UPI" || paymentMethod === "CARD" || paymentMethod === "NET_BANKING") && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Transaction / UTR Reference
                </label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="e.g. UTR12345678 or POS Auth Code"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>
            )}

            {/* Optional Payment Note */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Note (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Card machine #2, Split with table guest"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-sm shadow-teal-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Payment...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm Payment of {formatCurrency(currentPayAmount)}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
