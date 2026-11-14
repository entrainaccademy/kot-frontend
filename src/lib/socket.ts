import { io, Socket } from "socket.io-client";
import { getAccessToken } from "./apiClient";

let socketInstance: Socket | null = null;

const SOCKET_SERVER_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "https://kot-backend-za5d.onrender.com";

export const getSocket = (): Socket | null => {
  return socketInstance;
};

export const connectSocket = (): Socket | null => {
  if (typeof window === "undefined") return null;

  const token = getAccessToken();
  if (!token) return null;

  if (socketInstance && socketInstance.connected) {
    return socketInstance;
  }

  socketInstance = io(SOCKET_SERVER_URL, {
    auth: {
      token,
    },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socketInstance.on("connect", () => {
    console.log("Socket.IO connected to backend");
  });

  socketInstance.on("connect_error", (err) => {
    console.warn("Socket.IO connection warning:", err.message);
  });

  return socketInstance;
};

export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};

