import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Order } from "./orders.entity";
import { OrderItem } from "./order-item.entity";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { Vaccine } from "../vaccines/entities/vaccine.entity";
import { User } from "../users/entities/user.entity";
import { Payment } from "../payments/payments.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Vaccine, User, Payment]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [TypeOrmModule],
})
export class OrdersModule {}
