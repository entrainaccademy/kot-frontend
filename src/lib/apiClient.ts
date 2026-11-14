const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://kot-backend-za5d.onrender.com/api";

let inMemoryToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  inMemoryToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem("kot_access_token", token);
    } else {
      localStorage.removeItem("kot_access_token");
    }
  }
};

export const getAccessToken = (): string | null => {
  if (inMemoryToken) return inMemoryToken;
  if (typeof window !== "undefined") {
    inMemoryToken = localStorage.getItem("kot_access_token");
  }
  return inMemoryToken;
};

interface RequestOptions extends RequestInit {
  params?: Record<string, any>;
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

const addRefreshSubscriber = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  let url = `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  if (options.params) {
    const query = new URLSearchParams();
    Object.entries(options.params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        query.append(key, String(val));
      }
    });
    const queryString = query.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: "include", // For HttpOnly refresh token cookie
  };

  const response = await fetch(url, config);

  // If 401 Unauthorized, attempt refresh
  if (response.status === 401 && !endpoint.includes("/auth/refresh") && !endpoint.includes("/auth/login")) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const newToken = refreshData.accessToken;
          setAccessToken(newToken);
          isRefreshing = false;
          onRefreshed(newToken);

          // Retry original request with new token
          headers["Authorization"] = `Bearer ${newToken}`;
          const retryRes = await fetch(url, { ...config, headers });
          if (!retryRes.ok) {
            const err = await retryRes.json().catch(() => ({}));
            throw new Error(err.message || `Request failed with status ${retryRes.status}`);
          }
          return retryRes.json();
        } else {
          setAccessToken(null);
          isRefreshing = false;
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
          throw new Error("Session expired. Please log in again.");
        }
      } catch (err) {
        setAccessToken(null);
        isRefreshing = false;
        throw err;
      }
    } else {
      // Wait for existing refresh to complete
      return new Promise<T>((resolve, reject) => {
        addRefreshSubscriber(async (newToken: string) => {
          try {
            headers["Authorization"] = `Bearer ${newToken}`;
            const retryRes = await fetch(url, { ...config, headers });
            if (!retryRes.ok) {
              const err = await retryRes.json().catch(() => ({}));
              reject(new Error(err.message || `Request failed with status ${retryRes.status}`));
              return;
            }
            resolve(await retryRes.json());
          } catch (e) {
            reject(e);
          }
        });
      });
    }
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message || `HTTP error ${response.status}`);
  }

  // Handle binary/blob responses (like PDF)
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/pdf")) {
    return (await response.blob()) as unknown as T;
  }

  return response.json();
}

export const apiClient = {
  get: <T = any>(endpoint: string, params?: Record<string, any>) =>
    apiRequest<T>(endpoint, { method: "GET", params }),

  post: <T = any>(endpoint: string, body?: any) =>
    apiRequest<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T = any>(endpoint: string, body?: any) =>
    apiRequest<T>(endpoint, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = any>(endpoint: string) =>
    apiRequest<T>(endpoint, { method: "DELETE" }),
};

