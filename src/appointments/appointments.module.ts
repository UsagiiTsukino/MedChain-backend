import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppointmentsService } from "./appointments.service";
import { AppointmentsController } from "./appointments.controller";
import { Vaccine } from "../vaccines/entities/vaccine.entity";
import { Center } from "../centers/entities/center.entity";
import { Appointment } from "./appointments.entity";
import { User } from "../users/entities/user.entity";
import { Booking } from "../bookings/bookings.entity";
import { BlockchainModule } from "../blockchain/blockchain.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Vaccine, Center, Appointment, User, Booking]),
    BlockchainModule,
  ],
  providers: [AppointmentsService],
  controllers: [AppointmentsController],
})
export class AppointmentsModule {}
