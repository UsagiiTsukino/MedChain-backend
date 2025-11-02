import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { Payment } from "./payments.entity";
import { Booking } from "../bookings/bookings.entity";
import { Order } from "../orders/orders.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Booking, Order])],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
