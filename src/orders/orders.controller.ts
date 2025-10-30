import { Body, Controller, Get, Post } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Order } from "./orders.entity";

@Controller("orders")
export class OrdersController {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>
  ) {}

  @Post()
  async create(@Body() orderData: any) {
    const created = this.orderRepo.create({
      payload: orderData,
      status: "CREATED",
    });
    return this.orderRepo.save(created);
  }

  @Get()
  async list() {
    return this.orderRepo.find();
  }
}
