import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Vaccine } from "../vaccines/entities/vaccine.entity";
import { Center } from "../centers/entities/center.entity";
import { ChatMessageDto, ChatResponseDto } from "./dto/chat-message.dto";

@Injectable()
export class AiChatbotService {
  private genAI!: GoogleGenerativeAI;
  private model: any;
  private conversationHistory: Map<string, any[]> = new Map();

  constructor(
    @InjectRepository(Vaccine)
    private readonly vaccineRepo: Repository<Vaccine>,
    @InjectRepository(Center)
    private readonly centerRepo: Repository<Center>
  ) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY not found in environment variables");
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
      });
    }
  }

  async chat(
    chatDto: ChatMessageDto,
    userId?: string
  ): Promise<ChatResponseDto> {
    try {
      console.log("Chat request received:", chatDto);

      if (!this.model) {
        console.error("Gemini model not initialized");
        throw new HttpException(
          "Gemini API key is not configured",
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }

      const sessionId = chatDto.context?.sessionId || this.generateSessionId();
      console.log("Session ID:", sessionId);

      // Get context data
      const vaccines = await this.getAvailableVaccines();
      const centers = await this.getAvailableCenters();
      console.log(
        `Loaded ${vaccines.length} vaccines and ${centers.length} centers`
      );

      // Build system prompt with context
      const systemPrompt = this.buildSystemPrompt(vaccines, centers);

      // Get conversation history
      let history = this.conversationHistory.get(sessionId) || [];

      // Add user message to history
      history.push({
        role: "user",
        parts: [{ text: chatDto.message }],
      });

      // Start chat with history
      const chat = this.model.startChat({
        history: [
          {
            role: "user",
            parts: [{ text: systemPrompt }],
          },
          {
            role: "model",
            parts: [
              {
                text: "Tôi đã hiểu. Tôi sẽ giúp bạn tư vấn và hỗ trợ đặt lịch tiêm chủng. Hãy cho tôi biết bạn cần gì!",
              },
            ],
          },
          ...history.slice(0, -1), // Don't include the last message we just added
        ],
      });

      console.log("Sending message to Gemini...");
      const result = await chat.sendMessage(chatDto.message);
      const response = result.response;
      const responseText = response.text();
      console.log("Gemini response received:", responseText.substring(0, 100));

      // Add AI response to history
      history.push({
        role: "model",
        parts: [{ text: responseText }],
      });

      // Keep only last 10 messages
      if (history.length > 10) {
        history = history.slice(-10);
      }
      this.conversationHistory.set(sessionId, history);

      // Parse response for booking intent
      const bookingInfo = this.parseBookingIntent(
        responseText,
        vaccines,
        centers
      );

      return {
        message: responseText,
        sessionId,
        hasBookingIntent: bookingInfo.hasIntent,
        suggestedBooking: bookingInfo.hasIntent
          ? bookingInfo.booking
          : undefined,
      };
    } catch (error) {
      console.error("AI Chatbot error:", error);
      throw new HttpException(
        "Failed to process chat message",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private buildSystemPrompt(vaccines: any[], centers: any[]): string {
    const vaccineList = vaccines
      .map(
        (v) =>
          `- ${v.name}: ${v.manufacturer}, ${
            v.country
          }. Giá: ${v.price.toLocaleString("vi-VN")} VNĐ. ${v.description}`
      )
      .join("\n");

    const centerList = centers
      .map(
        (c) =>
          `- ${c.name}: ${c.address}. Giờ làm việc: ${c.workingHours}. SĐT: ${c.phoneNumber}`
      )
      .join("\n");

    return `Bạn là trợ lý AI tư vấn tiêm chủng vaccine thông minh của hệ thống VaxChain.

NHIỆM VỤ CỦA BẠN:
1. Tư vấn về các loại vaccine phù hợp với nhu cầu của người dùng
2. Giới thiệu các trung tâm tiêm chủng
3. Hỗ trợ đặt lịch tiêm chủng tự động
4. Trả lời các câu hỏi về vaccine, quy trình tiêm chủng

DANH SÁCH VACCINE HIỆN CÓ:
${vaccineList}

DANH SÁCH TRUNG TÂM TIÊM CHỦNG:
${centerList}

QUY TRÌNH ĐẶT LỊCH:
Khi người dùng muốn đặt lịch, hãy hỏi rõ:
1. Loại vaccine muốn tiêm
2. Ngày muốn đến (định dạng: DD/MM/YYYY)
3. Giờ muốn đến (định dạng: HH:mm)
4. Trung tâm muốn đến

Khi đã có đủ thông tin, hãy phản hồi theo format:
[ĐẶT_LỊCH]
Vaccine: [Tên vaccine]
Trung tâm: [Tên trung tâm]
Ngày: [DD/MM/YYYY]
Giờ: [HH:mm]
[/ĐẶT_LỊCH]

Sau đó nói: "Tôi sẽ giúp bạn đặt lịch. Vui lòng xác nhận thông tin trên."

LƯU Ý:
- Luôn thân thiện, nhiệt tình
- Giải thích rõ ràng về vaccine
- Đề xuất vaccine phù hợp dựa trên nhu cầu
- Nếu thiếu thông tin, hãy hỏi thêm
- Sử dụng tiếng Việt tự nhiên`;
  }

  private parseBookingIntent(
    responseText: string,
    vaccines: any[],
    centers: any[]
  ): { hasIntent: boolean; booking?: any } {
    const bookingMatch = responseText.match(
      /\[ĐẶT_LỊCH\]([\s\S]*?)\[\/ĐẶT_LỊCH\]/
    );

    if (!bookingMatch) {
      return { hasIntent: false };
    }

    const bookingText = bookingMatch[1];
    const vaccineMatch = bookingText.match(/Vaccine:\s*(.+)/);
    const centerMatch = bookingText.match(/Trung tâm:\s*(.+)/);
    const dateMatch = bookingText.match(/Ngày:\s*(\d{2}\/\d{2}\/\d{4})/);
    const timeMatch = bookingText.match(/Giờ:\s*(\d{2}:\d{2})/);

    if (!vaccineMatch || !centerMatch || !dateMatch || !timeMatch) {
      return { hasIntent: false };
    }

    const vaccineName = vaccineMatch[1].trim();
    const centerName = centerMatch[1].trim();
    const date = dateMatch[1];
    const time = timeMatch[1];

    // Find vaccine by name
    const vaccine = vaccines.find((v) =>
      v.name.toLowerCase().includes(vaccineName.toLowerCase())
    );

    // Find center by name
    const center = centers.find((c) =>
      c.name.toLowerCase().includes(centerName.toLowerCase())
    );

    // Convert date from DD/MM/YYYY to YYYY-MM-DD
    const [day, month, year] = date.split("/");
    const formattedDate = `${year}-${month}-${day}`;

    return {
      hasIntent: true,
      booking: {
        vaccineId: vaccine?.id,
        vaccineName: vaccine?.name || vaccineName,
        centerId: center?.id,
        centerName: center?.name || centerName,
        date: formattedDate,
        time: `${time}:00`,
      },
    };
  }

  private async getAvailableVaccines() {
    const vaccines = await this.vaccineRepo.find({
      where: { isDeleted: false },
      take: 50,
    });
    return vaccines;
  }

  private async getAvailableCenters() {
    const centers = await this.centerRepo.find({
      take: 50,
    });
    return centers;
  }

  async getContext() {
    const vaccines = await this.getAvailableVaccines();
    const centers = await this.getAvailableCenters();

    return {
      vaccines: vaccines.map((v) => ({
        id: v.id,
        name: v.name,
        manufacturer: v.manufacturer,
        country: v.country,
        price: v.price,
        description: v.description,
      })),
      centers: centers.map((c) => ({
        id: c.id,
        name: c.name,
        address: c.address,
        phoneNumber: c.phoneNumber,
        workingHours: c.workingHours,
      })),
    };
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  clearSession(sessionId: string): void {
    this.conversationHistory.delete(sessionId);
  }
}
