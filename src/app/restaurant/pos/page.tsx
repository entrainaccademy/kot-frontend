"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { POSProvider, usePOS } from "../../../context/POSContext";
import { POSSidebar } from "../../../components/pos/POSSidebar";
import { POSHeader } from "../../../components/pos/POSHeader";
import { CategoryTabs } from "../../../components/pos/CategoryTabs";
import { MenuItemCard } from "../../../components/pos/MenuItemCard";
import { CartPanel } from "../../../components/pos/CartPanel";
import { TableSelectorModal } from "../../../components/pos/TableSelectorModal";
import { DiscountModal } from "../../../components/pos/DiscountModal";
import { PaymentModal } from "../../../components/pos/PaymentModal";
import { InvoiceModal } from "../../../components/pos/InvoiceModal";
import { ReceiptPrintModal } from "../../../components/pos/ReceiptPrintModal";
import { ToastContainer } from "../../../components/pos/Toast";
import { formatCurrency } from "../../../lib/utils";
import { ShoppingBag, UtensilsCrossed, ShieldAlert } from "lucide-react";

function POSBillingContent() {
  const router = useRouter();
  const { user, loading: authLoading, hasPermission } = useAuth();
  const {
    filteredItems,
    loadingMenu,
    cart,
    estimatedGrandTotal,
    activeInvoice,
  } = usePOS();

  // Modals state
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Mobile cart drawer state
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // Protected route check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  if (authLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600 gap-3">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold">Loading POS Terminal...</span>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Permission check: Cashier, Manager, Admin allowed
  const canAccessPOS =
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN" ||
    user.role === "MANAGER" ||
    user.role === "CASHIER" ||
    hasPermission("billing:create") ||
    hasPermission("orders:create");

  if (!canAccessPOS) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800 p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold">Access Restricted</h2>
        <p className="text-sm text-slate-500 max-w-sm mt-1">
          Your current staff role ({user.role}) does not have permission to access the POS Billing terminal.
        </p>
        <button
          onClick={() => router.push("/login")}
          className="mt-5 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all"
        >
          Return to Login
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-slate-100 overflow-hidden font-sans">
      {/* 1. Left Navigation Sidebar (Desktop) */}
      <div className="hidden lg:block shrink-0">
        <POSSidebar activePath="/restaurant/pos" />
      </div>

      {/* 2. Center Food Menu & Ordering Section */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 h-full overflow-hidden">
        {/* POS Top Header */}
        <POSHeader />

        {/* Categories Bar */}
        <div className="px-6 pt-4 pb-2 bg-slate-50/80 backdrop-blur-xs border-b border-slate-200/60">
          <CategoryTabs />
        </div>

        {/* Menu Items Grid */}
        <main className="flex-1 overflow-y-auto p-6">
          {loadingMenu ? (
            /* Loading Skeletons */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-slate-200 rounded-2xl p-4 h-40 animate-pulse flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                    <div className="h-4 bg-slate-200 rounded w-12" />
                    <div className="h-7 bg-slate-100 rounded-xl w-14" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            /* Empty State */
            <div className="h-full flex flex-col items-center justify-center text-center p-12 text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-slate-200/70 flex items-center justify-center mb-3 text-slate-400">
                <UtensilsCrossed className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-700">No Food Items Found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                No items match your active category or search query. Try clearing the search or adding items in Menu Management.
              </p>
            </div>
          ) : (
            /* Product Cards Grid */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredItems.map((item) => (
                <MenuItemCard key={item._id} item={item} />
              ))}
            </div>
          )}
        </main>

        {/* Mobile Floating Cart Summary Button */}
        <div className="lg:hidden p-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] text-slate-500 font-semibold">
              {cart.length} item{cart.length !== 1 ? "s" : ""} selected
            </span>
            <span className="text-base font-black text-teal-700">
              {formatCurrency(activeInvoice ? activeInvoice.grandTotal : estimatedGrandTotal)}
            </span>
          </div>

          <button
            onClick={() => setIsMobileCartOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white font-bold text-xs shadow-sm shadow-teal-600/20"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>View Bill</span>
          </button>
        </div>
      </div>

      {/* 3. Right Billing Cart Panel (Desktop) */}
      <div className="hidden lg:block shrink-0">
        <CartPanel
          onOpenTableModal={() => setIsTableModalOpen(true)}
          onOpenDiscountModal={() => setIsDiscountModalOpen(true)}
          onOpenPaymentModal={() => setIsPaymentModalOpen(true)}
          onOpenInvoiceModal={() => setIsInvoiceModalOpen(true)}
        />
      </div>

      {/* Mobile Cart Slide-Over / Modal */}
      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right">
            <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <span className="font-bold text-sm text-slate-800">Order & Billing</span>
              <button
                onClick={() => setIsMobileCartOpen(false)}
                className="text-xs font-semibold px-3 py-1 rounded-lg bg-slate-200 text-slate-700"
              >
                Close ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <CartPanel
                onOpenTableModal={() => setIsTableModalOpen(true)}
                onOpenDiscountModal={() => setIsDiscountModalOpen(true)}
                onOpenPaymentModal={() => setIsPaymentModalOpen(true)}
                onOpenInvoiceModal={() => setIsInvoiceModalOpen(true)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <TableSelectorModal
        isOpen={isTableModalOpen}
        onClose={() => setIsTableModalOpen(false)}
      />

      <DiscountModal
        isOpen={isDiscountModalOpen}
        onClose={() => setIsDiscountModalOpen(false)}
      />

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onOpenReceipt={() => setIsReceiptModalOpen(true)}
        onOpenInvoice={() => setIsInvoiceModalOpen(true)}
      />

      <InvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        onOpenReceipt={() => setIsReceiptModalOpen(true)}
      />

      <ReceiptPrintModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
      />

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
}

export default function POSPage() {
  return (
    <POSProvider>
      <POSBillingContent />
    </POSProvider>
  );
}
