import { Entity, PrimaryColumn, Column } from "typeorm";
import { Center } from "../../centers/entities/center.entity";
import { Role } from "../../roles/entities/role.entity";

@Entity("users")
export class User {
  @PrimaryColumn({ type: "varchar", length: 255, name: "wallet_address" })
  walletAddress!: string;

  @Column({ type: "bigint", name: "center_id", nullable: true })
  centerId?: string | null;

  @Column({ type: "bigint", name: "role_id", nullable: true })
  roleId?: string | null;

  @Column({ type: "varchar", length: 255, name: "fullname", nullable: true })
  fullName?: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  email?: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  password?: string | null;

  @Column({ type: "text", name: "refresh_token", nullable: true })
  refreshToken?: string | null;

  @Column({ type: "varchar", length: 512, nullable: true })
  avatar?: string | null;

  @Column({
    type: "varchar",
    length: 255,
    name: "phone_number",
    nullable: true,
  })
  phoneNumber?: string | null;

  @Column({ type: "date", nullable: true })
  birthday?: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  address?: string | null;

  @Column({ type: "bit", name: "is_deleted", default: false })
  isDeleted!: boolean;
}
