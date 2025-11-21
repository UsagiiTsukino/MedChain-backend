import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Booking } from "../bookings/bookings.entity";
import { Center } from "../centers/entities/center.entity";
import { User } from "../users/entities/user.entity";

@Entity("appointments")
export class Appointment {
  @PrimaryGeneratedColumn({ type: "bigint", name: "appointment_id" })
  appointmentId!: string;

  @Column({ type: "bigint", name: "booking_id" })
  bookingId!: string;

  @ManyToOne(() => Booking, { nullable: false })
  @JoinColumn({ name: "booking_id" })
  booking!: Booking;

  @Column({ type: "bigint", name: "center_id" })
  centerId!: string;

  @ManyToOne(() => Center, { nullable: false })
  @JoinColumn({ name: "center_id" })
  center!: Center;

  @Column({ type: "int", name: "dose_number" })
  doseNumber!: number;

  @Column({ type: "date", name: "appointment_date" })
  appointmentDate!: string;

  @Column({ type: "varchar", length: 10, name: "appointment_time" })
  appointmentTime!: string;

  @Column({ type: "varchar", length: 50 })
  status!: string; // SCHEDULED, COMPLETED, CANCELLED, RESCHEDULED

  @Column({ type: "varchar", length: 255, name: "doctor_id", nullable: true })
  doctorId?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "doctor_id", referencedColumnName: "walletAddress" })
  doctor?: User;

  @Column({ type: "text", nullable: true })
  notes?: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
