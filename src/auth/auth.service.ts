import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../users/entities/user.entity";
import { Role } from "../roles/entities/role.entity";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>
  ) {}

  // Helper function to get role name from roleId
  private async getRoleName(
    roleId: string | null | undefined
  ): Promise<string | null> {
    if (!roleId) return null;
    // Use QueryBuilder to avoid collation issues
    const role = await this.roleRepo
      .createQueryBuilder("role")
      .where("role.id = :id", { id: roleId.toString() })
      .getOne();
    return role?.name || null;
  }

  async register(dto: {
    fullName?: string;
    email?: string;
    password?: string;
    walletAddress?: string;
  }) {
    console.log("[AuthService] Register called with:", {
      ...dto,
      password: dto.password ? "***" : undefined,
    });

    let user: User | null = null;

    if (dto.email) {
      user = await this.usersRepo
        .createQueryBuilder("user")
        .where("user.email COLLATE utf8mb4_general_ci = :email", {
          email: dto.email,
        })
        .getOne();
      if (user) {
        throw new HttpException("Email already exists", HttpStatus.BAD_REQUEST);
      }
    }

    if (dto.walletAddress) {
      user = await this.usersRepo
        .createQueryBuilder("user")
        .where(
          "user.walletAddress COLLATE utf8mb4_general_ci = :walletAddress",
          { walletAddress: dto.walletAddress }
        )
        .getOne();
      if (user) {
        throw new HttpException(
          "Wallet address already exists",
          HttpStatus.BAD_REQUEST
        );
      }
    }

    user = this.usersRepo.create({
      walletAddress:
        dto.walletAddress || `wallet_${crypto.randomBytes(16).toString("hex")}`,
      email: dto.email,
      fullName: dto.fullName,
      password: dto.password ? await bcrypt.hash(dto.password, 10) : null,
      avatar: "http://localhost:8080/storage/user/default.png",
      isDeleted: false,
    });

    if (!dto.walletAddress && dto.email) {
      // Use Raw query to avoid collation issues
      const patientRole = await this.roleRepo
        .createQueryBuilder("role")
        .where("role.name COLLATE utf8mb4_general_ci = :name", {
          name: "PATIENT",
        })
        .getOne();
      if (patientRole) user.roleId = patientRole.id;
    }

    return this.usersRepo.save(user);
  }

  async loginWithPassword(email: string, password: string) {
    const user = await this.usersRepo
      .createQueryBuilder("user")
      .where("user.email COLLATE utf8mb4_general_ci = :email", { email })
      .getOne();
    if (!user) {
      throw new HttpException("User not found", HttpStatus.UNAUTHORIZED);
    }

    if (user.password && !(await bcrypt.compare(password, user.password))) {
      throw new HttpException("Invalid password", HttpStatus.UNAUTHORIZED);
    }

    // Generate access token (simple for now)
    const accessToken = crypto.randomBytes(32).toString("hex");
    const roleName = await this.getRoleName(user.roleId);

    return {
      accessToken,
      user: {
        id: user.walletAddress,
        walletAddress: user.walletAddress,
        email: user.email,
        fullName: user.fullName,
        avatar: user.avatar,
        role: roleName || user.roleId, // Fallback to roleId if role not found
      },
    };
  }

  async login(walletAddress: string) {
    const user = await this.usersRepo
      .createQueryBuilder("user")
      .where("user.walletAddress COLLATE utf8mb4_general_ci = :walletAddress", {
        walletAddress,
      })
      .getOne();
    if (!user) {
      throw new HttpException("User not found", HttpStatus.UNAUTHORIZED);
    }

    const roleName = await this.getRoleName(user.roleId);

    return {
      accessToken: crypto.randomBytes(32).toString("hex"),
      user: {
        id: user.walletAddress,
        walletAddress: user.walletAddress,
        email: user.email,
        fullName: user.fullName,
        avatar: user.avatar,
        role: roleName || user.roleId, // Fallback to roleId if role not found
      },
    };
  }

  async getAccount(walletAddressOrEmail: string) {
    const user = await this.usersRepo
      .createQueryBuilder("user")
      .where("user.walletAddress COLLATE utf8mb4_general_ci = :value", {
        value: walletAddressOrEmail,
      })
      .orWhere("user.email COLLATE utf8mb4_general_ci = :value", {
        value: walletAddressOrEmail,
      })
      .getOne();
    if (!user) {
      throw new HttpException("User not found", HttpStatus.NOT_FOUND);
    }

    const roleName = await this.getRoleName(user.roleId);

    return {
      id: user.walletAddress,
      walletAddress: user.walletAddress,
      email: user.email,
      fullName: user.fullName,
      avatar: user.avatar,
      role: roleName || user.roleId, // Fallback to roleId if role not found
      centerId: user.centerId,
    };
  }

  async refresh(refreshToken: string) {
    const user = await this.usersRepo
      .createQueryBuilder("user")
      .where("user.refreshToken COLLATE utf8mb4_general_ci = :refreshToken", {
        refreshToken,
      })
      .getOne();
    if (!user) {
      throw new HttpException("Invalid refresh token", HttpStatus.UNAUTHORIZED);
    }

    return {
      accessToken: crypto.randomBytes(32).toString("hex"),
    };
  }
}
