import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("vaccines")
export class Vaccine {
  @PrimaryGeneratedColumn({ type: "bigint", name: "vaccine_id" })
  id!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 64 })
  country!: string;

  @Column({ type: "varchar", length: 255 })
  description!: string;

  @Column({ type: "varchar", length: 255 })
  disease!: string;

  @Column({ type: "int" })
  dosage!: number;

  @Column({ type: "varchar", length: 255 })
  efficacy!: string;

  @Column({ type: "bit", name: "is_deleted" })
  isDeleted!: boolean;

  @Column({ type: "varchar", length: 255 })
  manufacturer!: string;

  @Column({ type: "varchar", length: 255 })
  price!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  schedule?: string | null;

  @Column({ type: "int", name: "stock_quantity" })
  stockQuantity!: number;

  @Column({ type: "varchar", length: 255 })
  target!: string;
}
