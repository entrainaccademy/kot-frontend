export type StaffRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "MANAGER"
  | "CASHIER"
  | "WAITER"
  | "KITCHEN_STAFF";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: StaffRole;
  userType: "SuperAdmin" | "Staff";
  restaurantId?: string;
  restaurantName?: string;
  permissions: string[];
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  user: AuthUser;
  accessToken: string;
}

