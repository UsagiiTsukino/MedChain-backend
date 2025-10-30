import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("permissions")
export class Permission {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 255 })
  method!: string; // GET/POST/PUT/DELETE/PATCH

  @Column({ type: "varchar", length: 255, name: "api_path" })
  apiPath!: string;

  @Column({ type: "varchar", length: 255 })
  module!: string;
}
