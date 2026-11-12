"use client";

import React from "react";
import { MenuItem } from "../../types/pos";
import { usePOS } from "../../context/POSContext";
import { formatCurrency } from "../../lib/utils";
import { Plus, Check } from "lucide-react";

interface MenuItemCardProps {
  item: MenuItem;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({ item }) => {
  const { cart, addToCart } = usePOS();

  const isAvailable = item.isAvailable ?? item.availability ?? true;
  const isVeg = item.isVeg ?? item.isVegetarian ?? true;

  const cartItem = cart.find((i) => i.menuItemId === item._id);
  const cartQty = cartItem?.quantity || 0;

  return (
    <div
      onClick={() => isAvailable && addToCart(item)}
      className={`group relative bg-white border rounded-2xl p-3.5 flex flex-col justify-between transition-all duration-200 select-none ${
        !isAvailable
          ? "opacity-60 border-slate-200 cursor-not-allowed bg-slate-50/50"
          : "border-slate-200/80 hover:border-teal-500 hover:shadow-md hover:shadow-teal-500/5 cursor-pointer active:scale-[0.98]"
      }`}
    >
      {/* Top badges: Veg/Non-Veg & In-Cart count */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          {/* Veg/Non-veg symbol */}
          <div
            className={`w-4 h-4 border flex items-center justify-center rounded-sm ${
              isVeg
                ? "border-emerald-600"
                : "border-rose-600"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                isVeg ? "bg-emerald-600" : "bg-rose-600"
              }`}
            />
          </div>

          {!isAvailable && (
            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
              Sold Out
            </span>
          )}
        </div>

        {cartQty > 0 && (
          <span className="flex items-center gap-1 bg-teal-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-xs">
            <Check className="w-3 h-3" />
            {cartQty} in cart
          </span>
        )}
      </div>

      {/* Item Info */}
      <div className="flex-1 mb-3">
        <h3 className="font-bold text-slate-900 text-sm line-clamp-1 group-hover:text-teal-700 transition-colors">
          {item.name}
        </h3>
        {item.description ? (
          <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
            {item.description}
          </p>
        ) : (
          <span className="text-[11px] text-slate-400 italic">Chef&apos;s Special</span>
        )}
      </div>

      {/* Price & Action Button */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <span className="text-sm font-extrabold text-slate-900">
          {formatCurrency(item.price)}
        </span>

        <button
          disabled={!isAvailable}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            !isAvailable
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : cartQty > 0
              ? "bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100"
              : "bg-slate-900 text-white hover:bg-teal-600"
          }`}
        >
          <Plus className="w-3 h-3" />
          <span>{cartQty > 0 ? "Add +" : "Add"}</span>
        </button>
      </div>
    </div>
  );
};
