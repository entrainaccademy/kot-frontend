"use client";

import React, { useState, useEffect } from "react";
import { usePOS } from "../../context/POSContext";
import { ThermalReceiptData } from "../../types/pos";
import { apiClient } from "../../lib/apiClient";
import { X, Printer, Loader2 } from "lucide-react";

interface ReceiptPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiptPrintModal: React.FC<ReceiptPrintModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { activeInvoice, addToast } = usePOS();

  const [receiptData, setReceiptData] = useState<ThermalReceiptData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [paperWidth, setPaperWidth] = useState<"58mm" | "80mm">("80mm");

  useEffect(() => {
    if (!isOpen || !activeInvoice) return;

    const fetchReceipt = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<{ success: boolean; data: ThermalReceiptData }>(
          `/restaurant/billing/invoices/${activeInvoice._id}/receipt`
        );
        if (res.success && res.data) {
          setReceiptData(res.data);
        }
      } catch (err: any) {
        addToast(err.message || "Failed to load receipt", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchReceipt();
  }, [isOpen, activeInvoice, addToast]);

  if (!isOpen || !activeInvoice) return null;

  const handlePrint = () => {
    if (!receiptData) return;

    // Use an isolated hidden iframe for browser printing so only receipt is printed
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
        setTimeout(() => {
          document.body.removeChild(printFrame);
        }, 1000);
      }, 300);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Thermal Receipt Print
            </h2>
            <p className="text-xs text-slate-500">
              Invoice #{activeInvoice.invoiceNumber}
            </p>
          </div>

          {/* Paper Width Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
            <button
              onClick={() => setPaperWidth("58mm")}
              className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                paperWidth === "58mm"
                  ? "bg-white text-teal-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              58mm
            </button>
            <button
              onClick={() => setPaperWidth("80mm")}
              className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                paperWidth === "80mm"
                  ? "bg-white text-teal-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              80mm
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Preview Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/70 flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-slate-400 py-12">
              <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
              <span className="text-xs">Generating thermal receipt...</span>
            </div>
          ) : receiptData ? (
            <div
              className={`bg-white shadow-md p-6 font-mono text-[11px] leading-tight text-slate-900 whitespace-pre rounded border border-slate-200 select-all overflow-x-auto ${
                paperWidth === "58mm" ? "w-[260px]" : "w-[360px]"
              }`}
            >
              {paperWidth === "58mm" ? receiptData.text58mm : receiptData.text80mm}
            </div>
          ) : (
            <div className="text-xs text-slate-400 py-12">
              Receipt data unavailable
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 bg-white">
          <span className="text-[11px] text-slate-400">
            Supports standard ESC/POS 58mm & 80mm roll printers
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              disabled={loading || !receiptData}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>Print to Thermal Printer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
