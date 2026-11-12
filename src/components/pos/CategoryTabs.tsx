"use client";

import React from "react";
import { usePOS } from "../../context/POSContext";
import { Utensils } from "lucide-react";

export const CategoryTabs: React.FC = () => {
  const { categories, selectedCategoryId, setSelectedCategoryId, menuItems } = usePOS();

  const getCategoryCount = (catId: string) => {
    if (catId === "all") return menuItems.length;
    return menuItems.filter((item) => {
      const itemCatId =
        typeof item.categoryId === "object" && item.categoryId?._id
          ? String(item.categoryId._id)
          : String(item.categoryId);
      return itemCatId === catId;
    }).length;
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none select-none">
      <button
        onClick={() => setSelectedCategoryId("all")}
        className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 flex items-center gap-2 border ${
          selectedCategoryId === "all"
            ? "bg-teal-600 border-teal-600 text-white shadow-sm shadow-teal-500/20"
            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
        }`}
      >
        <Utensils className="w-3.5 h-3.5" />
        <span>All Items</span>
        <span
          className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
            selectedCategoryId === "all"
              ? "bg-white/20 text-white"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {getCategoryCount("all")}
        </span>
      </button>

      {categories.map((cat) => {
        const isSelected = selectedCategoryId === cat._id;
        const count = getCategoryCount(cat._id);

        return (
          <button
            key={cat._id}
            onClick={() => setSelectedCategoryId(cat._id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 flex items-center gap-2 border ${
              isSelected
                ? "bg-teal-600 border-teal-600 text-white shadow-sm shadow-teal-500/20"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
            }`}
          >
            <span>{cat.name}</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
};

