import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  Session,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { MessagesService } from "./messages.service";
import { CreateMessageDto } from "./dto/create-message.dto";

@Controller("messages")
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  /**
   * Send a message
   * POST /messages
   */
  @Post()
  async sendMessage(
    @Body() createMessageDto: CreateMessageDto,
    @Session() session: Record<string, any>
  ) {
    console.log("[MessagesController] sendMessage called");
    console.log("[MessagesController] Session:", {
      walletAddress: session?.walletAddress,
      email: session?.email,
    });
    console.log("[MessagesController] DTO:", createMessageDto);

    const senderWalletAddress = session?.walletAddress || session?.email;

    if (!senderWalletAddress) {
      console.error("[MessagesController] No sender wallet address in session");
      throw new HttpException(
        "User not authenticated",
        HttpStatus.UNAUTHORIZED
      );
    }

    try {
      const result = await this.messagesService.sendMessage(
        createMessageDto,
        senderWalletAddress
      );
      console.log("[MessagesController] Message sent successfully:", result.id);
      return result;
    } catch (error) {
      console.error("[MessagesController] Error sending message:", error);
      throw error;
    }
  }

  /**
   * Get messages for an appointment
   * GET /messages/appointment/:appointmentId
   */
  @Get("appointment/:appointmentId")
  async getMessagesByAppointment(
    @Param("appointmentId") appointmentId: string,
    @Session() session: Record<string, any>
  ) {
    console.log(
      "[MessagesController] getMessagesByAppointment called for:",
      appointmentId
    );
    console.log("[MessagesController] Session:", {
      walletAddress: session?.walletAddress,
      email: session?.email,
    });

    const userWalletAddress = session?.walletAddress || session?.email;

    if (!userWalletAddress) {
      console.error("[MessagesController] No user wallet address in session");
      throw new HttpException(
        "User not authenticated",
        HttpStatus.UNAUTHORIZED
      );
    }

    try {
      const messages = await this.messagesService.getMessagesByAppointment(
        appointmentId,
        userWalletAddress
      );
      console.log(`[MessagesController] Returning ${messages.length} messages`);
      return messages;
    } catch (error) {
      console.error("[MessagesController] Error getting messages:", error);
      throw error;
    }
  }

  /**
   * Mark messages as read
   * PUT /messages/appointment/:appointmentId/read
   */
  @Put("appointment/:appointmentId/read")
  async markAsRead(
    @Param("appointmentId") appointmentId: string,
    @Query("otherUserId") otherUserId: string,
    @Session() session: Record<string, any>
  ) {
    const userWalletAddress = session?.walletAddress || session?.email;

    if (!userWalletAddress) {
      throw new HttpException(
        "User not authenticated",
        HttpStatus.UNAUTHORIZED
      );
    }

    return this.messagesService.markMessagesAsRead(
      appointmentId,
      userWalletAddress,
      otherUserId
    );
  }

  /**
   * Get unread message count
   * GET /messages/unread-count
   */
  @Get("unread-count")
  async getUnreadCount(@Session() session: Record<string, any>) {
    const userWalletAddress = session?.walletAddress || session?.email;

    if (!userWalletAddress) {
      throw new HttpException(
        "User not authenticated",
        HttpStatus.UNAUTHORIZED
      );
    }

    return this.messagesService.getUnreadCount(userWalletAddress);
  }

  /**
   * Get unread count for specific appointment
   * GET /messages/appointment/:appointmentId/unread-count
   */
  @Get("appointment/:appointmentId/unread-count")
  async getUnreadCountByAppointment(
    @Param("appointmentId") appointmentId: string,
    @Session() session: Record<string, any>
  ) {
    const userWalletAddress = session?.walletAddress || session?.email;

    if (!userWalletAddress) {
      throw new HttpException(
        "User not authenticated",
        HttpStatus.UNAUTHORIZED
      );
    }

    return this.messagesService.getUnreadCountByAppointment(
      appointmentId,
      userWalletAddress
    );
  }

  /**
   * Get all conversations for a user
   * GET /messages/conversations
   */
  @Get("conversations")
  async getConversations(@Session() session: Record<string, any>) {
    const userWalletAddress = session?.walletAddress || session?.email;

    if (!userWalletAddress) {
      throw new HttpException(
        "User not authenticated",
        HttpStatus.UNAUTHORIZED
      );
    }

    return this.messagesService.getConversations(userWalletAddress);
  }
}
