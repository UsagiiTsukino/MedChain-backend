import { IsNotEmpty, IsString, IsOptional, IsEnum } from "class-validator";

export class CreateMessageDto {
  @IsNotEmpty()
  @IsString()
  appointmentId!: string;

  @IsNotEmpty()
  @IsString()
  receiverId!: string;

  @IsNotEmpty()
  @IsString()
  content!: string;

  @IsOptional()
  @IsEnum(["text", "image", "file"])
  messageType?: string;
}

export class GetMessagesDto {
  @IsNotEmpty()
  @IsString()
  appointmentId!: string;
}

export class MarkAsReadDto {
  @IsNotEmpty()
  @IsString()
  appointmentId!: string;

  @IsNotEmpty()
  @IsString()
  otherUserId!: string;
}
