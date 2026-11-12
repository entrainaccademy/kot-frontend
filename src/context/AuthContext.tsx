"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { AuthUser, LoginResponse, StaffRole } from "../types/auth";
import { apiClient, setAccessToken, getAccessToken } from "../lib/apiClient";
import { connectSocket, disconnectSocket } from "../lib/socket";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; message?: string; user?: AuthUser }>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyRole: (roles: StaffRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = "kot_auth_user";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    // Immediately hydrate cached user from localStorage on client
    try {
      const saved = localStorage.getItem(USER_STORAGE_KEY);
      if (saved && isMounted) {
        setUser(JSON.parse(saved));
      }
    } catch {
      // ignore
    }

    const initAuth = async () => {
      const token = getAccessToken();
      if (!token) {
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      // If we restored user from localStorage, mark ready quickly
      if (isMounted) {
        setLoading(false);
      }

      try {
        const res = await apiClient.get<{ success: boolean; user?: AuthUser; data?: AuthUser }>("/auth/me");
        const currentUser = res.user || res.data;

        if (res.success && currentUser && isMounted) {
          setUser(currentUser);
          if (typeof window !== "undefined") {
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
          }
          connectSocket();
        } else if (isMounted) {
          setAccessToken(null);
          if (typeof window !== "undefined") {
            localStorage.removeItem(USER_STORAGE_KEY);
          }
          setUser(null);
        }
      } catch (err) {
        console.warn("Auth initialization error:", err);
        if (isMounted) {
          // Only invalidate token if it was explicitly a 401 Unauthorized
          const is401 = err instanceof Error && err.message.includes("401");
          if (is401) {
            setAccessToken(null);
            if (typeof window !== "undefined") {
              localStorage.removeItem(USER_STORAGE_KEY);
            }
            setUser(null);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, pass: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await apiClient.post<LoginResponse>("/auth/login", {
        email,
        password: pass,
      });

      if (res.success && res.accessToken && res.user) {
        setAccessToken(res.accessToken);
        setUser(res.user);
        if (typeof window !== "undefined") {
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.user));
        }
        connectSocket();
        return { success: true, user: res.user };
      }
      return { success: false, message: res.message || "Login failed" };
    } catch (err: any) {
      return { success: false, message: err.message || "An error occurred during login" };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // Continue client cleanup even if backend network fails
    } finally {
      setAccessToken(null);
      setUser(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem(USER_STORAGE_KEY);
      }
      disconnectSocket();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
    return user.permissions?.includes(permission) || false;
  };

  const hasAnyRole = (roles: StaffRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        hasPermission,
        hasAnyRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
