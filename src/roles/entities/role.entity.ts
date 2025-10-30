import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("roles")
export class Role {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;
}
