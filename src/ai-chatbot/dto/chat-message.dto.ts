import { IsString, IsNotEmpty, IsOptional, IsObject } from "class-validator";

export class ChatMessageDto {
  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsOptional()
  @IsObject()
  context?: {
    userId?: string;
    sessionId?: string;
  };
}

export class ChatResponseDto {
  message!: string;
  hasBookingIntent?: boolean;
  suggestedBooking?: {
    vaccineId?: string;
    vaccineName?: string;
    centerId?: string;
    centerName?: string;
    date?: string;
    time?: string;
  };
  sessionId!: string;
}
