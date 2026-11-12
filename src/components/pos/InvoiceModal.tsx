"use client";

import React, { useState } from "react";
import { usePOS } from "../../context/POSContext";
import { formatCurrency, formatDate } from "../../lib/utils";
import { X, Download, Printer, FileText } from "lucide-react";

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenReceipt: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  onOpenReceipt,
}) => {
  const { activeInvoice, addToast } = usePOS();
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);

  if (!isOpen || !activeInvoice) return null;

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const response = await fetch(
        `http://localhost:5000/api/restaurant/billing/invoices/${activeInvoice._id}/pdf`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("kot_access_token") || ""}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to download PDF invoice");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${activeInvoice.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      addToast("Invoice PDF downloaded successfully!", "success");
    } catch (err: any) {
      addToast(err.message || "Failed to download PDF", "error");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Tax Invoice Preview
              </h2>
              <span className="text-xs text-slate-500 font-mono">
                {activeInvoice.invoiceNumber}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloadingPdf ? "Exporting..." : "PDF"}</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onOpenReceipt();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 text-white hover:bg-teal-700 text-xs font-semibold transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Thermal Receipt</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Invoice Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700">
          {/* Restaurant & Invoice Meta */}
          <div className="flex justify-between items-start border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                {activeInvoice.restaurantSnapshot?.name || "Restaurant"}
              </h3>
              {activeInvoice.restaurantSnapshot?.address && (
                <p className="text-slate-500 max-w-xs mt-0.5">
                  {activeInvoice.restaurantSnapshot.address}
                </p>
              )}
              {activeInvoice.restaurantSnapshot?.gstin && (
                <p className="text-slate-600 font-mono font-medium mt-1">
                  GSTIN: {activeInvoice.restaurantSnapshot.gstin}
                </p>
              )}
            </div>

            <div className="text-right space-y-1">
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeInvoice.paymentStatus === "PAID"
                    ? "bg-emerald-100 text-emerald-800"
                    : activeInvoice.paymentStatus === "PARTIALLY_PAID"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {activeInvoice.paymentStatus}
              </span>
              <p className="text-slate-500">
                Date: {formatDate(activeInvoice.issuedAt || activeInvoice.createdAt)}
              </p>
              <p className="text-slate-500">
                Type: {activeInvoice.orderType} {activeInvoice.tableNumber ? `(Table ${activeInvoice.tableNumber})` : ""}
              </p>
            </div>
          </div>

          {/* Customer Info (if present) */}
          {activeInvoice.customerSnapshot?.name && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="font-semibold text-slate-600 block text-[11px] mb-0.5">
                Billed To:
              </span>
              <span className="font-bold text-slate-900">
                {activeInvoice.customerSnapshot.name}
              </span>
              {activeInvoice.customerSnapshot.phone && (
                <span className="text-slate-500 ml-2">
                  • {activeInvoice.customerSnapshot.phone}
                </span>
              )}
            </div>
          )}

          {/* Items Table */}
          <div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-2">Item</th>
                  <th className="py-2 text-center">Qty</th>
                  <th className="py-2 text-right">Price</th>
                  <th className="py-2 text-right">Tax%</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeInvoice.items.map((item, index) => (
                  <tr key={index}>
                    <td className="py-2.5 font-medium text-slate-800">{item.name}</td>
                    <td className="py-2.5 text-center text-slate-600">{item.quantity}</td>
                    <td className="py-2.5 text-right text-slate-600">
                      {formatCurrency(item.price)}
                    </td>
                    <td className="py-2.5 text-right text-slate-500">{item.taxRate}%</td>
                    <td className="py-2.5 text-right font-bold text-slate-900">
                      {formatCurrency(item.itemTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="pt-4 border-t border-slate-200 flex justify-end">
            <div className="w-64 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span>{formatCurrency(activeInvoice.subtotal)}</span>
              </div>

              {activeInvoice.taxDetails?.cgst > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>CGST:</span>
                  <span>{formatCurrency(activeInvoice.taxDetails.cgst)}</span>
                </div>
              )}
              {activeInvoice.taxDetails?.sgst > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>SGST:</span>
                  <span>{formatCurrency(activeInvoice.taxDetails.sgst)}</span>
                </div>
              )}
              {activeInvoice.taxDetails?.igst > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>IGST:</span>
                  <span>{formatCurrency(activeInvoice.taxDetails.igst)}</span>
                </div>
              )}

              {activeInvoice.discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Discount:</span>
                  <span>-{formatCurrency(activeInvoice.discount)}</span>
                </div>
              )}

              {activeInvoice.serviceCharge > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Service Charge:</span>
                  <span>{formatCurrency(activeInvoice.serviceCharge)}</span>
                </div>
              )}

              {activeInvoice.roundOff !== 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>Round Off:</span>
                  <span>{formatCurrency(activeInvoice.roundOff)}</span>
                </div>
              )}

              <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-extrabold text-slate-900">
                <span>Grand Total:</span>
                <span className="text-teal-700">
                  {formatCurrency(activeInvoice.grandTotal)}
                </span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Paid Amount:</span>
                <span>{formatCurrency(activeInvoice.paidAmount)}</span>
              </div>

              <div className="flex justify-between font-bold">
                <span>Balance Due:</span>
                <span className={activeInvoice.balanceAmount <= 0.001 ? "text-emerald-600" : "text-rose-600"}>
                  {formatCurrency(activeInvoice.balanceAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
