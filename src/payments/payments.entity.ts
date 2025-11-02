import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("payments")
export class Payment {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Column({ type: "bigint", name: "reference_id", nullable: true })
  referenceId?: string | null;

  @Column({
    type: "varchar",
    length: 50,
    name: "reference_type",
    nullable: true,
  })
  referenceType?: string | null; // BOOKING, ORDER

  @Column({ type: "varchar", length: 50 })
  method!: string; // PAYPAL, METAMASK, CASH

  @Column({ type: "double" })
  amount!: number;

  @Column({ type: "varchar", length: 10, nullable: true })
  currency?: string | null;

  @Column({ type: "varchar", length: 50 })
  status!: string; // INITIATED, PROCESSING, SUCCESS, FAILED

  // Legacy fields from SQL
  @Column({
    type: "varchar",
    length: 255,
    name: "appointment_hash",
    nullable: true,
  })
  appointmentHash?: string | null;

  @Column({ type: "datetime", name: "payment_date_time", nullable: true })
  paymentDateTime?: Date | null;

  @Column({
    type: "varchar",
    length: 255,
    name: "payment_hash",
    nullable: true,
  })
  paymentHash?: string | null;
}
