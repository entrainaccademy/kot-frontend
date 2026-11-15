"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../lib/apiClient";
import { getSocket } from "../../lib/socket";
import {
  LayoutDashboard,
  Receipt,
  FileText,
  UtensilsCrossed,
  Grid3X3,
  ChefHat,
  BookOpen,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Store,
  User,
} from "lucide-react";

interface POSSidebarProps {
  activePath?: string;
}

export const POSSidebar: React.FC<POSSidebarProps> = ({ activePath = "/restaurant/pos" }) => {
  const { user, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [pendingBillCount, setPendingBillCount] = useState<number>(0);

  useEffect(() => {
    setMounted(true);

    let isSubscribed = true;
    const fetchPendingCount = async () => {
      try {
        const res = await apiClient.get<{ success: boolean; pendingCount?: number }>(
          "/restaurant/bill-requests?status=REQUESTED&limit=1"
        );
        if (isSubscribed && res.success && typeof res.pendingCount === "number") {
          setPendingBillCount(res.pendingCount);
        }
      } catch {
        // ignore
      }
    };

    fetchPendingCount();

    const socket = getSocket();
    if (socket) {
      const handleSync = () => fetchPendingCount();
      socket.on("bill:requested", handleSync);
      socket.on("bill:confirmed", handleSync);
      socket.on("bill:cancelled", handleSync);
      socket.on("order:billed", handleSync);

      return () => {
        isSubscribed = false;
        socket.off("bill:requested", handleSync);
        socket.off("bill:confirmed", handleSync);
        socket.off("bill:cancelled", handleSync);
        socket.off("order:billed", handleSync);
      };
    }
  }, []);

  const navItems = [
    { name: "Dashboard", href: "/restaurant/dashboard", icon: LayoutDashboard },
    { name: "POS Billing", href: "/restaurant/pos", icon: Receipt },
    { name: "Bills", href: "/restaurant/bills", icon: FileText, badge: pendingBillCount },
    { name: "Orders", href: "/restaurant/orders", icon: UtensilsCrossed },
    { name: "Tables", href: "/restaurant/tables", icon: Grid3X3 },
    { name: "Kitchen Display", href: "/restaurant/kitchen", icon: ChefHat },
    { name: "Menu Management", href: "/restaurant/menu", icon: BookOpen },
    { name: "Customers", href: "/restaurant/customers", icon: Users },
    { name: "Reports", href: "/restaurant/reports", icon: BarChart3 },
    { name: "Settings", href: "/restaurant/settings", icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen shrink-0 select-none">
      {/* Brand & Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-sm shadow-teal-500/20">
          <Store className="w-5 h-5" />
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="font-bold text-slate-900 text-sm tracking-tight truncate">
            {user?.restaurantName || "Restaurant POS"}
          </span>
          <span className="text-[11px] font-medium text-teal-600 truncate uppercase tracking-wider">
            SaaS Terminal
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = activePath === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                isActive
                  ? "bg-teal-50 text-teal-700 shadow-xs"
                  : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900"
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? "text-teal-600" : "text-slate-400 group-hover:text-slate-600"
                }`}
              />
              <span>{item.name}</span>
              {typeof item.badge === "number" && item.badge > 0 ? (
                <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse shadow-xs">
                  {item.badge}
                </span>
              ) : (
                isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-600" />
                )
              )}
            </Link>
          );
        })}
      </nav>

      {/* Staff User & Logout Footer */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-white border border-slate-200/60 shadow-xs mb-2">
          <div
            suppressHydrationWarning
            className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold shrink-0"
          >
            {mounted && user?.name ? user.name.slice(0, 2).toUpperCase() : <User className="w-4 h-4" />}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span suppressHydrationWarning className="text-xs font-semibold text-slate-800 truncate">
              {mounted && user?.name ? user.name : mounted && user?.email ? user.email : "Staff User"}
            </span>
            <span suppressHydrationWarning className="text-[10px] text-slate-500 truncate">
              {mounted && user?.role ? user.role.replace("_", " ") : "Terminal User"}
            </span>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
};

