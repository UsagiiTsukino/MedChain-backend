import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Booking } from "./bookings.entity";
import { BookingsController } from "./bookings.controller";
import { Vaccine } from "../vaccines/entities/vaccine.entity";
import { Center } from "../centers/entities/center.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Vaccine, Center])],
  controllers: [BookingsController],
  exports: [TypeOrmModule],
})
export class BookingsModule {}
