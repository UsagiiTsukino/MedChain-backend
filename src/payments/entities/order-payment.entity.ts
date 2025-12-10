import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("order_payments")
export class OrderPayment {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Column({ type: "bigint", name: "order_id" })
  orderId!: string;

  @Column({ type: "varchar", length: 50 })
  method!: string;

  @Column({ type: "double" })
  amount!: number;

  @Column({ type: "varchar", length: 10, nullable: true })
  currency?: string | null;

  @Column({ type: "varchar", length: 50 })
  status!: string;

  @Column({ type: "datetime", name: "payment_date_time", nullable: true })
  paymentDateTime?: Date | null;

  @Column({
    type: "varchar",
    length: 255,
    name: "payment_hash",
    nullable: true,
  })
  paymentHash?: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
