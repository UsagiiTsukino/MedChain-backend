import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("centers")
export class Center {
  @PrimaryGeneratedColumn({ type: "bigint", name: "center_id" })
  id!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 255 })
  address!: string;

  @Column({ type: "int" })
  capacity!: number;

  @Column({
    type: "varchar",
    length: 255,
    name: "phone_number",
    nullable: true,
  })
  phoneNumber?: string | null;

  @Column({ type: "varchar", length: 255, name: "working_hours" })
  workingHours!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  image?: string | null;
}
