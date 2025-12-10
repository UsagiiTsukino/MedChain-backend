import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { BookingPayment } from "./entities/booking-payment.entity";
import { OrderPayment } from "./entities/order-payment.entity";
import { Booking } from "../bookings/bookings.entity";
import { Order } from "../orders/orders.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([BookingPayment, OrderPayment, Booking, Order]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [TypeOrmModule],
})
export class PaymentsModule {}
