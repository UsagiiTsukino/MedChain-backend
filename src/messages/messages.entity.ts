import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "../users/entities/user.entity";
import { Appointment } from "../appointments/appointments.entity";

@Entity("messages")
export class Message {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "appointment_id", type: "bigint" })
  appointmentId!: string;

  @ManyToOne(() => Appointment, { nullable: false })
  @JoinColumn({ name: "appointment_id" })
  appointment!: Appointment;

  @Column({ name: "sender_id", type: "varchar", length: 255 })
  senderId!: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: "sender_id", referencedColumnName: "walletAddress" })
  sender!: User;

  @Column({ name: "receiver_id", type: "varchar", length: 255 })
  receiverId!: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: "receiver_id", referencedColumnName: "walletAddress" })
  receiver!: User;

  @Column({ type: "text" })
  content!: string;

  @Column({ name: "is_read", type: "boolean", default: false })
  isRead!: boolean;

  @Column({
    name: "message_type",
    type: "enum",
    enum: ["text", "image", "file"],
    default: "text",
  })
  messageType!: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
