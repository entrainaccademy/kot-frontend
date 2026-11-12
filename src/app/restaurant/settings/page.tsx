"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { POSSidebar } from "../../../components/pos/POSSidebar";
import { useAuth } from "../../../context/AuthContext";
import { apiClient } from "../../../lib/apiClient";
import {
  Settings,
  Receipt,
  ArrowRight,
  Shield,
  Store,
  Printer,
  DollarSign,
  MapPin,
  CheckCircle2,
  Pencil,
  X,
  Loader2,
  Save,
  Phone,
  Mail,
  Percent,
  RefreshCw,
  AlertCircle,
  Building2,
} from "lucide-react";

export default function RestaurantSettingsPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"GENERAL" | "ADDRESS" | "TAX" | "RECEIPT">("GENERAL");

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    currency: "INR",
    timezone: "Asia/Kolkata",
    // Address
    street: "",
    city: "",
    state: "",
    postalCode: "",
    country: "India",
    // Tax Settings
    gstNumber: "",
    defaultTaxRate: 5,
    isTaxInclusive: false,
    // Receipt Settings
    headerText: "",
    footerText: "",
    showGst: true,
    showLogo: true,
  });

  // Toast Banner
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data?: any }>("/restaurant/profile");
      if (res.success && res.data) {
        setProfile(res.data);
        const d = res.data;
        setFormData({
          name: d.name || "",
          phone: d.phone || "",
          email: d.email || "",
          currency: d.currency || "INR",
          timezone: d.timezone || "Asia/Kolkata",
          street: d.address?.street || "",
          city: d.address?.city || "",
          state: d.address?.state || "",
          postalCode: d.address?.postalCode || "",
          country: d.address?.country || "India",
          gstNumber: d.taxSettings?.gstNumber || "",
          defaultTaxRate: d.taxSettings?.defaultTaxRate ?? 5,
          isTaxInclusive: d.taxSettings?.isTaxInclusive ?? false,
          headerText: d.receiptSettings?.headerText || "",
          footerText: d.receiptSettings?.footerText || "",
          showGst: d.receiptSettings?.showGst ?? true,
          showLogo: d.receiptSettings?.showLogo ?? true,
        });
      }
    } catch (err: any) {
      console.warn("Failed to load restaurant profile:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast("Restaurant name is required", "error");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        name: formData.name.trim(),
        phone: formData.phone.trim() || undefined,
        email: formData.email.trim() || undefined,
        currency: formData.currency,
        timezone: formData.timezone,
        address: {
          street: formData.street.trim() || undefined,
          city: formData.city.trim() || undefined,
          state: formData.state.trim() || undefined,
          postalCode: formData.postalCode.trim() || undefined,
          country: formData.country.trim() || "India",
        },
        taxSettings: {
          gstNumber: formData.gstNumber.trim() || undefined,
          defaultTaxRate: Number(formData.defaultTaxRate) || 0,
          isTaxInclusive: formData.isTaxInclusive,
        },
        receiptSettings: {
          headerText: formData.headerText.trim() || undefined,
          footerText: formData.footerText.trim() || undefined,
          showGst: formData.showGst,
          showLogo: formData.showLogo,
        },
      };

      const res = await apiClient.patch<{ success: boolean; data?: any; message?: string }>(
        "/restaurant/profile",
        payload
      );

      if (res.success && res.data) {
        setProfile(res.data);
        setIsEditing(false);
        showToast("Restaurant settings updated successfully!", "success");

        // Update cached restaurant name in localStorage so header & sidebar update
        if (typeof window !== "undefined") {
          try {
            const saved = localStorage.getItem("kot_auth_user");
            if (saved) {
              const parsed = JSON.parse(saved);
              parsed.restaurantName = res.data.name;
              localStorage.setItem("kot_auth_user", JSON.stringify(parsed));
            }
          } catch {}
        }
      }
    } catch (err: any) {
      showToast(err.message || "Failed to update restaurant settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const restaurantDisplayName = profile?.name || user?.restaurantName || "Cobolt Kitchen & Bar";
  const restaurantPhone = profile?.phone || "+91 98765 43210";
  const restaurantEmail = profile?.email || "billing@restaurant.com";
  const fullAddress = [
    profile?.address?.street,
    profile?.address?.city,
    profile?.address?.state,
    profile?.address?.postalCode,
  ]
    .filter(Boolean)
    .join(", ") || "Main Street, City Center, India";

  return (
    <div className="flex h-screen w-screen bg-slate-100 overflow-hidden font-sans">
      <div className="hidden lg:block shrink-0">
        <POSSidebar activePath="/restaurant/settings" />
      </div>

      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 h-full overflow-y-auto">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-700">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>POS & Restaurant Settings</span>
                {profile?.status && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                    {profile.status}
                  </span>
                )}
              </h1>
              <p className="text-[11px] text-slate-500">
                {restaurantDisplayName} • Store Profile, Taxation & Receipt Formatting
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Settings</span>
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(false)}
                className="py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
            )}

            <button
              onClick={loadProfile}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Reload settings"
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
        <div className="p-6 max-w-5xl mx-auto w-full space-y-6">
          {/* View Mode Cards */}
          {!isEditing ? (
            <div className="space-y-6">
              {/* Store Profile Card */}
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Store className="w-5 h-5 text-teal-600" />
                    <h2 className="text-sm font-extrabold text-slate-900">
                      Store & Contact Profile
                    </h2>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab("GENERAL");
                      setIsEditing(true);
                    }}
                    className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Edit Profile</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Restaurant Name
                    </span>
                    <span className="text-sm font-black text-slate-900">
                      {restaurantDisplayName}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Contact Phone
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {restaurantPhone}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Billing Email
                    </span>
                    <span className="text-xs font-bold text-slate-800 truncate block">
                      {restaurantEmail}
                    </span>
                  </div>
                </div>

                {/* Address block */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Store Address
                    </span>
                    <span className="text-xs font-semibold text-slate-800 mt-0.5 block">
                      {fullAddress}
                    </span>
                  </div>
                </div>
              </div>

              {/* GST Taxation & Billing Card */}
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    <h2 className="text-sm font-extrabold text-slate-900">
                      GST Taxation & Pricing Setup
                    </h2>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab("TAX");
                      setIsEditing(true);
                    }}
                    className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Edit GST</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      GSTIN / GST Number
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-900">
                      {profile?.taxSettings?.gstNumber || "Not Configured (Optional)"}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Default GST Tax Rate
                    </span>
                    <span className="text-sm font-extrabold text-slate-900">
                      {profile?.taxSettings?.defaultTaxRate ?? 5}% (CGST 2.5% + SGST 2.5%)
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Tax Pricing Model
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {profile?.taxSettings?.isTaxInclusive
                        ? "Tax Inclusive (Price includes GST)"
                        : "Tax Exclusive (GST added at bill)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Receipt & Thermal Printer Card */}
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Printer className="w-5 h-5 text-indigo-600" />
                    <h2 className="text-sm font-extrabold text-slate-900">
                      Thermal Receipt & Print Note
                    </h2>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab("RECEIPT");
                      setIsEditing(true);
                    }}
                    className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Edit Format</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Receipt Header Message
                    </span>
                    <p className="text-xs font-medium text-slate-700 italic">
                      &quot;{profile?.receiptSettings?.headerText || "Welcome to Cobolt Kitchen & Bar!"}&quot;
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Receipt Footer Message
                    </span>
                    <p className="text-xs font-medium text-slate-700 italic">
                      &quot;{profile?.receiptSettings?.footerText || "Thank you for dining with us! Please visit again."}&quot;
                    </p>
                  </div>
                </div>
              </div>

              {/* Role & Access Info */}
              <div className="p-4 rounded-2xl bg-slate-100/80 border border-slate-200/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <Shield className="w-4 h-4 text-amber-600" />
                  <span>Logged in as <strong>{user?.name || "Admin"}</strong> ({user?.role || "ADMIN"})</span>
                </div>
                <span className="text-slate-400 text-[11px]">Tenant ID: {user?.restaurantId || profile?._id}</span>
              </div>
            </div>
          ) : (
            /* Edit Mode Form */
            <form onSubmit={handleSaveChanges} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-teal-600" />
                    <span>Edit Restaurant Settings</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Modify store identity, address, tax rate, and thermal receipt print notes.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="py-1.5 px-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="py-1.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>

              {/* Sub-tabs for neat editing */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl w-fit text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("GENERAL")}
                  className={`py-1.5 px-3.5 rounded-xl font-bold transition-all cursor-pointer ${
                    activeTab === "GENERAL" ? "bg-white text-teal-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  General Profile
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("ADDRESS")}
                  className={`py-1.5 px-3.5 rounded-xl font-bold transition-all cursor-pointer ${
                    activeTab === "ADDRESS" ? "bg-white text-teal-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Address & Contact
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("TAX")}
                  className={`py-1.5 px-3.5 rounded-xl font-bold transition-all cursor-pointer ${
                    activeTab === "TAX" ? "bg-white text-teal-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  GST & Taxation
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("RECEIPT")}
                  className={`py-1.5 px-3.5 rounded-xl font-bold transition-all cursor-pointer ${
                    activeTab === "RECEIPT" ? "bg-white text-teal-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Receipt & Printers
                </button>
              </div>

              {/* Tab 1: GENERAL */}
              {activeTab === "GENERAL" && (
                <div className="space-y-4 text-xs animate-in fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Restaurant Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Cobolt Kitchen & Bar"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-900 outline-none focus:border-teal-500 focus:bg-white transition-all"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Currency
                      </label>
                      <select
                        value={formData.currency}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-900 outline-none focus:border-teal-500 focus:bg-white transition-all cursor-pointer"
                      >
                        <option value="INR">INR (₹) - Indian Rupee</option>
                        <option value="USD">USD ($) - US Dollar</option>
                        <option value="EUR">EUR (€) - Euro</option>
                        <option value="AED">AED (د.إ) - UAE Dirham</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Contact Phone
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="+91 98765 43210"
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-900 outline-none focus:border-teal-500 focus:bg-white transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Billing Email
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="billing@restaurant.com"
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-900 outline-none focus:border-teal-500 focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: ADDRESS */}
              {activeTab === "ADDRESS" && (
                <div className="space-y-4 text-xs animate-in fade-in">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Street Address
                    </label>
                    <input
                      type="text"
                      value={formData.street}
                      onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                      placeholder="e.g. 102 MG Road, Indiranagar"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-900 outline-none focus:border-teal-500 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">City</label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="e.g. Bangalore"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-900 outline-none focus:border-teal-500 focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">State</label>
                      <input
                        type="text"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        placeholder="e.g. Karnataka"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-900 outline-none focus:border-teal-500 focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Postal Code</label>
                      <input
                        type="text"
                        value={formData.postalCode}
                        onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                        placeholder="e.g. 560038"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-900 outline-none focus:border-teal-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: TAX */}
              {activeTab === "TAX" && (
                <div className="space-y-4 text-xs animate-in fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        GSTIN / GST Registration Number
                      </label>
                      <input
                        type="text"
                        value={formData.gstNumber}
                        onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
                        placeholder="e.g. 29AAPFU0939F1ZV"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900 outline-none focus:border-teal-500 focus:bg-white transition-all"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Default GST Tax Rate (%)
                      </label>
                      <div className="relative">
                        <Percent className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          value={formData.defaultTaxRate}
                          onChange={(e) => setFormData({ ...formData, defaultTaxRate: Number(e.target.value) })}
                          placeholder="5"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900 outline-none focus:border-teal-500 focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="font-bold text-slate-800 block">Pricing Calculation Mode:</span>
                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={formData.isTaxInclusive}
                        onChange={(e) => setFormData({ ...formData, isTaxInclusive: e.target.checked })}
                        className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                      />
                      <span>Item prices are tax-inclusive (GST is already included in dish prices)</span>
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Leave unchecked if prices are tax-exclusive (GST is added during invoice generation).
                    </p>
                  </div>
                </div>
              )}

              {/* Tab 4: RECEIPT */}
              {activeTab === "RECEIPT" && (
                <div className="space-y-4 text-xs animate-in fade-in">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Receipt Header Message
                    </label>
                    <input
                      type="text"
                      value={formData.headerText}
                      onChange={(e) => setFormData({ ...formData, headerText: e.target.value })}
                      placeholder="e.g. Welcome to Cobolt Kitchen & Bar!"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-900 outline-none focus:border-teal-500 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Receipt Footer Note / Greeting
                    </label>
                    <textarea
                      rows={2}
                      value={formData.footerText}
                      onChange={(e) => setFormData({ ...formData, footerText: e.target.value })}
                      placeholder="e.g. Thank you for dining with us! Please visit again."
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white transition-all resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <label className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                      <input
                        type="checkbox"
                        checked={formData.showGst}
                        onChange={(e) => setFormData({ ...formData, showGst: e.target.checked })}
                        className="w-4 h-4 rounded text-teal-600"
                      />
                      <span>Print GST Breakdown on Bills</span>
                    </label>

                    <label className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                      <input
                        type="checkbox"
                        checked={formData.showLogo}
                        onChange={(e) => setFormData({ ...formData, showLogo: e.target.checked })}
                        className="w-4 h-4 rounded text-teal-600"
                      />
                      <span>Display Restaurant Title on Thermal Print</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Form Bottom Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">
                  All changes take effect immediately across POS, KDS and Receipts.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="py-2 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="py-2 px-5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-bold transition-all animate-in slide-in-from-bottom-5 bg-slate-900 border-slate-700 text-white">
          {toast.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toast.type === "error" && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}