"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  MenuCategory,
  MenuItem,
  RestaurantTable,
  CartItem,
  OrderType,
  Invoice,
  PaymentRecord,
} from "../types/pos";
import { apiClient } from "../lib/apiClient";
import { getSocket } from "../lib/socket";
import { soundService } from "../lib/soundService";

interface DiscountState {
  type: "PERCENTAGE" | "FIXED";
  value: number;
  reason?: string;
}

interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface POSContextType {
  categories: MenuCategory[];
  selectedCategoryId: string;
  setSelectedCategoryId: (id: string) => void;
  menuItems: MenuItem[];
  filteredItems: MenuItem[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  tables: RestaurantTable[];
  selectedTable: RestaurantTable | null;
  setSelectedTable: (table: RestaurantTable | null) => void;
  orderType: OrderType;
  setOrderType: (type: OrderType) => void;
  customerName: string;
  setCustomerName: (name: string) => void;
  customerPhone: string;
  setCustomerPhone: (phone: string) => void;
  cart: CartItem[];
  addToCart: (item: MenuItem) => void;
  updateQuantity: (menuItemId: string, delta: number) => void;
  updateItemNotes: (menuItemId: string, notes: string) => void;
  removeFromCart: (menuItemId: string) => void;
  clearCart: () => void;
  discount: DiscountState | null;
  applyDiscount: (discount: DiscountState | null) => void;
  subtotal: number;
  estimatedTax: number;
  discountAmount: number;
  estimatedGrandTotal: number;
  activeOrderId: string | null;
  activeOrderNumber: string | null;
  activeInvoice: Invoice | null;
  setActiveInvoice: (invoice: Invoice | null) => void;
  loadingMenu: boolean;
  loadingTables: boolean;
  submittingOrder: boolean;
  generatingBill: boolean;
  toasts: ToastMessage[];
  addToast: (message: string, type?: "success" | "error" | "info") => void;
  removeToast: (id: string) => void;
  loadMenu: () => Promise<void>;
  loadTables: () => Promise<void>;
  submitOrderToKitchen: () => Promise<{ success: boolean; orderId?: string }>;
  generateBill: () => Promise<{ success: boolean; invoice?: Invoice }>;
  refreshActiveInvoice: () => Promise<void>;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

const CART_STORAGE_KEY = "kot_pos_active_cart";

export const POSProvider = ({ children }: { children: ReactNode }) => {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [orderType, setOrderType] = useState<OrderType>("DINE_IN");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(CART_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed.cart)) {
            const agg = new Map<string, CartItem>();
            parsed.cart.forEach((item: CartItem) => {
              const existing = agg.get(item.menuItemId);
              if (existing) {
                existing.quantity += item.quantity;
                existing.itemTotal = Math.round(existing.quantity * existing.price * 100) / 100;
              } else {
                agg.set(item.menuItemId, { ...item });
              }
            });
            return Array.from(agg.values());
          }
        }
      } catch {
        console.warn("Could not read cart from storage");
      }
    }
    return [];
  });
  const [discount, setDiscount] = useState<DiscountState | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(CART_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.activeOrderId) return parsed.activeOrderId;
        }
      } catch {}
    }
    return null;
  });
  const [activeOrderNumber, setActiveOrderNumber] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(CART_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.activeOrderNumber) return parsed.activeOrderNumber;
        }
      } catch {}
    }
    return null;
  });
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [loadingMenu, setLoadingMenu] = useState<boolean>(true);
  const [loadingTables, setLoadingTables] = useState<boolean>(true);
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [generatingBill, setGeneratingBill] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Save cart to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify({
          cart,
          orderType,
          selectedTable,
          activeOrderId,
          activeOrderNumber,
        })
      );
    } catch {
      console.warn("Failed to save cart to localStorage");
    }
  }, [cart, orderType, selectedTable, activeOrderId, activeOrderNumber]);

  // Load menu items & categories
  const loadMenu = useCallback(async () => {
    setLoadingMenu(true);
    try {
      const [catRes, itemRes] = await Promise.all([
        apiClient.get<{ success: boolean; data: MenuCategory[] }>("/restaurant/menu/categories"),
        apiClient.get<{ success: boolean; data: MenuItem[] }>("/restaurant/menu/items", { limit: 200 }),
      ]);

      if (catRes.success && Array.isArray(catRes.data)) {
        setCategories(catRes.data.filter((c) => c.isActive !== false));
      }
      if (itemRes.success && Array.isArray(itemRes.data)) {
        const normalized = itemRes.data.map((item: any) => {
          const catId =
            typeof item.categoryId === "object" && item.categoryId?._id
              ? String(item.categoryId._id)
              : String(item.categoryId || "");
          const isAvailable =
            item.availability !== undefined
              ? Boolean(item.availability)
              : item.isAvailable !== undefined
              ? Boolean(item.isAvailable)
              : true;
          const isVeg =
            item.isVegetarian !== undefined
              ? Boolean(item.isVegetarian)
              : item.isVeg !== undefined
              ? Boolean(item.isVeg)
              : true;

          return {
            ...item,
            categoryId: catId,
            isAvailable,
            availability: isAvailable,
            isVeg,
            isVegetarian: isVeg,
          };
        });
        setMenuItems(normalized);
      }
    } catch (err: any) {
      addToast(err.message || "Failed to load restaurant menu", "error");
    } finally {
      setLoadingMenu(false);
    }
  }, [addToast]);

  // Load tables
  const loadTables = useCallback(async () => {
    setLoadingTables(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: RestaurantTable[] }>("/restaurant/tables");
      if (res.success && Array.isArray(res.data)) {
        setTables(res.data);
      }
    } catch (err: any) {
      console.warn("Could not fetch tables:", err.message);
    } finally {
      setLoadingTables(false);
    }
  }, []);

  useEffect(() => {
    loadMenu();
    loadTables();
  }, [loadMenu, loadTables]);

  // Real-time socket event listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleTableReleased = (data: any) => {
      setTables((prev) =>
        prev.map((t) => (t._id === data.tableId ? { ...t, status: "AVAILABLE" } : t))
      );
    };

    const handleOrderCompleted = (data: any) => {
      if (data.orderId === activeOrderId) {
        addToast(`Order ${data.orderNumber || ""} completed & settled`, "success");
      }
    };

    const handlePaymentRefunded = (data: any) => {
      addToast(`Payment refunded: ₹${data.refundAmount}`, "info");
      if (activeInvoice && activeInvoice._id === data.invoice?._id) {
        setActiveInvoice((prev) => (prev ? { ...prev, ...data.invoice } : null));
      }
    };

    const handleFoodReady = (data: any) => {
      const orderNum = data.orderNumber || (data.order?.orderNumber) || "Order";
      const tableInfo = data.tableNumber || (data.order?.tableId?.tableNumber ? `Table ${data.order.tableId.tableNumber}` : "Dine-In");
      const eventKey = `food-ready:${data.kotId || data.orderId || orderNum}`;

      // Play pleasant two-tone "DING-DONG!" chime
      soundService.playFoodReady(eventKey);

      // Toast notification for Cashier & Waiter
      addToast(`🔔 Food Ready – ${orderNum} – ${tableInfo}`, "success");

      // Reload tables so live indicator updates
      loadTables();
    };

    socket.on("table:released", handleTableReleased);
    socket.on("order:completed", handleOrderCompleted);
    socket.on("payment:refunded", handlePaymentRefunded);
    socket.on("kitchen:order-ready", handleFoodReady);

    return () => {
      socket.off("table:released", handleTableReleased);
      socket.off("order:completed", handleOrderCompleted);
      socket.off("payment:refunded", handlePaymentRefunded);
      socket.off("kitchen:order-ready", handleFoodReady);
    };
  }, [activeOrderId, activeInvoice, addToast, loadTables]);

  // Cart operations
  const addToCart = (item: MenuItem) => {
    if (!item.isAvailable) {
      addToast(`${item.name} is currently out of stock`, "error");
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.menuItemId === item._id);
      if (existing) {
        return prev.map((i) =>
          i.menuItemId === item._id
            ? {
                ...i,
                quantity: i.quantity + 1,
                itemTotal: Math.round((i.quantity + 1) * i.price * 100) / 100,
              }
            : i
        );
      } else {
        return [
          ...prev,
          {
            menuItemId: item._id,
            name: item.name,
            price: item.price,
            quantity: 1,
            taxRate: item.taxRate ?? 5,
            itemTotal: item.price,
          },
        ];
      }
    });
  };

  const updateQuantity = (menuItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.menuItemId === menuItemId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return {
              ...item,
              quantity: newQty,
              itemTotal: Math.round(newQty * item.price * 100) / 100,
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const updateItemNotes = (menuItemId: string, notes: string) => {
    setCart((prev) =>
      prev.map((i) => (i.menuItemId === menuItemId ? { ...i, notes } : i))
    );
  };

  const removeFromCart = (menuItemId: string) => {
    setCart((prev) => prev.filter((i) => i.menuItemId !== menuItemId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(null);
    setActiveOrderId(null);
    setActiveOrderNumber(null);
    setActiveInvoice(null);
    setSelectedTable(null);
    setCustomerName("");
    setCustomerPhone("");
    localStorage.removeItem(CART_STORAGE_KEY);
  };

  const applyDiscount = (disc: DiscountState | null) => {
    setDiscount(disc);
  };

  // Filtered menu items by category and search
  const filteredItems = menuItems.filter((item) => {
    const itemCatId =
      typeof item.categoryId === "object" && item.categoryId?._id
        ? String(item.categoryId._id)
        : String(item.categoryId);
    const matchesCategory =
      selectedCategoryId === "all" || itemCatId === selectedCategoryId;
    const matchesSearch =
      !searchQuery.trim() ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Estimated Calculations
  const subtotal = Math.round(cart.reduce((sum, i) => sum + i.itemTotal, 0) * 100) / 100;

  let discountAmount = 0;
  if (discount) {
    if (discount.type === "PERCENTAGE") {
      discountAmount = Math.round((subtotal * (discount.value / 100)) * 100) / 100;
    } else {
      discountAmount = Math.min(discount.value, subtotal);
    }
  }

  const estimatedTax = Math.round(
    cart.reduce((sum, i) => sum + (i.itemTotal * (i.taxRate / 100)), 0) * 100
  ) / 100;

  const estimatedGrandTotal = Math.max(
    0,
    Math.round(subtotal + estimatedTax - discountAmount)
  );

  // Submit Order & Generate KOT
  const submitOrderToKitchen = async (): Promise<{ success: boolean; orderId?: string }> => {
    if (cart.length === 0) {
      addToast("Cart is empty", "error");
      return { success: false };
    }

    if (orderType === "DINE_IN" && !selectedTable) {
      addToast("Please select a table for Dine-in orders", "error");
      return { success: false };
    }

    setSubmittingOrder(true);
    try {
      let orderId = activeOrderId;
      let orderNum = activeOrderNumber;

      // 1. If activeOrderId is set, verify it is still open and not completed/billed
      if (orderId) {
        try {
          const existingOrder = await apiClient.get<{ success: boolean; data: any }>(
            `/restaurant/orders/${orderId}`
          );
          if (
            !existingOrder.success ||
            !existingOrder.data ||
            ["COMPLETED", "BILLED", "CANCELLED"].includes(existingOrder.data.status)
          ) {
            // Previous order already finished or invalid! Reset and create fresh order
            orderId = null;
            orderNum = null;
            setActiveOrderId(null);
            setActiveOrderNumber(null);
            setActiveInvoice(null);
          } else {
            // Active order exists! Append any new/current items in cart
            try {
              await apiClient.post(`/restaurant/orders/${orderId}/items`, {
                items: cart.map((i) => ({
                  menuItemId: i.menuItemId,
                  quantity: i.quantity,
                  notes: i.notes,
                })),
              });
            } catch {
              // Ignore if items are already present or partially submitted
            }
          }
        } catch {
          // If order not found, reset
          orderId = null;
          orderNum = null;
          setActiveOrderId(null);
          setActiveOrderNumber(null);
          setActiveInvoice(null);
        }
      }

      // 2. Create new order if none active
      if (!orderId) {
        const createPayload = {
          orderType,
          tableId: selectedTable?._id,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          items: cart.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            notes: i.notes,
          })),
          discount: discountAmount,
          idempotencyKey: `order-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        };

        const orderRes = await apiClient.post<{ success: boolean; data: any }>(
          "/restaurant/orders",
          createPayload
        );

        if (!orderRes.success || !orderRes.data) {
          throw new Error("Failed to create order");
        }

        orderId = orderRes.data._id;
        orderNum = orderRes.data.orderNumber;
        setActiveOrderId(orderId);
        setActiveOrderNumber(orderNum);
      }

      // 3. Generate KOT for the order
      try {
        const kotRes = await apiClient.post<{ success: boolean; data: any }>(
          `/restaurant/orders/${orderId}/kot`,
          {
            priority: "MEDIUM",
            idempotencyKey: `kot-${Date.now()}`,
          }
        );

        if (kotRes.success) {
          soundService.unlockAudio();
          soundService.playKitchenBell();
          addToast(
            `Order ${orderNum || ""} sent to kitchen! (KOT: ${kotRes.data?.kotNumber || ""})`,
            "success"
          );
          loadTables();
          return { success: true, orderId: orderId! };
        }
      } catch (kotErr: any) {
        // If KOT fails because order was already completed, automatically heal by resetting state
        if (
          kotErr.message &&
          (kotErr.message.includes("COMPLETED") ||
            kotErr.message.includes("BILLED") ||
            kotErr.message.includes("CANCELLED"))
        ) {
          setActiveOrderId(null);
          setActiveOrderNumber(null);
          setActiveInvoice(null);
          addToast("Previous order was completed. Creating fresh order...", "info");

          // Recursively re-run with fresh order
          const retryRes = await apiClient.post<{ success: boolean; data: any }>(
            "/restaurant/orders",
            {
              orderType,
              tableId: selectedTable?._id,
              customerName: customerName.trim() || undefined,
              customerPhone: customerPhone.trim() || undefined,
              items: cart.map((i) => ({
                menuItemId: i.menuItemId,
                quantity: i.quantity,
                notes: i.notes,
              })),
              discount: discountAmount,
              idempotencyKey: `order-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            }
          );
          if (retryRes.success && retryRes.data) {
            setActiveOrderId(retryRes.data._id);
            setActiveOrderNumber(retryRes.data.orderNumber);
            const retryKot = await apiClient.post<{ success: boolean; data: any }>(
              `/restaurant/orders/${retryRes.data._id}/kot`,
              { priority: "MEDIUM", idempotencyKey: `kot-${Date.now()}` }
            );
            if (retryKot.success) {
              addToast(
                `New order ${retryRes.data.orderNumber} sent to kitchen! (KOT: ${retryKot.data?.kotNumber || ""})`,
                "success"
              );
              loadTables();
              return { success: true, orderId: retryRes.data._id };
            }
          }
        }
        throw kotErr;
      }

      return { success: true, orderId: orderId! };
    } catch (err: any) {
      addToast(err.message || "Failed to submit order to kitchen", "error");
      return { success: false };
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Generate Bill (Invoice)
  const generateBill = async (): Promise<{ success: boolean; invoice?: Invoice }> => {
    if (!activeOrderId) {
      // Must submit order first
      const orderResult = await submitOrderToKitchen();
      if (!orderResult.success || !orderResult.orderId) {
        return { success: false };
      }
    }

    const orderIdToBill = activeOrderId;
    if (!orderIdToBill) return { success: false };

    setGeneratingBill(true);
    try {
      const invoicePayload: any = {
        orderId: orderIdToBill,
        idempotencyKey: `inv-${orderIdToBill}`,
      };

      if (discount) {
        invoicePayload.discount = {
          type: discount.type,
          value: discount.value,
          reason: discount.reason || "POS Discount",
        };
      }

      const invoiceRes = await apiClient.post<{ success: boolean; data: Invoice }>(
        "/restaurant/billing/invoices",
        invoicePayload
      );

      if (invoiceRes.success && invoiceRes.data) {
        setActiveInvoice(invoiceRes.data);
        addToast(
          `Invoice ${invoiceRes.data.invoiceNumber} generated! Total: ₹${invoiceRes.data.grandTotal}`,
          "success"
        );
        return { success: true, invoice: invoiceRes.data };
      }
      return { success: false };
    } catch (err: any) {
      addToast(err.message || "Failed to generate bill", "error");
      return { success: false };
    } finally {
      setGeneratingBill(false);
    }
  };

  const refreshActiveInvoice = async () => {
    if (!activeInvoice) return;
    try {
      const res = await apiClient.get<{ success: boolean; data: { invoice: Invoice; payments: PaymentRecord[] } }>(
        `/restaurant/billing/invoices/${activeInvoice._id}`
      );
      if (res.success && res.data?.invoice) {
        setActiveInvoice(res.data.invoice);
      }
    } catch (err) {
      console.warn("Could not refresh invoice:", err);
    }
  };

  return (
    <POSContext.Provider
      value={{
        categories,
        selectedCategoryId,
        setSelectedCategoryId,
        menuItems,
        filteredItems,
        searchQuery,
        setSearchQuery,
        tables,
        selectedTable,
        setSelectedTable,
        orderType,
        setOrderType,
        customerName,
        setCustomerName,
        customerPhone,
        setCustomerPhone,
        cart,
        addToCart,
        updateQuantity,
        updateItemNotes,
        removeFromCart,
        clearCart,
        discount,
        applyDiscount,
        subtotal,
        estimatedTax,
        discountAmount,
        estimatedGrandTotal,
        activeOrderId,
        activeOrderNumber,
        activeInvoice,
        setActiveInvoice,
        loadingMenu,
        loadingTables,
        submittingOrder,
        generatingBill,
        toasts,
        addToast,
        removeToast,
        loadMenu,
        loadTables,
        submitOrderToKitchen,
        generateBill,
        refreshActiveInvoice,
      }}
    >
      {children}
    </POSContext.Provider>
  );
};

export const usePOS = () => {
  const context = useContext(POSContext);
  if (!context) {
    throw new Error("usePOS must be used within a POSProvider");
  }
  return context;
};
