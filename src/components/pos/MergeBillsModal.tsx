"use client";

import React, { useState, useMemo } from "react";
import { BillRequestOrder } from "../../types/pos";
import { apiClient } from "../../lib/apiClient";
import {
  X,
  Layers,
  Utensils,
  Check,
  CheckSquare,
  Square,
  Clock,
  ShoppingBag,
  Loader2,
  ArrowRight,
  AlertCircle,
  Sparkles,
} from "lucide-react";

interface MergeBillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: BillRequestOrder[];
  onMergeSuccess: (mergedOrder: BillRequestOrder) => void;
}

export const MergeBillsModal: React.FC<MergeBillsModalProps> = ({
  isOpen,
  onClose,
  orders,
  onMergeSuccess,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filter only active, mergeable orders (i.e. not yet billed/completed/cancelled)
  const availableOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        o.status !== "BILLED" &&
        o.status !== "COMPLETED" &&
        o.status !== "CANCELLED" &&
        o.billRequest?.status !== "CONFIRMED"
    );
  }, [orders]);

  // Toggle order selection
  const handleToggleSelect = (orderId: string) => {
    setError(null);
    setSelectedIds((prev) => {
      let next: string[];
      if (prev.includes(orderId)) {
        next = prev.filter((id) => id !== orderId);
        // If the removed order was primary, reassign primary to the first available selected
        if (primaryId === orderId) {
          setPrimaryId(next.length > 0 ? next[0] : null);
        }
      } else {
        next = [...prev, orderId];
        // If no primary selected yet, set this as primary
        if (!primaryId) {
          setPrimaryId(orderId);
        }
      }
      return next;
    });
  };

  // Get selected order objects
  const selectedOrders = useMemo(() => {
    return availableOrders.filter((o) => selectedIds.includes(o._id));
  }, [availableOrders, selectedIds]);

  // Determine current active primary order
  const primaryOrder = useMemo(() => {
    return selectedOrders.find((o) => o._id === primaryId) || selectedOrders[0] || null;
  }, [selectedOrders, primaryId]);

  // Combined Tables Label (e.g. "Table T-01 + Table T-02")
  const combinedTablesLabel = useMemo(() => {
    if (selectedOrders.length === 0) return "";
    const names = selectedOrders.map((o) => {
      if (o.tableId?.tableNumber) {
        return `Table ${o.tableId.tableNumber}${o.tableId.floor ? ` (${o.tableId.floor})` : ""}`;
      }
      if (o.billRequest?.tableNumber) {
        return `Table ${o.billRequest.tableNumber}`;
      }
      return o.orderType === "TAKEAWAY" ? "Takeaway" : o.orderType;
    });
    return Array.from(new Set(names)).join(" + ");
  }, [selectedOrders]);

  // Real-time calculation of combined items and financial totals
  const mergedPreview = useMemo(() => {
    if (selectedOrders.length < 2) return null;

    interface ConsolidatedItem {
      menuItemId: string;
      name: string;
      price: number;
      quantity: number;
      taxRate: number;
      notes?: string;
      itemTotal: number;
    }

    const itemMap = new Map<string, ConsolidatedItem>();

    for (const order of selectedOrders) {
      for (const item of order.items) {
        if (item.status === "ACTIVE") {
          const rawId = (item.menuItemId as any)?._id || (typeof item.menuItemId === "string" ? item.menuItemId : null) || item._id || item.name;
          const key = `${rawId}__${item.price}__${item.notes || ""}`;

          if (itemMap.has(key)) {
            const existing = itemMap.get(key)!;
            existing.quantity += item.quantity;
            existing.itemTotal = Math.round(existing.price * existing.quantity * 100) / 100;
          } else {
            itemMap.set(key, {
              menuItemId: typeof rawId === "string" ? rawId : String(rawId),
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              taxRate: item.taxRate || 5,
              notes: item.notes,
              itemTotal: Math.round(item.price * item.quantity * 100) / 100,
            });
          }
        }
      }
    }

    const combinedItems = Array.from(itemMap.values());

    let subtotal = 0;
    let tax = 0;

    for (const item of combinedItems) {
      subtotal += item.itemTotal;
      const itemTax = Math.round(((item.itemTotal * (item.taxRate || 5)) / 100) * 100) / 100;
      tax += itemTax;
    }

    subtotal = Math.round(subtotal * 100) / 100;
    tax = Math.round(tax * 100) / 100;
    const grandTotal = Math.round((subtotal + tax) * 100) / 100;

    return {
      items: combinedItems,
      subtotal,
      tax,
      grandTotal,
      itemCount: combinedItems.reduce((sum, i) => sum + i.quantity, 0),
    };
  }, [selectedOrders]);

  // Execute Merge Operation
  const handleConfirmMerge = async () => {
    if (selectedIds.length < 2 || !primaryOrder) {
      setError("Please select at least two table bills to combine.");
      return;
    }

    setIsMerging(true);
    setError(null);

    try {
      // 1. Attempt dedicated backend merge endpoint
      let mergedData: BillRequestOrder | null = null;
      try {
        const res = await apiClient.post<{
          success: boolean;
          message?: string;
          data?: BillRequestOrder;
        }>("/restaurant/orders/merge-bills", {
          primaryOrderId: primaryOrder._id,
          orderIds: selectedIds,
        });

        if (res.success && res.data) {
          mergedData = res.data;
        }
      } catch (err: any) {
        // Fall back if endpoint is not yet available on remote server
        const errMsg = err?.message || "";
        if (!errMsg.includes("404") && !errMsg.includes("Cannot POST")) {
          throw err;
        }
      }

      // 2. Resilient Fallback using existing endpoints
      if (!mergedData) {
        const secondaryOrders = selectedOrders.filter((o) => o._id !== primaryOrder._id);

        // Gather all secondary items to append to primary order
        const extraItems = secondaryOrders.flatMap((o) =>
          o.items
            .filter((i) => i.status === "ACTIVE")
            .map((i) => ({
              menuItemId: ((i.menuItemId as any)?._id || (typeof i.menuItemId === "string" ? i.menuItemId : null) || i._id || "") as string,
              quantity: i.quantity,
              notes: i.notes,
            }))
        );

        if (extraItems.length > 0) {
          await apiClient.post(`/restaurant/orders/${primaryOrder._id}/items`, {
            items: extraItems,
          });
        }

        // Cancel secondary orders
        for (const sec of secondaryOrders) {
          await apiClient.post(`/restaurant/orders/${sec._id}/cancel`, {
            reason: `Merged into ${primaryOrder.orderNumber}`,
          });
        }

        // Fetch refreshed primary order
        const refreshed = await apiClient.get<{ success: boolean; data: BillRequestOrder }>(
          `/restaurant/orders/${primaryOrder._id}`
        );

        mergedData = refreshed.data || primaryOrder;
      }

      onMergeSuccess(mergedData);
      onClose();
    } catch (err: any) {
      console.error("Failed to merge table bills:", err);
      setError(err?.message || "Failed to merge table bills. Please try again.");
    } finally {
      setIsMerging(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shadow-2xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Merge Table Bills
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Combine & Pay Together
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Select two or more table bills from the queue to combine them into a single bill.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isMerging}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Select Table Bills (7 cols) */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  1. Select Table Bills ({selectedIds.length} Selected)
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  Min. 2 tables required
                </span>
              </div>

              {availableOrders.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6">
                  <Utensils className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">No Active Bills to Merge</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    There must be at least two active table bill requests in the queue.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {availableOrders.map((order) => {
                    const isChecked = selectedIds.includes(order._id);
                    const isPrimary = primaryId === order._id;

                    const tableDisplay = order.tableId?.tableNumber
                      ? `Table ${order.tableId.tableNumber}${order.tableId.floor ? ` (${order.tableId.floor})` : ""}`
                      : order.billRequest?.tableNumber
                      ? `Table ${order.billRequest.tableNumber}`
                      : order.orderType;

                    return (
                      <div
                        key={order._id}
                        onClick={() => handleToggleSelect(order._id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                          isChecked
                            ? "bg-indigo-50/50 border-indigo-400 ring-1 ring-indigo-400/50 shadow-2xs"
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                        }`}
                      >
                        {/* Checkbox */}
                        <div className="pt-0.5 text-indigo-600 shrink-0">
                          {isChecked ? (
                            <CheckSquare className="w-5 h-5 text-indigo-600 fill-indigo-100" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-300" />
                          )}
                        </div>

                        {/* Order Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-extrabold text-xs text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200/80 shadow-2xs">
                                {tableDisplay}
                              </span>
                              <span className="font-mono font-bold text-[11px] text-slate-500">
                                {order.orderNumber}
                              </span>
                            </div>

                            <span className="font-mono font-black text-xs text-slate-900 shrink-0">
                              ₹{order.grandTotal.toFixed(2)}
                            </span>
                          </div>

                          {/* Items summary */}
                          <div className="mt-1 text-[11px] text-slate-500 truncate">
                            <span className="font-semibold text-slate-700">
                              {order.items.reduce((sum, i) => sum + i.quantity, 0)} items:
                            </span>{" "}
                            {order.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                          </div>

                          {/* Primary Selector when checked */}
                          {isChecked && (
                            <div className="mt-2 pt-2 border-t border-indigo-100 flex items-center justify-between text-[11px]">
                              <span className="text-slate-500 font-medium">Merge target table:</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPrimaryId(order._id);
                                }}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                                  isPrimary
                                    ? "bg-indigo-600 text-white shadow-2xs"
                                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                {isPrimary ? "Primary Bill (Keep)" : "Set as Primary"}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column: Merged Bill Live Preview (5 cols) */}
            <div className="lg:col-span-5 bg-slate-50/80 border border-slate-200 rounded-3xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>2. Merged Bill Preview</span>
                  </span>
                  {selectedIds.length >= 2 && (
                    <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                      Ready to Merge
                    </span>
                  )}
                </div>

                {mergedPreview ? (
                  <div className="mt-3 space-y-3">
                    {/* Combined Tables Banner */}
                    <div className="p-2.5 rounded-xl bg-white border border-indigo-200/80 text-xs space-y-1 shadow-2xs">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                        Combined Bill Tables:
                      </div>
                      <div className="font-extrabold text-slate-900 text-xs">
                        {combinedTablesLabel}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Primary Account: <strong>{primaryOrder?.orderNumber}</strong>
                      </div>
                    </div>

                    {/* Preserved Items Breakdown */}
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      <div className="text-[11px] font-bold text-slate-600">
                        All Preserved Ordered Items ({mergedPreview.itemCount}):
                      </div>
                      {mergedPreview.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white border border-slate-200/60"
                        >
                          <div className="flex items-baseline gap-1.5 truncate pr-2">
                            <span className="font-black text-[10px] text-teal-800 bg-teal-50 border border-teal-200/80 px-1 rounded shrink-0">
                              {item.quantity}x
                            </span>
                            <span className="font-medium text-slate-800 truncate">
                              {item.name}
                            </span>
                            {item.notes && (
                              <span className="text-[10px] text-amber-600 italic truncate">
                                ({item.notes})
                              </span>
                            )}
                          </div>
                          <span className="font-mono font-bold text-slate-700 shrink-0">
                            ₹{item.itemTotal.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Accurate Financial Calculation */}
                    <div className="pt-2 border-t border-slate-200 space-y-1 text-xs">
                      <div className="flex justify-between text-slate-500">
                        <span>Combined Subtotal:</span>
                        <span className="font-mono">₹{mergedPreview.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Taxes (GST 5%):</span>
                        <span className="font-mono">₹{mergedPreview.tax.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1.5 border-t border-dashed border-slate-200">
                        <span>Grand Total:</span>
                        <span className="font-mono text-indigo-700 text-base font-black">
                          ₹{mergedPreview.grandTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-16 text-center text-slate-400 space-y-2">
                    <Layers className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-xs font-semibold text-slate-600">
                      Select 2 or more table bills
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto">
                      Items from the selected tables will be aggregated here with the recalculated total.
                    </p>
                  </div>
                )}
              </div>

              {/* Guidance Box */}
              <div className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-[11px] text-indigo-900 leading-relaxed">
                Merging transfers all items to the primary table bill and cancels the secondary requests. The merged bill will then open immediately in your billing sidebar.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            disabled={isMerging}
            className="py-2 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            onClick={handleConfirmMerge}
            disabled={selectedIds.length < 2 || isMerging}
            className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs font-black flex items-center gap-2 shadow-sm shadow-indigo-600/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isMerging ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Merging Bills...</span>
              </>
            ) : (
              <>
                <Layers className="w-4 h-4" />
                <span>
                  Combine {selectedIds.length > 1 ? `${selectedIds.length} Bills` : "Bills"} & Checkout
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
