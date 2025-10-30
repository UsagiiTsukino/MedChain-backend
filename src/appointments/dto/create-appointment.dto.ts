import { IsNotEmpty, IsString, IsDateString } from "class-validator";

export class CreateAppointmentDto {
  @IsNotEmpty()
  vaccineId!: string;

  @IsNotEmpty()
  centerId!: string;

  @IsDateString()
  @IsNotEmpty()
  date!: string; // YYYY-MM-DD

  @IsString()
  @IsNotEmpty()
  time!: string; // HH:mm:ss
}
