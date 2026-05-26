import { io } from "socket.io-client";
let socket = null;
export function getSocket() {
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
