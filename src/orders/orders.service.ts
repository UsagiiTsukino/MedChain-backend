import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Order } from "./orders.entity";
import { OrderItem } from "./order-item.entity";
import { Vaccine } from "../vaccines/entities/vaccine.entity";
import { User } from "../users/entities/user.entity";
import { OrderPayment } from "../payments/entities/order-payment.entity";

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Vaccine)
    private readonly vaccineRepo: Repository<Vaccine>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(OrderPayment)
    private readonly orderPaymentRepo: Repository<OrderPayment>
  ) {}

  async createOrder(
    request: {
      items: Array<{ id: string; quantity: number }>;
      itemCount: number;
      totalAmount: number;
      paymentMethod: string;
    },
    userWalletAddress: string
  ) {
    const user = await this.userRepo
      .createQueryBuilder("user")
      .where("user.walletAddress COLLATE utf8mb4_general_ci = :walletAddress", {
        walletAddress: userWalletAddress,
      })
      .getOne();
    if (!user) throw new Error("User not found");

    const order = new Order();
    order.user = user;
    order.totalAmount = request.totalAmount;
    order.itemCount = request.itemCount;
    order.status = "PENDING";
    order.orderDate = new Date();

    const orderItems: OrderItem[] = [];
    for (const item of request.items) {
      const vaccine = await this.vaccineRepo.findOne({
        where: { id: BigInt(item.id) as any },
      });
      if (!vaccine) throw new Error(`Vaccine ${item.id} not found`);

      const orderItem = new OrderItem();
      orderItem.quantity = item.quantity;
      orderItem.vaccine = vaccine;
      orderItem.order = order;
      orderItems.push(orderItem);
    }

    order.orderItems = orderItems;
    const saved = await this.orderRepo.save(order);

    // Create payment
    const payment = new OrderPayment();
    payment.orderId = saved.orderId;
    payment.method = request.paymentMethod;
    payment.amount = request.totalAmount;
    payment.currency = request.paymentMethod === "PAYPAL" ? "USD" : "VND";
    payment.status = "INITIATED";

    if (request.paymentMethod === "PAYPAL") {
      payment.amount = request.totalAmount * 0.000041;
    } else if (request.paymentMethod === "METAMASK") {
      payment.amount = request.totalAmount / 200000.0;
      payment.currency = "ETH";
    }

    const savedPayment = await this.orderPaymentRepo.save(payment);

    return {
      referenceId: saved.orderId,
      paymentId: savedPayment.id,
      method: payment.method,
      amount: payment.amount,
      paymentURL:
        request.paymentMethod === "PAYPAL" ? "http://paypal.com/..." : null,
    };
  }

  async getOrder(userWalletAddress: string) {
    const items = await this.orderRepo
      .createQueryBuilder("order")
      .leftJoinAndSelect(
        User,
        "user",
        "user.walletAddress COLLATE utf8mb4_general_ci = order.userId COLLATE utf8mb4_general_ci"
      )
      .leftJoinAndSelect("order.orderItems", "orderItems")
      .leftJoinAndSelect("orderItems.vaccine", "vaccine")
      .where("user.walletAddress COLLATE utf8mb4_general_ci = :walletAddress", {
        walletAddress: userWalletAddress,
      })
      .getMany();

    return items.map((order) => ({
      orderId: order.orderId,
      orderDate: order.orderDate.toISOString().split("T")[0],
      itemCount: order.itemCount,
      total: order.totalAmount,
      status: order.status,
    }));
  }
}
