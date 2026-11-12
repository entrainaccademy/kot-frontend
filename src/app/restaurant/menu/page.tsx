"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { POSSidebar } from "../../../components/pos/POSSidebar";
import { useAuth } from "../../../context/AuthContext";
import { apiClient } from "../../../lib/apiClient";
import {
  BookOpen,
  Receipt,
  RefreshCw,
  ArrowRight,
  Search,
  CheckCircle,
  XCircle,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  UtensilsCrossed,
  Sparkles,
} from "lucide-react";

export default function MenuManagementPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "AVAILABLE" | "SOLD_OUT">("ALL");

  // Modal State for Add / Edit Dish
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    categoryId: "",
    price: "",
    description: "",
    isVegetarian: true,
    availability: true,
    taxRate: 5,
    preparationTime: 15,
  });

  // Quick Category Creation inside Modal
  const [isAddingNewCat, setIsAddingNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [creatingCatLoading, setCreatingCatLoading] = useState(false);

  // Toast Notification
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadMenu = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, itemRes] = await Promise.all([
        apiClient.get<{ success: boolean; data?: any[] }>("/restaurant/menu/categories"),
        apiClient.get<{ success: boolean; data?: any[] }>("/restaurant/menu/items", { limit: 100 }),
      ]);
      if (catRes.success && Array.isArray(catRes.data)) setCategories(catRes.data);
      if (itemRes.success && Array.isArray(itemRes.data)) setItems(itemRes.data);
    } catch {
      showToast("Failed to load menu items", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  // Open Modal in "Add New Dish" Mode
  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      categoryId: categories[0]?._id || "",
      price: "",
      description: "",
      isVegetarian: true,
      availability: true,
      taxRate: 5,
      preparationTime: 15,
    });
    setIsAddingNewCat(false);
    setIsModalOpen(true);
  };

  // Open Modal in "Edit Dish" Mode
  const handleOpenEditModal = (item: any) => {
    setEditingItem(item);
    const catId =
      typeof item.categoryId === "object" && item.categoryId?._id
        ? item.categoryId._id
        : item.categoryId || categories[0]?._id || "";

    setFormData({
      name: item.name || "",
      categoryId: String(catId),
      price: String(item.price ?? ""),
      description: item.description || "",
      isVegetarian:
        item.isVegetarian !== undefined
          ? item.isVegetarian
          : item.isVeg !== undefined
          ? item.isVeg
          : true,
      availability:
        item.availability !== undefined
          ? item.availability
          : item.isAvailable !== undefined
          ? item.isAvailable
          : true,
      taxRate: item.taxRate !== undefined ? item.taxRate : 5,
      preparationTime: item.preparationTime || 15,
    });
    setIsAddingNewCat(false);
    setIsModalOpen(true);
  };

  // Toggle Single Item Availability (Available <-> Sold Out)
  const toggleAvailability = async (item: any) => {
    const currentAvailability =
      item.availability !== undefined
        ? item.availability
        : item.isAvailable !== undefined
        ? item.isAvailable
        : true;
    const newStatus = !currentAvailability;

    setUpdatingId(item._id);
    try {
      const res = await apiClient.patch<{ success: boolean; data?: any }>(
        `/restaurant/menu/items/${item._id}`,
        { availability: newStatus }
      );
      if (res.success) {
        setItems((prev) =>
          prev.map((i) =>
            i._id === item._id
              ? { ...i, availability: newStatus, isAvailable: newStatus }
              : i
          )
        );
        showToast(
          `"${item.name}" is now ${newStatus ? "Available" : "Sold Out"}!`,
          newStatus ? "success" : "info"
        );
      }
    } catch (err: any) {
      showToast("Failed to update status: " + (err.message || "Unknown error"), "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // Quick Create New Category from Modal
  const handleCreateNewCategory = async () => {
    if (!newCatName.trim()) return;
    setCreatingCatLoading(true);
    try {
      const res = await apiClient.post<{ success: boolean; data?: any }>(
        "/restaurant/menu/categories",
        {
          name: newCatName.trim(),
          sortOrder: categories.length + 1,
        }
      );
      if (res.success && res.data) {
        setCategories((prev) => [...prev, res.data]);
        setFormData((prev) => ({ ...prev, categoryId: res.data._id }));
        setNewCatName("");
        setIsAddingNewCat(false);
        showToast(`Category "${res.data.name}" created!`, "success");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to create category", "error");
    } finally {
      setCreatingCatLoading(false);
    }
  };

  // Save Item (Create or Update)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast("Please enter a dish name", "error");
      return;
    }
    const priceNum = Number(formData.price);
    if (isNaN(priceNum) || priceNum < 0) {
      showToast("Please enter a valid price (₹0 or greater)", "error");
      return;
    }
    if (!formData.categoryId) {
      showToast("Please select a category for this dish", "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        categoryId: formData.categoryId,
        price: priceNum,
        description: formData.description.trim(),
        isVegetarian: formData.isVegetarian,
        availability: formData.availability,
        taxRate: Number(formData.taxRate) || 5,
        preparationTime: Number(formData.preparationTime) || 15,
      };

      if (editingItem) {
        // Edit existing item
        const res = await apiClient.patch<{ success: boolean; data?: any }>(
          `/restaurant/menu/items/${editingItem._id}`,
          payload
        );
        if (res.success && res.data) {
          setItems((prev) =>
            prev.map((i) => (i._id === editingItem._id ? { ...i, ...res.data } : i))
          );
          showToast(`"${payload.name}" updated successfully!`, "success");
          setIsModalOpen(false);
        }
      } else {
        // Create new item
        const res = await apiClient.post<{ success: boolean; data?: any }>(
          "/restaurant/menu/items",
          payload
        );
        if (res.success && res.data) {
          setItems((prev) => [res.data, ...prev]);
          showToast(`"${payload.name}" added to menu!`, "success");
          setIsModalOpen(false);
        }
      }
    } catch (err: any) {
      showToast(err.message || "Failed to save menu item", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Item
  const handleDeleteItem = async (item: any) => {
    if (!confirm(`Are you sure you want to remove "${item.name}" from the menu?`)) {
      return;
    }
    setUpdatingId(item._id);
    try {
      const res = await apiClient.delete<{ success: boolean; message?: string }>(
        `/restaurant/menu/items/${item._id}`
      );
      if (res.success) {
        setItems((prev) => prev.filter((i) => i._id !== item._id));
        showToast(`"${item.name}" removed from menu!`, "info");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to remove item", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // Filtering items by category, search text, and availability
  const filteredItems = items.filter((i) => {
    const itemCatId =
      typeof i.categoryId === "object" && i.categoryId?._id
        ? String(i.categoryId._id)
        : String(i.categoryId);
    const matchesCat = selectedCat === "all" || itemCatId === selectedCat;
    const matchesSearch =
      !search.trim() ||
      i.name?.toLowerCase().includes(search.toLowerCase()) ||
      i.description?.toLowerCase().includes(search.toLowerCase());

    const isAvail =
      i.availability !== undefined
        ? i.availability
        : i.isAvailable !== undefined
        ? i.isAvailable
        : true;

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "AVAILABLE" && isAvail) ||
      (statusFilter === "SOLD_OUT" && !isAvail);

    return matchesCat && matchesSearch && matchesStatus;
  });

  const availableCount = items.filter((i) =>
    i.availability !== undefined ? i.availability : i.isAvailable !== undefined ? i.isAvailable : true
  ).length;
  const soldOutCount = items.length - availableCount;

  return (
    <div className="flex h-screen w-screen bg-slate-100 overflow-hidden font-sans">
      <div className="hidden lg:block shrink-0">
        <POSSidebar activePath="/restaurant/menu" />
      </div>

      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 h-full overflow-y-auto">
        {/* Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-700">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Menu Management</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {items.length} items
                </span>
              </h1>
              <p className="text-[11px] text-slate-500">
                {user?.restaurantName || "Cobolt Kitchen & Bar"} • Add, Edit & Control Live Dish Availability
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Add New Dish Primary Button */}
            <button
              onClick={handleOpenAddModal}
              className="py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Dish</span>
            </button>

            <button
              onClick={loadMenu}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Refresh Menu"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-600" : ""}`} />
            </button>

            <Link
              href="/restaurant/pos"
              className="py-2 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all"
            >
              <Receipt className="w-4 h-4 text-teal-600" />
              <span>POS Billing</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-6 max-w-7xl mx-auto w-full space-y-5">
          {/* Top Info & Stats Banner */}
          <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span>Live Menu & Item Availability</span>
              </h3>
              <p className="text-[11px] text-teal-800 mt-0.5">
                Add new food items, update prices, or toggle between <strong>Available</strong> and <strong>Sold Out</strong>. Changes reflect instantly in POS Billing and KDS.
              </p>
            </div>

            {/* Quick Status Count Filters */}
            <div className="flex items-center gap-1.5 shrink-0 bg-white/80 p-1 rounded-xl border border-teal-200 text-xs">
              <button
                onClick={() => setStatusFilter("ALL")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  statusFilter === "ALL"
                    ? "bg-teal-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All ({items.length})
              </button>
              <button
                onClick={() => setStatusFilter("AVAILABLE")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                  statusFilter === "AVAILABLE"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "text-emerald-700 hover:text-emerald-800"
                }`}
              >
                <CheckCircle className="w-3 h-3" />
                <span>Available ({availableCount})</span>
              </button>
              <button
                onClick={() => setStatusFilter("SOLD_OUT")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                  statusFilter === "SOLD_OUT"
                    ? "bg-rose-600 text-white shadow-2xs"
                    : "text-rose-700 hover:text-rose-800"
                }`}
              >
                <XCircle className="w-3 h-3" />
                <span>Sold Out ({soldOutCount})</span>
              </button>
            </div>
          </div>

          {/* Categories Horizontal Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedCat("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                selectedCat === "all"
                  ? "bg-teal-600 text-white shadow-xs"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              All Items ({items.length})
            </button>
            {categories.map((c) => {
              const countInCat = items.filter((i) => {
                const catId =
                  typeof i.categoryId === "object" && i.categoryId?._id
                    ? String(i.categoryId._id)
                    : String(i.categoryId);
                return catId === c._id;
              }).length;

              return (
                <button
                  key={c._id}
                  onClick={() => setSelectedCat(c._id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                    selectedCat === c._id
                      ? "bg-teal-600 text-white shadow-xs"
                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>{c.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    selectedCat === c._id ? "bg-teal-700 text-teal-100" : "bg-slate-100 text-slate-500"
                  }`}>
                    {countInCat}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search and Action Bar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search food by name or ingredient..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500 focus:bg-white transition-all"
              />
            </div>
            <span className="text-xs font-bold text-slate-500 px-2 shrink-0">
              Showing {filteredItems.length} dishes
            </span>
          </div>

          {/* Menu Items Cards Grid */}
          {loading ? (
            <div className="py-24 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
              <span>Loading menu items...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-slate-300 rounded-3xl p-8 bg-white">
              <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-bold text-slate-700">No dishes match your filter</p>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Try clearing your search or add a new dish to this category.
              </p>
              <button
                onClick={handleOpenAddModal}
                className="py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add Dish Now</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredItems.map((item) => {
                const isAvail =
                  item.availability !== undefined
                    ? item.availability
                    : item.isAvailable !== undefined
                    ? item.isAvailable
                    : true;
                const isVeg =
                  item.isVegetarian !== undefined
                    ? item.isVegetarian
                    : item.isVeg !== undefined
                    ? item.isVeg
                    : true;
                const isUpdating = updatingId === item._id;

                return (
                  <div
                    key={item._id}
                    className={`bg-white border rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all hover:shadow-md ${
                      !isAvail ? "border-rose-200 bg-rose-50/15" : "border-slate-200/90"
                    }`}
                  >
                    <div>
                      {/* Card Header: Dish Name & Veg/Non-Veg Badge */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-xs font-extrabold text-slate-900 leading-tight">
                          {item.name}
                        </span>
                        <span
                          className={`w-4 h-4 rounded-sm flex items-center justify-center border text-[9px] font-bold shrink-0 ${
                            isVeg
                              ? "border-emerald-600 text-emerald-600 bg-emerald-50"
                              : "border-rose-600 text-rose-600 bg-rose-50"
                          }`}
                          title={isVeg ? "Vegetarian" : "Non-Vegetarian"}
                        >
                          ●
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-[11px] text-slate-500 line-clamp-2 min-h-[32px]">
                        {item.description || "Freshly prepared restaurant dish."}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2.5">
                      {/* Price and Availability Status */}
                      <div className="flex items-center justify-between">
                        <span className="text-base font-black text-slate-900 font-mono">
                          ₹{Number(item.price || 0).toFixed(2)}
                        </span>

                        {/* Interactive Availability Toggle (Available / Sold Out) */}
                        <button
                          onClick={() => toggleAvailability(item)}
                          disabled={isUpdating}
                          className={`py-1 px-2.5 rounded-xl text-[10px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                            isAvail
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                          }`}
                          title={isAvail ? "Click to mark as Sold Out" : "Click to mark as Available"}
                        >
                          {isUpdating ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : isAvail ? (
                            <>
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              <span>Available</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>Sold Out</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Actions: Edit & Delete */}
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-50">
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="flex-1 py-1.5 px-2 rounded-xl bg-slate-50 hover:bg-teal-50 hover:text-teal-700 text-slate-700 text-[11px] font-bold border border-slate-200/80 flex items-center justify-center gap-1 transition-all cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item)}
                          disabled={isUpdating}
                          className="p-1.5 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200/80 transition-all cursor-pointer"
                          title="Remove dish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-bold transition-all animate-in slide-in-from-bottom-5 bg-slate-900 border-slate-700 text-white">
          {toast.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toast.type === "error" && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
          {toast.type === "info" && <Sparkles className="w-4 h-4 text-teal-400 shrink-0" />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Add / Edit Menu Item Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-2xs animate-in fade-in">
          <div className="bg-white text-slate-900 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 font-extrabold">
                  {editingItem ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">
                    {editingItem ? "Edit Menu Dish" : "Add New Menu Dish"}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {editingItem ? "Update dish details, price, and category" : "Create a new dish for your restaurant menu"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmitForm} className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Dish Name */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Dish Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Paneer Butter Masala, Butter Chicken"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-800 outline-none focus:border-teal-500 focus:bg-white transition-all"
                />
              </div>

              {/* Category Selector + Quick Add Category */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  {!isAddingNewCat && (
                    <button
                      type="button"
                      onClick={() => setIsAddingNewCat(true)}
                      className="text-[11px] font-bold text-teal-600 hover:text-teal-700 flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>New Category</span>
                    </button>
                  )}
                </div>

                {isAddingNewCat ? (
                  <div className="p-2.5 rounded-xl bg-teal-50/70 border border-teal-200 space-y-2">
                    <span className="text-[11px] font-bold text-teal-900 block">
                      Create New Category:
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        placeholder="e.g. Chef Specials, Combos"
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-teal-300 text-xs font-semibold outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCreateNewCategory}
                        disabled={creatingCatLoading || !newCatName.trim()}
                        className="py-1.5 px-3 rounded-lg bg-teal-600 text-white font-bold hover:bg-teal-500 disabled:opacity-50 cursor-pointer"
                      >
                        {creatingCatLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingNewCat(false)}
                        className="py-1.5 px-2 rounded-lg bg-slate-200 text-slate-700 font-bold hover:bg-slate-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    required
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-800 outline-none focus:border-teal-500 focus:bg-white transition-all cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Price & Tax Rate */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Price (₹) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="e.g. 320.00"
                      className="w-full pl-7 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-800 outline-none focus:border-teal-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    GST Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={formData.taxRate}
                    onChange={(e) => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                    placeholder="5"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-800 outline-none focus:border-teal-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Food Type (Veg / Non-Veg) & Initial Availability */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Veg / Non-Veg */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    Food Type
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isVegetarian: true })}
                      className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        formData.isVegetarian
                          ? "bg-white text-emerald-700 shadow-2xs border border-emerald-200"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                      <span>Veg</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isVegetarian: false })}
                      className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        !formData.isVegetarian
                          ? "bg-white text-rose-700 shadow-2xs border border-rose-200"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                      <span>Non-Veg</span>
                    </button>
                  </div>
                </div>

                {/* Status: Available vs Sold Out */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    Availability Status
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, availability: true })}
                      className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        formData.availability
                          ? "bg-white text-emerald-700 shadow-2xs border border-emerald-200"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Available</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, availability: false })}
                      className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        !formData.availability
                          ? "bg-white text-rose-700 shadow-2xs border border-rose-200"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Sold Out</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Description / Ingredients (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Briefly describe the dish flavor, ingredients or portion size..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium text-slate-800 outline-none focus:border-teal-500 focus:bg-white transition-all resize-none"
                />
              </div>

              {/* Modal Footer Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-2 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="py-2 px-5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingItem ? "Save Changes" : "Create Dish"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}