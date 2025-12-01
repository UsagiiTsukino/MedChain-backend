import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AiChatbotController } from "./ai-chatbot.controller";
import { AiChatbotService } from "./ai-chatbot.service";
import { Vaccine } from "../vaccines/entities/vaccine.entity";
import { Center } from "../centers/entities/center.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Vaccine, Center])],
  controllers: [AiChatbotController],
  providers: [AiChatbotService],
  exports: [AiChatbotService],
})
export class AiChatbotModule {}
