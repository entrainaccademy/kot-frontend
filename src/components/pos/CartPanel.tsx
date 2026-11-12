"use client";

import React, { useState } from "react";
import { usePOS } from "../../context/POSContext";
import { formatCurrency } from "../../lib/utils";
import { OrderType } from "../../types/pos";
import {
  Utensils,
  ShoppingBag,
  Truck,
  Plus,
  Minus,
  Trash2,
  Tag,
  ChefHat,
  Receipt,
  CreditCard,
  Grid3X3,
  User,
  Phone,
  MessageSquare,
  Loader2,
  RotateCcw,
} from "lucide-react";

interface CartPanelProps {
  onOpenTableModal: () => void;
  onOpenDiscountModal: () => void;
  onOpenPaymentModal: () => void;
  onOpenInvoiceModal: () => void;
}

export const CartPanel: React.FC<CartPanelProps> = ({
  onOpenTableModal,
  onOpenDiscountModal,
  onOpenPaymentModal,
  onOpenInvoiceModal,
}) => {
  const {
    cart,
    updateQuantity,
    updateItemNotes,
    removeFromCart,
    clearCart,
    orderType,
    setOrderType,
    selectedTable,
    customerName,
    setCustomerName,
    customerPhone,
    setCustomerPhone,
    subtotal,
    discount,
    discountAmount,
    estimatedTax,
    estimatedGrandTotal,
    activeOrderId,
    activeOrderNumber,
    activeInvoice,
    submittingOrder,
    generatingBill,
    submitOrderToKitchen,
    generateBill,
  } = usePOS();

  const [expandedNotesId, setExpandedNotesId] = useState<string | null>(null);
  const [showCustomerInput, setShowCustomerInput] = useState<boolean>(false);

  const orderTypes: { id: OrderType; label: string; icon: any }[] = [
    { id: "DINE_IN", label: "Dine-In", icon: Utensils },
    { id: "TAKEAWAY", label: "Takeaway", icon: ShoppingBag },
    { id: "DELIVERY", label: "Delivery", icon: Truck },
  ];

  return (
    <div className="w-96 bg-white border-l border-slate-200 flex flex-col h-screen shrink-0 select-none">
      {/* Header & Order Type Segmented Control */}
      <div className="p-4 border-b border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-900 text-sm">Current Order</h2>
            {activeOrderNumber && (
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                #{activeOrderNumber}
              </span>
            )}
          </div>
          {(cart.length > 0 || activeOrderId) && (
            <button
              onClick={clearCart}
              className="py-1 px-2.5 rounded-lg border border-slate-200 hover:border-slate-300 text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 transition-all cursor-pointer"
              title="Clear current cart and start a fresh order"
            >
              <RotateCcw className="w-3 h-3 text-slate-500" />
              <span>New Order</span>
            </button>
          )}
        </div>

        {/* Order Type Toggle */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
          {orderTypes.map((type) => {
            const Icon = type.icon;
            const isSelected = orderType === type.id;

            return (
              <button
                key={type.id}
                onClick={() => setOrderType(type.id)}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isSelected
                    ? "bg-white text-teal-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{type.label}</span>
              </button>
            );
          })}
        </div>

        {/* Table Selector (for Dine-in) & Customer Info Toggle */}
        <div className="flex items-center gap-2">
          {orderType === "DINE_IN" && (
            <button
              onClick={onOpenTableModal}
              className={`flex-1 flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                selectedTable
                  ? "bg-teal-50/70 border-teal-300 text-teal-900"
                  : "bg-amber-50/80 border-amber-200 text-amber-900 hover:bg-amber-100/50"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Grid3X3 className="w-3.5 h-3.5 text-teal-600" />
                <span>
                  {selectedTable ? `Table ${selectedTable.tableNumber}` : "Assign Table *"}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 underline font-normal">
                Change
              </span>
            </button>
          )}

          <button
            onClick={() => setShowCustomerInput(!showCustomerInput)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              customerName || customerPhone
                ? "bg-teal-50 border-teal-300 text-teal-800"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span className="truncate max-w-[80px]">
              {customerName || "Customer"}
            </span>
          </button>
        </div>

        {/* Optional Collapsible Customer Input */}
        {showCustomerInput && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer Name"
                className="w-full text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Phone Number (for SMS Bill)"
                className="w-full text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3 text-slate-300">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <p className="text-sm font-bold text-slate-700">Your cart is empty</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
              Click on any food item from the menu to add it to the order.
            </p>
          </div>
        ) : (
          cart.map((item, idx) => (
            <div key={`${item.menuItemId}-${idx}`} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-slate-900 leading-tight">
                    {item.name}
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    {formatCurrency(item.price)} each
                  </span>
                </div>

                <span className="text-xs font-extrabold text-slate-900">
                  {formatCurrency(item.itemTotal)}
                </span>
              </div>

              {/* Quantity Controls & Notes Toggle */}
              <div className="flex items-center justify-between mt-2">
                <button
                  onClick={() =>
                    setExpandedNotesId(
                      expandedNotesId === item.menuItemId ? null : item.menuItemId
                    )
                  }
                  className={`text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                    item.notes
                      ? "text-teal-700 font-bold"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>{item.notes ? "Edit note" : "+ Add instruction"}</span>
                </button>

                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                  <button
                    onClick={() => updateQuantity(item.menuItemId, -1)}
                    className="w-5 h-5 rounded flex items-center justify-center bg-white text-slate-700 hover:bg-slate-200 transition-colors shadow-2xs"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-xs font-bold text-slate-800 min-w-4 text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.menuItemId, 1)}
                    className="w-5 h-5 rounded flex items-center justify-center bg-white text-slate-700 hover:bg-slate-200 transition-colors shadow-2xs"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => removeFromCart(item.menuItemId)}
                    className="w-5 h-5 rounded flex items-center justify-center text-rose-500 hover:bg-rose-50 transition-colors ml-1"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Cooking Instructions Input */}
              {(expandedNotesId === item.menuItemId || item.notes) && (
                <div className="mt-2 animate-in fade-in">
                  <input
                    type="text"
                    value={item.notes || ""}
                    onChange={(e) =>
                      updateItemNotes(item.menuItemId, e.target.value)
                    }
                    placeholder="e.g. Less spicy, extra cheese, no onion"
                    className="w-full px-2.5 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Bill Totals Breakdown & Action Buttons Footer */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/50 space-y-3">
        {/* Bill Calculations */}
        <div className="space-y-1.5 text-xs text-slate-600">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-semibold text-slate-800">{formatCurrency(subtotal)}</span>
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={onOpenDiscountModal}
              className="text-[11px] font-bold text-teal-700 hover:underline flex items-center gap-1"
            >
              <Tag className="w-3 h-3" />
              <span>{discount ? `Discount (${discount.type === "PERCENTAGE" ? `${discount.value}%` : "Fixed"})` : "+ Add Discount"}</span>
            </button>
            {discountAmount > 0 && (
              <span className="font-bold text-emerald-600">
                -{formatCurrency(discountAmount)}
              </span>
            )}
          </div>

          <div className="flex justify-between text-slate-500 text-[11px]">
            <span>Estimated Taxes (GST)</span>
            <span>{formatCurrency(estimatedTax)}</span>
          </div>

          {/* Grand Total */}
          <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
            <span className="text-xs font-bold text-slate-900">Total Payable</span>
            <span className="text-xl font-black text-teal-700">
              {formatCurrency(activeInvoice ? activeInvoice.grandTotal : estimatedGrandTotal)}
            </span>
          </div>
        </div>

        {/* Action Buttons Workflow */}
        <div className="space-y-2 pt-1">
          {/* Send to Kitchen / KOT Button */}
          <button
            onClick={() => submitOrderToKitchen()}
            disabled={cart.length === 0 || submittingOrder}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-xs"
          >
            {submittingOrder ? (
              <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
            ) : (
              <ChefHat className="w-4 h-4 text-amber-400" />
            )}
            <span>{activeOrderId ? "Update Kitchen KOT" : "Send to Kitchen (KOT)"}</span>
          </button>

          {/* Generate Bill Button */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => generateBill()}
              disabled={cart.length === 0 || generatingBill}
              className="py-2.5 rounded-xl border border-teal-600/30 bg-teal-50 text-teal-800 hover:bg-teal-100 text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {generatingBill ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Receipt className="w-3.5 h-3.5" />
              )}
              <span>{activeInvoice ? "Bill Ready" : "Generate Bill"}</span>
            </button>

            {/* Settle / Payment Button */}
            <button
              onClick={async () => {
                if (!activeInvoice) {
                  const billRes = await generateBill();
                  if (billRes.success) {
                    onOpenPaymentModal();
                  }
                } else {
                  onOpenPaymentModal();
                }
              }}
              disabled={cart.length === 0}
              className="py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-teal-600/20 disabled:opacity-50"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Pay & Settle</span>
            </button>
          </div>

          {activeInvoice && (
            <button
              onClick={onOpenInvoiceModal}
              className="w-full py-1.5 text-[11px] font-bold text-teal-700 hover:underline flex items-center justify-center gap-1"
            >
              <span>View Invoice & Tax Breakdown</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
