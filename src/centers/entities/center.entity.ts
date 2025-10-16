import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("centers")
export class Center {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  address?: string | null;
}
