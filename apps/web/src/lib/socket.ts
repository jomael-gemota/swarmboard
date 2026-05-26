import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@swarmboard/shared";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!socket) {
    const url = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "/";
    socket = io(url, { withCredentials: true, transports: ["websocket", "polling"] });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
