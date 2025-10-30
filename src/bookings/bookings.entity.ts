import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Vaccine } from "../vaccines/entities/vaccine.entity";
import { Center } from "../centers/entities/center.entity";

@Entity("bookings")
export class Booking {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Vaccine, { nullable: true })
  vaccine?: Vaccine | null;

  @ManyToOne(() => Center, { nullable: true })
  center?: Center | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  time?: string | null;

  @Column({ type: "date", nullable: true })
  firstDoseDate?: string | null;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  amount?: string | null;

  @Column({ type: "json", nullable: true })
  doseSchedules?: any;

  @Column({ type: "varchar", length: 32, nullable: true })
  method?: string | null; // payment method

  @Column({ type: "varchar", length: 32, default: "PENDING" })
  status!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
