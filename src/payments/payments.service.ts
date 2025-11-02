import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Payment } from "./payments.entity";
import { Booking } from "../bookings/bookings.entity";
import { Order } from "../orders/orders.entity";

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>
  ) {}

  async updatePaymentPaypal(
    paymentId: string,
    bookingId?: string,
    orderId?: string
  ) {
    const payment = await this.paymentRepo.findOne({
      where: { id: BigInt(paymentId) as any },
    });
    if (!payment) throw new Error("Payment not found");

    if (orderId) {
      const order = await this.orderRepo.findOne({
        where: { orderId: BigInt(orderId) as any },
      });
      if (!order) throw new Error("Order not found");
      order.status = "PROCESSING";
      await this.orderRepo.save(order);
    } else if (bookingId) {
      const booking = await this.bookingRepo.findOne({
        where: { bookingId: BigInt(bookingId) as any },
      });
      if (!booking) throw new Error("Booking not found");
      booking.status = "CONFIRMED";
      await this.bookingRepo.save(booking);
    }

    payment.status = "SUCCESS";
    await this.paymentRepo.save(payment);
    return { success: true };
  }

  async updatePaymentMetaMask(paymentId: string, bookingId: string) {
    const booking = await this.bookingRepo.findOne({
      where: { bookingId: BigInt(bookingId) as any },
    });
    if (!booking) throw new Error("Booking not found");

    const payment = await this.paymentRepo.findOne({
      where: { id: BigInt(paymentId) as any },
    });
    if (!payment) throw new Error("Payment not found");

    booking.status = "CONFIRMED";
    payment.status = "SUCCESS";
    await this.bookingRepo.save(booking);
    await this.paymentRepo.save(payment);
    return { success: true };
  }
}
