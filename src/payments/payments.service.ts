import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BookingPayment } from "./entities/booking-payment.entity";
import { OrderPayment } from "./entities/order-payment.entity";
import { Booking } from "../bookings/bookings.entity";
import { Order } from "../orders/orders.entity";

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(BookingPayment)
    private readonly bookingPaymentRepo: Repository<BookingPayment>,
    @InjectRepository(OrderPayment)
    private readonly orderPaymentRepo: Repository<OrderPayment>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>
  ) {}

  async updatePaymentPaypal(
    paymentId: string,
    bookingId?: string,
    orderId?: string
  ) {
    if (orderId) {
      const payment = await this.orderPaymentRepo.findOne({
        where: { id: BigInt(paymentId) as any },
      });
      if (!payment) throw new Error("Payment not found");

      const order = await this.orderRepo.findOne({
        where: { orderId: BigInt(orderId) as any },
      });
      if (!order) throw new Error("Order not found");

      order.status = "PROCESSING";
      payment.status = "SUCCESS";

      await this.orderRepo.save(order);
      await this.orderPaymentRepo.save(payment);
    } else if (bookingId) {
      const payment = await this.bookingPaymentRepo.findOne({
        where: { id: BigInt(paymentId) as any },
      });
      if (!payment) throw new Error("Payment not found");

      const booking = await this.bookingRepo.findOne({
        where: { bookingId: BigInt(bookingId) as any },
      });
      if (!booking) throw new Error("Booking not found");

      booking.status = "CONFIRMED";
      payment.status = "SUCCESS";

      await this.bookingRepo.save(booking);
      await this.bookingPaymentRepo.save(payment);
    }

    return { success: true };
  }

  async updatePaymentMetaMask(paymentId: string, bookingId: string) {
    const booking = await this.bookingRepo.findOne({
      where: { bookingId: BigInt(bookingId) as any },
    });
    if (!booking) throw new Error("Booking not found");

    const payment = await this.bookingPaymentRepo.findOne({
      where: { id: BigInt(paymentId) as any },
    });
    if (!payment) throw new Error("Payment not found");

    booking.status = "CONFIRMED";
    payment.status = "SUCCESS";

    await this.bookingRepo.save(booking);
    await this.bookingPaymentRepo.save(payment);

    return { success: true };
  }
}
