import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Message } from "./messages.entity";
import { Appointment } from "../appointments/appointments.entity";
import { User } from "../users/entities/user.entity";
import { Role } from "../roles/entities/role.entity";
import { CreateMessageDto } from "./dto/create-message.dto";
import { MessagesGateway } from "./messages.gateway";

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @Inject(forwardRef(() => MessagesGateway))
    private readonly messagesGateway: MessagesGateway
  ) {}

  // Helper function to get role name from roleId
  private async getRoleName(
    roleId: string | null | undefined
  ): Promise<string | null> {
    if (!roleId) return null;
    const role = await this.roleRepo
      .createQueryBuilder("role")
      .where("role.id = :id", { id: roleId.toString() })
      .getOne();
    return role?.name || null;
  }

  /**
   * Send a message between patient and doctor
   */
  async sendMessage(
    createMessageDto: CreateMessageDto,
    senderWalletAddress: string
  ) {
    const { appointmentId, receiverId, content, messageType } =
      createMessageDto;

    console.log("[MessagesService] sendMessage called");
    console.log("[MessagesService] Params:", {
      appointmentId,
      receiverId,
      senderWalletAddress,
    });

    // Verify appointment exists - convert string to bigint for query
    const appointment = await this.appointmentRepo.findOne({
      where: { appointmentId: appointmentId },
      relations: ["booking"],
    });

    console.log(
      "[MessagesService] Appointment found:",
      appointment ? appointment.appointmentId : "NOT FOUND"
    );

    if (!appointment) {
      console.error("[MessagesService] Appointment not found:", appointmentId);
      throw new NotFoundException(`Appointment ${appointmentId} not found`);
    }

    // Verify sender has permission (must be patient or assigned doctor)
    const isPatient = appointment.booking?.patientId === senderWalletAddress;
    const isDoctor = appointment.doctorId === senderWalletAddress;

    console.log("[MessagesService] Permission check:", {
      patientId: appointment.booking?.patientId,
      doctorId: appointment.doctorId,
      senderWalletAddress,
      isPatient,
      isDoctor,
    });

    if (!isPatient && !isDoctor) {
      console.error(
        "[MessagesService] Permission denied for sender:",
        senderWalletAddress
      );
      throw new ForbiddenException(
        "You don't have permission to send messages for this appointment"
      );
    }

    // Verify receiver
    console.log("[MessagesService] Looking for receiver:", receiverId);
    const receiver = await this.userRepo
      .createQueryBuilder("user")
      .where("user.walletAddress COLLATE utf8mb4_general_ci = :walletAddress", {
        walletAddress: receiverId,
      })
      .getOne();

    if (!receiver) {
      console.error("[MessagesService] Receiver not found:", receiverId);
      throw new NotFoundException(`Receiver ${receiverId} not found`);
    }

    console.log("[MessagesService] Receiver found:", receiver.walletAddress);

    // Create message
    const message = this.messageRepo.create({
      appointmentId,
      senderId: senderWalletAddress,
      receiverId,
      content,
      messageType: messageType || "text",
      isRead: false,
    });

    const savedMessage = await this.messageRepo.save(message);

    // Load sender info for response
    const sender = await this.userRepo
      .createQueryBuilder("user")
      .where("user.walletAddress COLLATE utf8mb4_general_ci = :walletAddress", {
        walletAddress: senderWalletAddress,
      })
      .getOne();

    const senderRole = await this.getRoleName(sender?.roleId);
    const receiverRole = await this.getRoleName(receiver.roleId);

    const messageWithDetails = {
      ...savedMessage,
      sender: {
        walletAddress: sender?.walletAddress,
        fullName: sender?.fullName,
        role: senderRole,
      },
      receiver: {
        walletAddress: receiver.walletAddress,
        fullName: receiver.fullName,
        role: receiverRole,
      },
    };

    // Emit realtime event via WebSocket to appointment room
    this.messagesGateway.emitNewMessage(appointmentId, messageWithDetails);

    // Also notify receiver directly if they're online
    this.messagesGateway.notifyUser(receiverId, "newMessageNotification", {
      appointmentId,
      message: messageWithDetails,
      from: sender?.fullName || "Người dùng",
    });

    return messageWithDetails;
  }

  /**
   * Get all messages for an appointment
   */
  async getMessagesByAppointment(
    appointmentId: string,
    userWalletAddress: string
  ) {
    this.logger.log(
      `[getMessagesByAppointment] Loading messages for appointment ${appointmentId}, user: ${userWalletAddress}`
    );

    // Verify appointment exists and user has permission
    const appointment = await this.appointmentRepo.findOne({
      where: { appointmentId },
      relations: ["booking"],
    });

    if (!appointment) {
      this.logger.error(
        `[getMessagesByAppointment] Appointment ${appointmentId} not found`
      );
      throw new NotFoundException(`Appointment ${appointmentId} not found`);
    }

    const isPatient = appointment.booking?.patientId === userWalletAddress;
    const isDoctor = appointment.doctorId === userWalletAddress;

    this.logger.log(
      `[getMessagesByAppointment] Permission check - isPatient: ${isPatient}, isDoctor: ${isDoctor}`
    );

    if (!isPatient && !isDoctor) {
      this.logger.error(
        `[getMessagesByAppointment] Permission denied for user ${userWalletAddress}`
      );
      throw new ForbiddenException(
        "You don't have permission to view messages for this appointment"
      );
    }

    // Get messages
    const messages = await this.messageRepo.find({
      where: { appointmentId },
      order: { createdAt: "ASC" },
    });

    this.logger.log(
      `[getMessagesByAppointment] Found ${messages.length} messages in database`
    );

    // Load sender and receiver info for each message
    const enrichedMessages = await Promise.all(
      messages.map(async (message) => {
        const sender = await this.userRepo
          .createQueryBuilder("user")
          .where(
            "user.walletAddress COLLATE utf8mb4_general_ci = :walletAddress",
            { walletAddress: message.senderId }
          )
          .getOne();

        const receiver = await this.userRepo
          .createQueryBuilder("user")
          .where(
            "user.walletAddress COLLATE utf8mb4_general_ci = :walletAddress",
            { walletAddress: message.receiverId }
          )
          .getOne();

        const senderRole = await this.getRoleName(sender?.roleId);
        const receiverRole = await this.getRoleName(receiver?.roleId);

        return {
          id: message.id,
          appointmentId: message.appointmentId,
          content: message.content,
          messageType: message.messageType,
          isRead: message.isRead,
          createdAt: message.createdAt,
          sender: {
            walletAddress: sender?.walletAddress,
            fullName: sender?.fullName,
            role: senderRole,
          },
          receiver: {
            walletAddress: receiver?.walletAddress,
            fullName: receiver?.fullName,
            role: receiverRole,
          },
        };
      })
    );

    this.logger.log(
      `[getMessagesByAppointment] Returning ${enrichedMessages.length} enriched messages`
    );

    return enrichedMessages;
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(
    appointmentId: string,
    userWalletAddress: string,
    otherUserId: string
  ) {
    // Mark all messages from otherUserId to userWalletAddress as read
    await this.messageRepo
      .createQueryBuilder()
      .update(Message)
      .set({ isRead: true })
      .where("appointmentId = :appointmentId", { appointmentId })
      .andWhere("senderId = :senderId", { senderId: otherUserId })
      .andWhere("receiverId = :receiverId", {
        receiverId: userWalletAddress,
      })
      .andWhere("isRead = :isRead", { isRead: false })
      .execute();

    // Emit realtime event via WebSocket
    this.messagesGateway.emitMessagesRead(appointmentId, userWalletAddress);

    return { message: "Messages marked as read" };
  }

  /**
   * Get unread message count for a user across all appointments
   */
  async getUnreadCount(userWalletAddress: string) {
    const count = await this.messageRepo.count({
      where: {
        receiverId: userWalletAddress,
        isRead: false,
      },
    });

    return { unreadCount: count };
  }

  /**
   * Get unread count for specific appointment
   */
  async getUnreadCountByAppointment(
    appointmentId: string,
    userWalletAddress: string
  ) {
    const count = await this.messageRepo.count({
      where: {
        appointmentId,
        receiverId: userWalletAddress,
        isRead: false,
      },
    });

    return { unreadCount: count };
  }

  /**
   * Get conversations list for a user (appointments with messages)
   */
  async getConversations(userWalletAddress: string) {
    const user = await this.userRepo
      .createQueryBuilder("user")
      .where("user.walletAddress COLLATE utf8mb4_general_ci = :walletAddress", {
        walletAddress: userWalletAddress,
      })
      .getOne();

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Get all messages where user is sender or receiver
    const messages = await this.messageRepo
      .createQueryBuilder("message")
      .where("message.senderId = :userId OR message.receiverId = :userId", {
        userId: userWalletAddress,
      })
      .orderBy("message.createdAt", "DESC")
      .getMany();

    // Group by appointment and get latest message for each
    const appointmentMap = new Map();
    for (const message of messages) {
      if (!appointmentMap.has(message.appointmentId)) {
        appointmentMap.set(message.appointmentId, message);
      }
    }

    // Load appointment details and count unread
    const conversations = await Promise.all(
      Array.from(appointmentMap.values()).map(async (lastMessage) => {
        const appointment = await this.appointmentRepo.findOne({
          where: { appointmentId: lastMessage.appointmentId },
          relations: ["booking", "booking.patient", "booking.vaccine"],
        });

        if (!appointment) return null;

        // Get other user (if current user is patient, get doctor; if doctor, get patient)
        const otherUserId =
          lastMessage.senderId === userWalletAddress
            ? lastMessage.receiverId
            : lastMessage.senderId;

        const otherUser = await this.userRepo
          .createQueryBuilder("user")
          .where(
            "user.walletAddress COLLATE utf8mb4_general_ci = :walletAddress",
            { walletAddress: otherUserId }
          )
          .getOne();

        // Count unread messages from other user
        const unreadCount = await this.messageRepo.count({
          where: {
            appointmentId: lastMessage.appointmentId,
            senderId: otherUserId,
            receiverId: userWalletAddress,
            isRead: false,
          },
        });

        const otherUserRole = await this.getRoleName(otherUser?.roleId);

        return {
          appointmentId: appointment.appointmentId,
          doseNumber: appointment.doseNumber,
          appointmentDate: appointment.appointmentDate,
          appointmentTime: appointment.appointmentTime,
          vaccine: appointment.booking?.vaccine,
          otherUser: {
            walletAddress: otherUser?.walletAddress,
            fullName: otherUser?.fullName,
            role: otherUserRole,
          },
          lastMessage: {
            content: lastMessage.content,
            createdAt: lastMessage.createdAt,
            senderId: lastMessage.senderId,
          },
          unreadCount,
        };
      })
    );

    return conversations.filter((c) => c !== null);
  }
}
