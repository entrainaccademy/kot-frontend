"use client";

import React, { useState, useEffect } from "react";
import { Invoice, PaymentRecord } from "../../types/pos";
import { apiClient } from "../../lib/apiClient";
import {
  X,
  Printer,
  Download,
  Loader2,
  FileText,
  CheckCircle2,
  CreditCard,
} from "lucide-react";

interface SimpleBillReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  payments?: PaymentRecord[];
}

export const SimpleBillReceiptModal: React.FC<SimpleBillReceiptModalProps> = ({
  isOpen,
  onClose,
  invoice,
  payments = [],
}) => {
  const [paperWidth, setPaperWidth] = useState<"80mm" | "58mm">("80mm");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [latestPayments, setLatestPayments] = useState<PaymentRecord[]>(payments);
  const [loadingPayments, setLoadingPayments] = useState(false);

  useEffect(() => {
    if (!isOpen || !invoice) return;

    // Fetch payments for this invoice if not provided
    const fetchPayments = async () => {
      setLoadingPayments(true);
      try {
        const res = await apiClient.get<{ success: boolean; data: PaymentRecord[] }>(
          `/restaurant/billing/invoices/${invoice._id}/payments`
        );
        if (res.success && Array.isArray(res.data)) {
          setLatestPayments(res.data);
        }
      } catch {
        // fallback to props
        setLatestPayments(payments);
      } finally {
        setLoadingPayments(false);
      }
    };

    fetchPayments();
  }, [isOpen, invoice, payments]);

  if (!isOpen || !invoice) return null;

  const restaurantName =
    invoice.restaurantSnapshot?.name || "RESTAURANT POS";
  const restaurantAddress = invoice.restaurantSnapshot?.address || "";
  const restaurantPhone = invoice.restaurantSnapshot?.phone || "";
  const restaurantGstin = invoice.restaurantSnapshot?.gstin || "";

  const formattedDate = new Date(
    invoice.issuedAt || invoice.createdAt
  ).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const tableOrType =
    invoice.orderType === "DINE_IN"
      ? invoice.tableNumber
        ? `Table ${invoice.tableNumber}`
        : "DINE-IN"
      : invoice.orderType === "TAKEAWAY"
      ? "TAKEAWAY"
      : "DELIVERY";

  const primaryPayment = latestPayments[0];
  const paymentMethodDisplay = primaryPayment
    ? primaryPayment.paymentMethod
    : invoice.paymentStatus === "PAID"
    ? "PAID"
    : "UNSETTLED";

  // Build clean HTML string for thermal printing
  const generateCleanReceiptHtml = () => {
    const is80 = paperWidth === "80mm";
    const maxWidth = is80 ? "300px" : "220px";

    const itemsRows = invoice.items
      .map(
        (item) => `
        <tr>
          <td style="padding: 2px 0; word-break: break-word;">${item.name}</td>
          <td style="padding: 2px 0; text-align: center;">${item.quantity}</td>
          <td style="padding: 2px 0; text-align: right;">${item.price.toFixed(2)}</td>
          <td style="padding: 2px 0; text-align: right;">${item.itemTotal.toFixed(2)}</td>
        </tr>`
      )
      .join("");

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt - ${invoice.invoiceNumber}</title>
        <style>
          @page { margin: 0; size: auto; }
          body {
            font-family: 'Courier New', Courier, monospace, system-ui;
            font-size: 11px;
            line-height: 1.3;
            color: #000;
            background: #fff;
            margin: 0;
            padding: 8px;
            width: ${maxWidth};
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 4px 0; }
          .double-divider { border-top: 2px solid #000; margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          .flex-between { display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="center">
          <div class="bold" style="font-size: 14px;">${restaurantName}</div>
          ${restaurantAddress ? `<div>${restaurantAddress}</div>` : ""}
          ${restaurantPhone ? `<div>Ph: ${restaurantPhone}</div>` : ""}
          ${restaurantGstin ? `<div>GSTIN: ${restaurantGstin}</div>` : ""}
          <div class="divider"></div>
          <div class="bold">TAX INVOICE</div>
          <div>${invoice.invoiceNumber}</div>
          <div>${formattedDate}</div>
          <div class="bold">${tableOrType}</div>
          ${
            invoice.customerSnapshot?.name
              ? `<div>Cust: ${invoice.customerSnapshot.name} ${
                  invoice.customerSnapshot.phone || ""
                }</div>`
              : ""
          }
        </div>

        <div class="divider"></div>

        <table>
          <thead>
            <tr style="border-bottom: 1px dashed #000;">
              <th align="left">ITEM</th>
              <th align="center">QTY</th>
              <th align="right">PRICE</th>
              <th align="right">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="divider"></div>

        <div class="flex-between">
          <span>Subtotal:</span>
          <span>₹${invoice.subtotal.toFixed(2)}</span>
        </div>

        ${
          invoice.discount > 0
            ? `<div class="flex-between">
                <span>Discount:</span>
                <span>-₹${invoice.discount.toFixed(2)}</span>
              </div>`
            : ""
        }

        ${
          invoice.serviceCharge > 0
            ? `<div class="flex-between">
                <span>Addl Charges:</span>
                <span>₹${invoice.serviceCharge.toFixed(2)}</span>
              </div>`
            : ""
        }

        ${
          invoice.taxDetails?.cgst > 0
            ? `<div class="flex-between">
                <span>CGST:</span>
                <span>₹${invoice.taxDetails.cgst.toFixed(2)}</span>
              </div>`
            : ""
        }
        ${
          invoice.taxDetails?.sgst > 0
            ? `<div class="flex-between">
                <span>SGST:</span>
                <span>₹${invoice.taxDetails.sgst.toFixed(2)}</span>
              </div>`
            : ""
        }
        ${
          invoice.tax > 0 &&
          !invoice.taxDetails?.cgst &&
          !invoice.taxDetails?.sgst
            ? `<div class="flex-between">
                <span>GST (Tax):</span>
                <span>₹${invoice.tax.toFixed(2)}</span>
              </div>`
            : ""
        }

        <div class="double-divider"></div>

        <div class="flex-between bold" style="font-size: 13px;">
          <span>GRAND TOTAL:</span>
          <span>₹${invoice.grandTotal.toFixed(2)}</span>
        </div>

        <div class="divider"></div>

        <div class="flex-between">
          <span>Payment:</span>
          <span class="bold">${paymentMethodDisplay} (${invoice.paymentStatus})</span>
        </div>

        ${
          invoice.paidAmount > 0
            ? `<div class="flex-between">
                <span>Paid:</span>
                <span>₹${invoice.paidAmount.toFixed(2)}</span>
              </div>`
            : ""
        }
        ${
          invoice.balanceAmount > 0
            ? `<div class="flex-between bold">
                <span>Balance Due:</span>
                <span>₹${invoice.balanceAmount.toFixed(2)}</span>
              </div>`
            : ""
        }

        <div class="divider"></div>
        <div class="center" style="font-size: 10px; margin-top: 6px;">
          *** Thank You! Visit Again ***
        </div>
      </body>
      </html>
    `;
  };

  const handlePrint = () => {
    const html = generateCleanReceiptHtml();
    const printFrame = document.createElement("iframe");
    printFrame.style.position = "absolute";
    printFrame.style.top = "-9999px";
    printFrame.style.left = "-9999px";
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(html);
      frameDoc.close();

      setTimeout(() => {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(printFrame)) {
            document.body.removeChild(printFrame);
          }
        }, 1000);
      }, 350);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("kot_access_token")
          : null;
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL ||
        "https://kot-backend-za5d.onrender.com/api";
      const response = await fetch(
        `${apiUrl}/restaurant/billing/invoices/${invoice._id}/pdf`,
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
      a.download = `Invoice-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || "Failed to download PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95">
        {/* Top Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Print Bill / Receipt
              </h3>
              <p className="text-[11px] font-mono text-slate-500">
                {invoice.invoiceNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Format toggle: 80mm / 58mm */}
            <div className="flex items-center bg-slate-200 p-0.5 rounded-lg text-[10px] font-bold">
              <button
                onClick={() => setPaperWidth("80mm")}
                className={`px-2 py-1 rounded transition-all cursor-pointer ${
                  paperWidth === "80mm"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600"
                }`}
              >
                80mm
              </button>
              <button
                onClick={() => setPaperWidth("58mm")}
                className={`px-2 py-1 rounded transition-all cursor-pointer ${
                  paperWidth === "58mm"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600"
                }`}
              >
                58mm
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Receipt Paper Preview Container */}
        <div className="p-4 overflow-y-auto flex-1 bg-slate-100 flex justify-center">
          <div
            className={`bg-white shadow-sm border border-slate-300 p-4 font-mono text-xs text-slate-900 transition-all ${
              paperWidth === "80mm" ? "w-80" : "w-64"
            }`}
            style={{ fontFamily: "'Courier New', Courier, monospace" }}
          >
            {/* Header */}
            <div className="text-center space-y-0.5">
              <div className="font-bold text-sm tracking-wide">
                {restaurantName}
              </div>
              {restaurantAddress && (
                <div className="text-[10px] text-slate-600">
                  {restaurantAddress}
                </div>
              )}
              {restaurantPhone && (
                <div className="text-[10px] text-slate-600">
                  Ph: {restaurantPhone}
                </div>
              )}
              {restaurantGstin && (
                <div className="text-[10px] text-slate-600">
                  GSTIN: {restaurantGstin}
                </div>
              )}
              <div className="border-t border-dashed border-slate-400 my-2" />
              <div className="font-bold">TAX INVOICE</div>
              <div className="text-[11px] font-bold">{invoice.invoiceNumber}</div>
              <div className="text-[10px] text-slate-500">{formattedDate}</div>
              <div className="font-bold text-[11px] text-teal-800">
                {tableOrType}
              </div>
              {invoice.customerSnapshot?.name && (
                <div className="text-[10px] text-slate-700">
                  Cust: {invoice.customerSnapshot.name}{" "}
                  {invoice.customerSnapshot.phone || ""}
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-slate-400 my-2" />

            {/* Items Table */}
            <div className="space-y-1">
              <div className="flex justify-between font-bold text-[10px] border-b border-dashed border-slate-300 pb-1">
                <span className="w-36 truncate">ITEM</span>
                <span className="w-8 text-center">QTY</span>
                <span className="w-12 text-right">RATE</span>
                <span className="w-14 text-right">TOTAL</span>
              </div>
              {invoice.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-baseline text-[11px] py-0.5"
                >
                  <span className="w-36 truncate">{item.name}</span>
                  <span className="w-8 text-center">{item.quantity}</span>
                  <span className="w-12 text-right">{item.price.toFixed(0)}</span>
                  <span className="w-14 text-right font-bold">
                    {item.itemTotal.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-slate-400 my-2" />

            {/* Price Calculations */}
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between text-slate-700">
                <span>Subtotal:</span>
                <span>₹{invoice.subtotal.toFixed(2)}</span>
              </div>

              {invoice.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount:</span>
                  <span>-₹{invoice.discount.toFixed(2)}</span>
                </div>
              )}

              {invoice.serviceCharge > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>Addl Charges:</span>
                  <span>₹{invoice.serviceCharge.toFixed(2)}</span>
                </div>
              )}

              {invoice.taxDetails?.cgst > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>CGST:</span>
                  <span>₹{invoice.taxDetails.cgst.toFixed(2)}</span>
                </div>
              )}
              {invoice.taxDetails?.sgst > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>SGST:</span>
                  <span>₹{invoice.taxDetails.sgst.toFixed(2)}</span>
                </div>
              )}
              {invoice.tax > 0 &&
                !invoice.taxDetails?.cgst &&
                !invoice.taxDetails?.sgst && (
                  <div className="flex justify-between text-slate-600">
                    <span>GST (Tax):</span>
                    <span>₹{invoice.tax.toFixed(2)}</span>
                  </div>
                )}

              <div className="border-t-2 border-slate-900 my-1.5" />

              <div className="flex justify-between font-bold text-sm text-slate-900">
                <span>GRAND TOTAL:</span>
                <span>₹{invoice.grandTotal.toFixed(2)}</span>
              </div>

              <div className="border-t border-dashed border-slate-400 my-1.5" />

              <div className="flex justify-between text-[11px]">
                <span>Payment:</span>
                <span className="font-bold">
                  {paymentMethodDisplay} ({invoice.paymentStatus})
                </span>
              </div>

              {invoice.paidAmount > 0 && (
                <div className="flex justify-between text-emerald-800">
                  <span>Paid:</span>
                  <span>₹{invoice.paidAmount.toFixed(2)}</span>
                </div>
              )}

              {invoice.balanceAmount > 0 && (
                <div className="flex justify-between font-bold text-rose-700">
                  <span>Balance Due:</span>
                  <span>₹{invoice.balanceAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-slate-400 my-2" />
            <div className="text-center text-[10px] text-slate-500">
              *** Thank You! Visit Again ***
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="py-2 px-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
            >
              {downloadingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>A4 PDF</span>
            </button>

            <button
              onClick={handlePrint}
              className="py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-teal-600/25 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt Now</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
