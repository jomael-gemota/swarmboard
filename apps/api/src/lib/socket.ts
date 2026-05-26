import { Server } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "@swarmboard/shared";
import type { Server as HttpServer } from "http";

let io: Server<ClientToServerEvents, ServerToClientEvents>;

export function createSocketServer(httpServer: HttpServer) {
  const allowedOrigins = (process.env.FRONTEND_URL ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    socket.on("board:join", (boardId) => {
      socket.join(`board:${boardId}`);
    });

    socket.on("board:leave", (boardId) => {
      socket.leave(`board:${boardId}`);
    });
  });

  return io;
}

export function getIO() {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

export function emitToBoard<E extends keyof ServerToClientEvents>(
  boardId: string,
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (getIO().to(`board:${boardId}`) as any).emit(event, ...args);
}
