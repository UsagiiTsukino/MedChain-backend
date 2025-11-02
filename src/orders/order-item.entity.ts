import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Order } from "./orders.entity";
import { Vaccine } from "../vaccines/entities/vaccine.entity";

@Entity("order_items")
export class OrderItem {
  @PrimaryGeneratedColumn({ type: "int" })
  id!: number;

  @Column({ type: "int" })
  quantity!: number;

  @Column({ type: "bigint", name: "order_id" })
  orderId!: string;

  @ManyToOne(() => Order, (order) => order.orderItems, { nullable: false })
  @JoinColumn({ name: "order_id" })
  order!: Order;

  @Column({ type: "bigint", name: "vaccine_id" })
  vaccineId!: string;

  @ManyToOne(() => Vaccine, { nullable: false })
  @JoinColumn({ name: "vaccine_id" })
  vaccine!: Vaccine;
}
