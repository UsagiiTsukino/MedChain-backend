import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { User } from "../users/entities/user.entity";
import { Role } from "../roles/entities/role.entity";
import { BookingsService } from "../bookings/bookings.service";
import { Booking } from "../bookings/bookings.entity";
import { Vaccine } from "../vaccines/entities/vaccine.entity";
import { Center } from "../centers/entities/center.entity";
import { BookingPayment } from "../payments/entities/booking-payment.entity";
import { Appointment } from "../appointments/appointments.entity";
import { BlockchainModule } from "../blockchain/blockchain.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Role,
      Booking,
      Vaccine,
      Center,
      BookingPayment,
      Appointment,
    ]),
    BlockchainModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, BookingsService],
})
export class AuthModule {}
