"use client";

import React from "react";
import Link from "next/link";
import { POSSidebar } from "../../../components/pos/POSSidebar";
import { useAuth } from "../../../context/AuthContext";
import { Users, Receipt, ArrowRight, ShieldCheck } from "lucide-react";

export default function CustomersPage() {
  const { user } = useAuth();

  return (
    <div className="flex h-screen w-screen bg-slate-100 overflow-hidden font-sans">
      <div className="hidden lg:block shrink-0">
        <POSSidebar activePath="/restaurant/customers" />
      </div>

      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 h-full overflow-y-auto">
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-700">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
                Customer Directory
              </h1>
              <p className="text-[11px] text-slate-500">
                {user?.restaurantName || "Cobolt Kitchen & Bar"} • Customer Profiles & History
              </p>
            </div>
          </div>

          <Link
            href="/restaurant/pos"
            className="py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all"
          >
            <Receipt className="w-4 h-4" />
            <span>Open POS Billing</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </header>

        <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs text-center max-w-lg mx-auto mt-12">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-4 border border-teal-100">
              <Users className="w-7 h-7" />
            </div>
            <h2 className="text-base font-extrabold text-slate-900">
              Customer Management & CRM
            </h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Customers added during POS checkout (Name, Phone number, and Delivery address) are automatically linked to your tenant database.
            </p>
            <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-xs font-bold text-teal-700">
              <ShieldCheck className="w-4 h-4" />
              <span>Multi-Tenant Isolated Customer Records</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

