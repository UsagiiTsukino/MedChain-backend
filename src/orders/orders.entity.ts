import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "../users/entities/user.entity";
import { OrderItem } from "./order-item.entity";

@Entity("orders")
export class Order {
  @PrimaryGeneratedColumn({ type: "bigint", name: "order_id" })
  orderId!: string;

  @Column({ type: "varchar", length: 255, name: "user_id" })
  userId!: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: "user_id", referencedColumnName: "walletAddress" })
  user!: User;

  @Column({ type: "double", name: "total_amount" })
  totalAmount!: number;

  @Column({ type: "int", name: "item_count" })
  itemCount!: number;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  orderItems!: OrderItem[];

  @Column({ type: "datetime", name: "order_date" })
  orderDate!: Date;

  @Column({ type: "varchar", length: 50 })
  status!: string; // PENDING, PROCESSING, COMPLETED, CANCELLED

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
