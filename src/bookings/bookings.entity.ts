import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Vaccine } from "../vaccines/entities/vaccine.entity";
import { User } from "../users/entities/user.entity";
import { Center } from "../centers/entities/center.entity";

@Entity("bookings")
export class Booking {
  @PrimaryGeneratedColumn({ type: "bigint", name: "booking_id" })
  bookingId!: string;

  @Column({ type: "varchar", length: 255, name: "patient_id" })
  patientId!: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: "patient_id", referencedColumnName: "walletAddress" })
  patient!: User;

  @Column({ type: "bigint", name: "family_member_id", nullable: true })
  familyMemberId?: string | null;

  @Column({ type: "bigint", name: "vaccine_id" })
  vaccineId!: string;

  @ManyToOne(() => Vaccine, { nullable: false })
  @JoinColumn({ name: "vaccine_id" })
  vaccine!: Vaccine;

  @Column({ type: "bigint", name: "center_id" })
  centerId!: string;

  @ManyToOne(() => Center, { nullable: false })
  @JoinColumn({ name: "center_id" })
  center!: Center;

  @Column({ type: "date", name: "first_dose_date" })
  firstDoseDate!: string;

  @Column({ type: "varchar", length: 10, name: "first_dose_time" })
  firstDoseTime!: string;

  @Column({ type: "int", name: "total_doses" })
  totalDoses!: number;

  @Column({ type: "varchar", length: 50, name: "overall_status" })
  overallStatus!: string; // PROGRESS, COMPLETED

  @Column({ type: "double", name: "total_amount" })
  totalAmount!: number;

  @Column({ type: "varchar", length: 50 })
  status!: string; // PENDING, CONFIRMED, CANCELLED

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
