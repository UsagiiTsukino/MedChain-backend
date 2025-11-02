import { Body, Controller, Get, Post, Session } from "@nestjs/common";
import { OrdersService } from "./orders.service";

@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async create(
    @Body()
    orderData: {
      items: Array<{ id: string; quantity: number }>;
      itemCount: number;
      totalAmount: number;
      paymentMethod: string;
    },
    @Session() session: Record<string, any>
  ) {
    const userWalletAddress = session?.walletAddress || session?.email;
    if (!userWalletAddress) throw new Error("User not authenticated");

    return this.ordersService.createOrder(orderData, userWalletAddress);
  }

  @Get()
  async list(@Session() session: Record<string, any>) {
    const userWalletAddress = session?.walletAddress || session?.email;
    if (!userWalletAddress) throw new Error("User not authenticated");

    return this.ordersService.getOrder(userWalletAddress);
  }
}
