import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Booking } from "./bookings.entity";
import { BookingsController } from "./bookings.controller";
import { BookingsService } from "./bookings.service";
import { Vaccine } from "../vaccines/entities/vaccine.entity";
import { Center } from "../centers/entities/center.entity";
import { User } from "../users/entities/user.entity";
import { BookingPayment } from "../payments/entities/booking-payment.entity";
import { Appointment } from "../appointments/appointments.entity";
import { BlockchainModule } from "../blockchain/blockchain.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      Vaccine,
      Center,
      User,
      BookingPayment,
      Appointment,
    ]),
    BlockchainModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [TypeOrmModule],
})
export class BookingsModule {}
