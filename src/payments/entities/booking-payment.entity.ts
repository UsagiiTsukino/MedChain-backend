import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Booking } from "../../bookings/bookings.entity";

@Entity("booking_payments")
export class BookingPayment {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Column({ type: "bigint", name: "booking_id" })
  bookingId!: string;

  @ManyToOne(() => Booking, { nullable: false })
  @JoinColumn({ name: "booking_id" })
  booking!: Booking;

  @Column({ type: "varchar", length: 50 })
  method!: string; // CASH, METAMASK, PAYPAL, BANK_TRANSFER

  @Column({ type: "double" })
  amount!: number;

  @Column({ type: "varchar", length: 10, nullable: true })
  currency?: string | null; // VND, ETH, USD

  @Column({ type: "varchar", length: 50 })
  status!: string; // INITIATED, PROCESSING, SUCCESS, FAILED, COMPLETED

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
