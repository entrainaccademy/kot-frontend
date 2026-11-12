export interface MenuCategory {
  _id: string;
  restaurantId: string;
  name: string;
  description?: string;
  displayOrder?: number;
  isActive: boolean;
}

export interface MenuItem {
  _id: string;
  restaurantId: string;
  categoryId: any;
  name: string;
  description?: string;
  price: number;
  taxRate?: number;
  isAvailable?: boolean;
  availability?: boolean;
  isVeg?: boolean;
  isVegetarian?: boolean;
  image?: string;
}

export interface RestaurantTable {
  _id: string;
  restaurantId: string;
  tableNumber: string;
  capacity: number;
  floor: string;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "OUT_OF_SERVICE";
}

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  taxRate: number;
  notes?: string;
  itemTotal: number;
}

export type OrderType = "DINE_IN" | "TAKEAWAY" | "DELIVERY";

export interface ActiveOrder {
  _id?: string;
  orderNumber?: string;
  tableId?: string;
  tableNumber?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  orderType: OrderType;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  discountDetails?: {
    type: "PERCENTAGE" | "FIXED";
    value: number;
    amount: number;
    reason?: string;
  };
  serviceCharge?: number;
  deliveryCharge?: number;
  grandTotal: number;
  status?: string;
}

export interface InvoiceItemSnapshot {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  taxRate: number;
  itemTotal: number;
  discount?: number;
}

export interface TaxBreakdownItem {
  rate: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface TaxDetails {
  taxType: "INTRA_STATE" | "INTER_STATE";
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  breakdown: TaxBreakdownItem[];
}

export interface Invoice {
  _id: string;
  restaurantId: string;
  orderId: string;
  invoiceNumber: string;
  customerId?: string;
  customerSnapshot?: {
    name: string;
    phone?: string;
    email?: string;
    gstin?: string;
    address?: string;
  };
  restaurantSnapshot?: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    gstin?: string;
    currency?: string;
  };
  tableNumber?: string;
  orderType: OrderType;
  items: InvoiceItemSnapshot[];
  subtotal: number;
  tax: number;
  taxDetails: TaxDetails;
  discount: number;
  discountDetails?: {
    type: "PERCENTAGE" | "FIXED";
    value: number;
    amount: number;
    reason?: string;
  };
  serviceCharge: number;
  deliveryCharge: number;
  roundOff: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "REFUNDED" | "VOID";
  status: "DRAFT" | "ISSUED" | "VOID";
  issuedAt: string;
  createdAt: string;
}

export type PaymentMethod =
  | "CASH"
  | "UPI"
  | "CARD"
  | "NET_BANKING"
  | "WALLET"
  | "OTHER";

export interface PaymentRecord {
  _id: string;
  restaurantId: string;
  invoiceId: string;
  paymentNumber: string;
  amount: number;
  paymentMethod: PaymentMethod;
  transactionReference?: string;
  paymentStatus: "SUCCESS" | "PENDING" | "FAILED" | "REFUNDED";
  cashDetails?: {
    cashReceived: number;
    changeReturned: number;
  };
  refundStatus?: "NONE" | "PARTIAL" | "FULL";
  refundedAmount?: number;
  notes?: string;
  createdAt: string;
}

export interface ThermalReceiptData {
  invoice: Invoice;
  payments: PaymentRecord[];
  text58mm: string;
  text80mm: string;
  htmlReceipt: string;
}

