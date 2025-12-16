import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";

@WebSocketGateway({
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  },
  namespace: "/chat",
})
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private logger = new Logger("MessagesGateway");
  private userSockets = new Map<string, string>(); // walletAddress -> socketId

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Remove user from userSockets map
    for (const [walletAddress, socketId] of this.userSockets.entries()) {
      if (socketId === client.id) {
        this.userSockets.delete(walletAddress);
        this.logger.log(`Removed user ${walletAddress} from socket map`);
        break;
      }
    }
  }

  @SubscribeMessage("register")
  handleRegister(
    @MessageBody() data: { walletAddress: string },
    @ConnectedSocket() client: Socket
  ) {
    const { walletAddress } = data;
    this.userSockets.set(walletAddress, client.id);
    this.logger.log(
      `User ${walletAddress} registered with socket ${client.id}`
    );
    return { success: true };
  }

  @SubscribeMessage("joinAppointment")
  handleJoinAppointment(
    @MessageBody() data: { appointmentId: string },
    @ConnectedSocket() client: Socket
  ) {
    const { appointmentId } = data;
    const roomName = `appointment_${appointmentId}`;
    client.join(roomName);
    this.logger.log(`Client ${client.id} joined room ${roomName}`);
    return { success: true, room: roomName };
  }

  @SubscribeMessage("leaveAppointment")
  handleLeaveAppointment(
    @MessageBody() data: { appointmentId: string },
    @ConnectedSocket() client: Socket
  ) {
    const { appointmentId } = data;
    const roomName = `appointment_${appointmentId}`;
    client.leave(roomName);
    this.logger.log(`Client ${client.id} left room ${roomName}`);
    return { success: true };
  }

  // Emit new message to all users in the appointment room
  emitNewMessage(appointmentId: string, message: any) {
    const roomName = `appointment_${appointmentId}`;
    this.logger.log(`Emitting message to room ${roomName}`);
    this.server.to(roomName).emit("newMessage", message);
  }

  // Emit message read notification
  emitMessagesRead(appointmentId: string, readerId: string) {
    const roomName = `appointment_${appointmentId}`;
    this.logger.log(`Emitting messages read to room ${roomName}`);
    this.server.to(roomName).emit("messagesRead", { readerId });
  }

  // Send notification to specific user
  notifyUser(walletAddress: string, event: string, data: any) {
    const socketId = this.userSockets.get(walletAddress);
    if (socketId) {
      this.logger.log(`Sending ${event} to user ${walletAddress}`);
      this.server.to(socketId).emit(event, data);
    } else {
      this.logger.warn(`User ${walletAddress} not connected`);
    }
  }
}
