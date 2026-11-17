"use client";

import React, { useState, useEffect, useMemo } from "react";
import { BillRequestOrder, Invoice, MenuItem, PaymentMethod } from "../../types/pos";
import { apiClient } from "../../lib/apiClient";
import {
  Receipt,
  X,
  Plus,
  Minus,
  Trash2,
  Percent,
  Banknote,
  QrCode,
  User,
  Phone,
  Printer,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Sparkles,
  ShoppingBag,
  Utensils,
  Truck,
  Check,
} from "lucide-react";

interface BillingSidebarProps {
  order: BillRequestOrder | null;
  onDeselect: () => void;
  menuItems: MenuItem[];
  onConfirmBill: (
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
  ) => Promise<Invoice | null>;
  onRecordPayment: (
    invoiceId: string,
    paymentData: {
      amount: number;
      paymentMethod: PaymentMethod;
      cashDetails?: { cashReceived: number };
      transactionReference?: string;
      notes?: string;
    }
  ) => Promise<boolean>;
  onPrintBill: (order: BillRequestOrder, invoice?: Invoice) => void;
  onOrderUpdated: () => void;
  isConfirming: boolean;
}

export const BillingSidebar: React.FC<BillingSidebarProps> = ({
  order,
  onDeselect,
  menuItems,
  onConfirmBill,
  onRecordPayment,
  onPrintBill,
  onOrderUpdated,
  isConfirming,
}) => {
  // Local working copy of items for real-time recalculation
  const [extraItems, setExtraItems] = useState<
    Array<{
      menuItemId: string;
      name: string;
      price: number;
      quantity: number;
      taxRate: number;
    }>
  >([]);

  // Additional custom charge
  const [additionalCharge, setAdditionalCharge] = useState<string>("");

  // Discount state
  const [discountType, setDiscountType] = useState<"FIXED" | "PERCENTAGE">("FIXED");
  const [discountValue, setDiscountValue] = useState<string>("");

  // Optional Customer Info
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");

  // Payment Method selection (Cash / UPI)
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI">("CASH");
  const [cashTendered, setCashTendered] = useState<string>("");
  const [upiRef, setUpiRef] = useState<string>("");

  // Extra item selector state
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>("");
  const [isAddingItem, setIsAddingItem] = useState<boolean>(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState<boolean>(false);
  const [sidebarToast, setSidebarToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Sync state when selected order changes
  useEffect(() => {
    if (order) {
      setExtraItems([]);
      setAdditionalCharge("");
      setDiscountValue(order.discount ? String(order.discount) : "");
      setDiscountType("FIXED");
      setCustomerName(order.customerId?.name || "");
      setCustomerPhone(order.customerId?.phone || "");
      setCashTendered("");
      setUpiRef("");
    }
  }, [order]);

  // Quick chips for popular add-ons
  const quickAddOns = useMemo(() => {
    const names = ["water", "bottle", "soda", "cold drink", "roti", "naan"];
    return menuItems.filter((m) =>
      names.some((n) => m.name.toLowerCase().includes(n))
    ).slice(0, 3);
  }, [menuItems]);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setSidebarToast({ message, type });
    setTimeout(() => setSidebarToast(null), 3000);
  };

  if (!order) {
    return (
      <aside className="w-full lg:w-[420px] bg-white border-l border-slate-200 flex flex-col h-full shrink-0 select-none justify-center items-center p-8 text-center text-slate-400">
        <div className="w-16 h-16 rounded-3xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-3 text-slate-400 shadow-2xs">
          <Receipt className="w-8 h-8" />
        </div>
        <h3 className="text-base font-extrabold text-slate-800">No Bill Selected</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
          Select any pending or confirmed bill request from the main content to view items, add extra charges, apply discounts, and process payment.
        </p>
      </aside>
    );
  }

  const isBilled = order.billRequest?.status === "CONFIRMED";
  const isPending = order.billRequest?.status === "REQUESTED";
  const isDineIn = order.orderType === "DINE_IN";

  const tableLabel = isDineIn
    ? order.tableId?.tableNumber
      ? `Table ${order.tableId.tableNumber}${order.tableId.floor ? ` (${order.tableId.floor})` : ""}`
      : order.billRequest?.tableNumber
      ? `Table ${order.billRequest.tableNumber}`
      : "Table (Dine-In)"
    : order.orderType === "TAKEAWAY"
    ? "Takeaway"
    : "Delivery";

  // Financial calculations
  // Combine existing order items + local extra items
  const baseSubtotal = (order.items || []).reduce(
    (sum, item) => sum + (item.itemTotal || item.price * item.quantity),
    0
  );
  const extraItemsSubtotal = extraItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const currentSubtotal = baseSubtotal + extraItemsSubtotal;

  const extraChargesAmount = parseFloat(additionalCharge) || 0;

  // Discount calculation
  const parsedDiscount = parseFloat(discountValue) || 0;
  let calculatedDiscount = 0;
  if (parsedDiscount > 0) {
    if (discountType === "PERCENTAGE") {
      calculatedDiscount = Math.round(((currentSubtotal * parsedDiscount) / 100) * 100) / 100;
    } else {
      calculatedDiscount = Math.min(parsedDiscount, currentSubtotal);
    }
  }

  // GST Calculation (Default 5% restaurant GST)
  const taxableAmount = Math.max(0, currentSubtotal - calculatedDiscount);
  const calculatedGst = Math.round(taxableAmount * 0.05 * 100) / 100;

  // Grand Total calculation
  const calculatedGrandTotal = Math.max(
    0,
    Math.round(taxableAmount + calculatedGst + extraChargesAmount)
  );

  // Cash change due calculation
  const numCashTendered = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, Math.round((numCashTendered - calculatedGrandTotal) * 100) / 100);

  // Add Item to Order handler
  const handleAddExtraItem = async (menuItem: MenuItem, qty: number = 1) => {
    setIsAddingItem(true);
    try {
      if (isPending) {
        // Persist item addition to backend for the pending order
        await apiClient.post(`/restaurant/orders/${order._id}/items`, {
          items: [
            {
              menuItemId: menuItem._id,
              quantity: qty,
              notes: "Added at billing counter",
            },
          ],
        });
        showToast(`Added ${menuItem.name} × ${qty} to order!`, "success");
        onOrderUpdated();
      } else {
        // Local addition
        setExtraItems((prev) => {
          const existing = prev.find((i) => i.menuItemId === menuItem._id);
          if (existing) {
            return prev.map((i) =>
              i.menuItemId === menuItem._id
                ? { ...i, quantity: i.quantity + qty }
                : i
            );
          }
          return [
            ...prev,
            {
              menuItemId: menuItem._id,
              name: menuItem.name,
              price: menuItem.price,
              quantity: qty,
              taxRate: menuItem.taxRate || 5,
            },
          ];
        });
        showToast(`Added ${menuItem.name} × ${qty}`, "success");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to add item", "error");
    } finally {
      setIsAddingItem(false);
      setSelectedMenuItemId("");
    }
  };

  // Remove existing order item handler
  const handleRemoveExistingItem = async (itemId: string, itemName: string) => {
    if (!confirm(`Remove ${itemName} from this order?`)) return;

    try {
      await apiClient.delete(`/restaurant/orders/${order._id}/items/${itemId}`);
      showToast(`Removed ${itemName}`, "success");
      onOrderUpdated();
    } catch (err: any) {
      showToast(err.message || "Failed to remove item", "error");
    }
  };

  // Remove local extra item handler
  const handleRemoveExtraItem = (menuItemId: string) => {
    setExtraItems((prev) => prev.filter((i) => i.menuItemId !== menuItemId));
  };

  // Handle Confirm Bill
  const handleConfirm = async () => {
    const discountPayload =
      parsedDiscount > 0
        ? {
            type: discountType,
            value: parsedDiscount,
            reason: "Cashier billing discount",
          }
        : undefined;

    const invoice = await onConfirmBill(order._id, {
      discount: discountPayload,
      serviceCharge: extraChargesAmount > 0 ? extraChargesAmount : undefined,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
    });

    if (invoice) {
      showToast(`Invoice #${invoice.invoiceNumber} created!`, "success");
    }
  };

  // Handle Record Payment
  const handlePayment = async () => {
    const invoiceId = order.billRequest?.invoiceId?._id;
    if (!invoiceId) {
      showToast("Please generate bill first before recording payment", "error");
      return;
    }

    if (paymentMethod === "CASH" && numCashTendered < calculatedGrandTotal) {
      showToast(`Cash received (₹${numCashTendered}) is less than Total (₹${calculatedGrandTotal})`, "error");
      return;
    }

    setIsRecordingPayment(true);
    try {
      const success = await onRecordPayment(invoiceId, {
        amount: calculatedGrandTotal,
        paymentMethod,
        cashDetails:
          paymentMethod === "CASH"
            ? { cashReceived: numCashTendered || calculatedGrandTotal }
            : undefined,
        transactionReference: paymentMethod === "UPI" ? upiRef : undefined,
        notes: `Settled via POS Billing Sidebar (${paymentMethod})`,
      });

      if (success) {
        showToast("Payment recorded successfully! Order settled.", "success");
      }
    } finally {
      setIsRecordingPayment(false);
    }
  };

  return (
    <aside className="w-full lg:w-[420px] bg-white border-l border-slate-200 flex flex-col h-full shrink-0 select-none shadow-sm relative">
      {/* Toast Notification in sidebar */}
      {sidebarToast && (
        <div className="absolute top-2 left-2 right-2 z-30 animate-in fade-in slide-in-from-top-2">
          <div
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between shadow-md ${
              sidebarToast.type === "success"
                ? "bg-emerald-600 text-white"
                : "bg-rose-600 text-white"
            }`}
          >
            <span>{sidebarToast.message}</span>
            <button onClick={() => setSidebarToast(null)}>✕</button>
          </div>
        </div>
      )}

      {/* 1. Header: Selected Order & Table Info */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-extrabold text-slate-900 text-sm">
              Billing Panel
            </h2>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                isPending
                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                  : isBilled
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {isPending ? "Pending Bill" : isBilled ? "Billed" : order.billRequest?.status}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-xs font-bold text-slate-700">
              {order.orderNumber}
            </span>
            <span className="text-slate-300">•</span>
            {/* Mandatory Table Number Highlight */}
            <span className="px-2 py-0.5 rounded-md text-xs font-black bg-teal-100 text-teal-900 border border-teal-300 flex items-center gap-1 shadow-2xs">
              {isDineIn ? (
                <Utensils className="w-3 h-3 text-teal-700" />
              ) : (
                <ShoppingBag className="w-3 h-3 text-teal-700" />
              )}
              <span>{tableLabel}</span>
            </span>
          </div>
        </div>

        <button
          onClick={onDeselect}
          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 cursor-pointer"
          title="Deselect order"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Center Section */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Existing Order Items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-slate-600 font-bold uppercase text-[10px] tracking-wider">
            <span>Ordered Items ({(order.items || []).length})</span>
            <span>Price</span>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {order.items.map((item, idx) => (
              <div
                key={item._id || idx}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/70"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <span className="font-bold text-teal-800 bg-teal-100 px-1.5 py-0.5 rounded text-[11px] font-mono">
                    {item.quantity}×
                  </span>
                  <div className="truncate">
                    <span className="font-semibold text-slate-800 truncate block">
                      {item.name}
                    </span>
                    {item.notes && (
                      <span className="text-[10px] text-amber-700 italic">
                        {item.notes}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono font-bold text-slate-800">
                    ₹{(item.itemTotal || item.price * item.quantity).toFixed(2)}
                  </span>
                  {isPending && item._id && (
                    <button
                      onClick={() => handleRemoveExistingItem(item._id!, item.name)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Local Extra Items */}
            {extraItems.map((item) => (
              <div
                key={item.menuItemId}
                className="flex items-center justify-between p-2 rounded-xl bg-teal-50/70 border border-teal-200"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <span className="font-bold text-teal-900 bg-teal-200 px-1.5 py-0.5 rounded text-[11px] font-mono">
                    {item.quantity}×
                  </span>
                  <span className="font-semibold text-teal-950 truncate">
                    {item.name} (Extra)
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono font-bold text-teal-900">
                    ₹{(item.price * item.quantity).toFixed(2)}
                  </span>
                  <button
                    onClick={() => handleRemoveExtraItem(item.menuItemId)}
                    className="p-1 text-rose-500 hover:bg-rose-100 rounded"
                    title="Remove extra item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Add Extra Items / Charges Section (Active before bill confirmed) */}
        {!isBilled && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Add Extra Items / Charges
            </span>

            {/* Quick add-on buttons */}
            {quickAddOns.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {quickAddOns.map((item) => (
                  <button
                    key={item._id}
                    onClick={() => handleAddExtraItem(item, 1)}
                    disabled={isAddingItem}
                    className="py-1 px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-teal-600" />
                    <span>{item.name}</span>
                    <span className="font-mono font-bold text-teal-700">₹{item.price}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Menu Dropdown selector for all other items */}
            <div className="flex items-center gap-2">
              <select
                value={selectedMenuItemId}
                onChange={(e) => setSelectedMenuItemId(e.target.value)}
                className="flex-1 py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none"
              >
                <option value="">Select menu item to add...</option>
                {menuItems.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name} — ₹{m.price}
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  const m = menuItems.find((i) => i._id === selectedMenuItemId);
                  if (m) handleAddExtraItem(m, 1);
                }}
                disabled={!selectedMenuItemId || isAddingItem}
                className="py-1.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1 disabled:opacity-50 cursor-pointer"
              >
                {isAddingItem ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Add</span>
              </button>
            </div>

            {/* Additional Custom Charge (e.g. Service / Packaging) */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-slate-500 text-[11px] w-28 shrink-0">Custom Charge:</span>
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={additionalCharge}
                  onChange={(e) => setAdditionalCharge(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* 4. Discount Section */}
        {!isBilled && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Discount
              </span>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setDiscountType("FIXED")}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                    discountType === "FIXED"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-500"
                  }`}
                >
                  ₹ (Fixed)
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType("PERCENTAGE")}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                    discountType === "PERCENTAGE"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-500"
                  }`}
                >
                  % (Percent)
                </button>
              </div>
            </div>

            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400 font-mono">
                {discountType === "FIXED" ? "₹" : "%"}
              </span>
              <input
                type="number"
                min="0"
                max={discountType === "PERCENTAGE" ? 100 : currentSubtotal}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === "FIXED" ? "Discount amount..." : "Discount %..."}
                className="w-full pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>
        )}

        {/* 5. Customer Information (Optional) */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Customer Info (Optional)
            </span>
            <span className="text-[10px] text-slate-400">Not required</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <User className="w-3 h-3 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Name"
                disabled={isBilled}
                className="w-full pl-7 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none disabled:bg-slate-100"
              />
            </div>
            <div className="relative">
              <Phone className="w-3 h-3 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Phone #"
                disabled={isBilled}
                className="w-full pl-7 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none disabled:bg-slate-100"
              />
            </div>
          </div>
        </div>

        {/* 6. Payment Method Selection (Cash / UPI) */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Payment Method
          </span>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod("CASH")}
              className={`p-2 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all cursor-pointer ${
                paymentMethod === "CASH"
                  ? "bg-teal-50 border-teal-500 text-teal-800 shadow-2xs"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Banknote className="w-4 h-4 text-teal-600" />
              <span>Cash</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod("UPI")}
              className={`p-2 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all cursor-pointer ${
                paymentMethod === "UPI"
                  ? "bg-teal-50 border-teal-500 text-teal-800 shadow-2xs"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <QrCode className="w-4 h-4 text-teal-600" />
              <span>UPI</span>
            </button>
          </div>

          {/* Cash Tendered Input & Change Due */}
          {paymentMethod === "CASH" && (
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-semibold text-[11px]">
                  Cash Received:
                </span>
                <div className="relative w-28">
                  <span className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    placeholder={String(calculatedGrandTotal)}
                    className="w-full pl-5 pr-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 text-right focus:outline-none"
                  />
                </div>
              </div>

              {/* Quick Cash Chips */}
              <div className="flex gap-1 justify-end">
                <button
                  type="button"
                  onClick={() => setCashTendered(String(calculatedGrandTotal))}
                  className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-100"
                >
                  Exact (₹{calculatedGrandTotal})
                </button>
                <button
                  type="button"
                  onClick={() => setCashTendered("500")}
                  className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-100"
                >
                  ₹500
                </button>
                <button
                  type="button"
                  onClick={() => setCashTendered("1000")}
                  className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-100"
                >
                  ₹1000
                </button>
              </div>

              {changeDue > 0 && (
                <div className="flex justify-between items-center text-xs font-bold text-emerald-700 pt-1 border-t border-slate-200">
                  <span>Change to Return:</span>
                  <span className="font-mono text-sm">₹{changeDue.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* UPI Reference Note */}
          {paymentMethod === "UPI" && (
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[11px] text-slate-600 font-semibold block">
                UPI Reference / UTR (Optional):
              </span>
              <input
                type="text"
                value={upiRef}
                onChange={(e) => setUpiRef(e.target.value)}
                placeholder="e.g. 332194812301"
                className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* 7. Bottom Billing Actions & Calculations Section */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3 shrink-0">
        {/* Financial Calculation Breakdown */}
        <div className="space-y-1 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal:</span>
            <span className="font-mono font-semibold">₹{currentSubtotal.toFixed(2)}</span>
          </div>

          {calculatedDiscount > 0 && (
            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>Discount:</span>
              <span className="font-mono">-₹{calculatedDiscount.toFixed(2)}</span>
            </div>
          )}

          {extraChargesAmount > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Additional Charges:</span>
              <span className="font-mono">₹{extraChargesAmount.toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between text-slate-600">
            <span>GST (5% Tax):</span>
            <span className="font-mono font-semibold">₹{calculatedGst.toFixed(2)}</span>
          </div>

          <div className="pt-2 border-t border-slate-300 flex justify-between items-baseline">
            <span className="font-extrabold text-sm text-slate-900">Grand Total</span>
            <span className="font-mono text-xl font-black text-teal-700">
              ₹{calculatedGrandTotal.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {/* If NOT yet billed: Generate Bill / Confirm Bill */}
          {isPending && (
            <button
              onClick={handleConfirm}
              disabled={isConfirming}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isConfirming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>Confirm & Generate Bill</span>
            </button>
          )}

          {/* If BILLED: Print Bill & Record Payment */}
          {isBilled && (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                <div>
                  <span className="text-[10px] text-emerald-800 font-bold block">
                    INVOICE ISSUED
                  </span>
                  <span className="font-mono font-black text-emerald-950">
                    {order.billRequest?.invoiceId?.invoiceNumber || "INV-READY"}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-200 text-emerald-900">
                  {order.billRequest?.invoiceId?.paymentStatus || "UNPAID"}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => onPrintBill(order)}
                  className="flex-1 py-2 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>Print Bill</span>
                </button>

                {order.billRequest?.invoiceId?.paymentStatus !== "PAID" && (
                  <button
                    onClick={handlePayment}
                    disabled={isRecordingPayment}
                    className="flex-1 py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-[0.99] text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isRecordingPayment ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CreditCard className="w-3.5 h-3.5" />
                    )}
                    <span>Record Payment</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
