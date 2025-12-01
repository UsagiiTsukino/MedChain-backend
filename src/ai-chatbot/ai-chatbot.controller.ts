import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  Delete,
  Param,
  UseGuards,
} from "@nestjs/common";
import { AiChatbotService } from "./ai-chatbot.service";
import { ChatMessageDto } from "./dto/chat-message.dto";

@Controller("ai-chatbot")
export class AiChatbotController {
  constructor(private readonly aiChatbotService: AiChatbotService) {}

  @Post("chat")
  async chat(@Body() chatDto: ChatMessageDto, @Req() req: any) {
    const userId = req.user?.id;
    return this.aiChatbotService.chat(chatDto, userId);
  }

  @Get("context")
  async getContext() {
    return this.aiChatbotService.getContext();
  }

  @Delete("session/:sessionId")
  clearSession(@Param("sessionId") sessionId: string) {
    this.aiChatbotService.clearSession(sessionId);
    return { message: "Session cleared successfully" };
  }
}
