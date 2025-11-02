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
      user = await this.usersRepo.findOne({ where: { email: dto.email } });
      if (user) {
        throw new HttpException("Email already exists", HttpStatus.BAD_REQUEST);
      }
    }

    if (dto.walletAddress) {
      user = await this.usersRepo.findOne({
        where: { walletAddress: dto.walletAddress },
      });
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
      const patientRole = await this.roleRepo.findOne({
        where: { name: "PATIENT" },
      });
      if (patientRole) user.roleId = patientRole.id;
    }

    return this.usersRepo.save(user);
  }

  async loginWithPassword(email: string, password: string) {
    const user = await this.usersRepo.findOne({ where: { email } });
    if (!user) {
      throw new HttpException("User not found", HttpStatus.UNAUTHORIZED);
    }

    if (user.password && !(await bcrypt.compare(password, user.password))) {
      throw new HttpException("Invalid password", HttpStatus.UNAUTHORIZED);
    }

    // Generate access token (simple for now)
    const accessToken = crypto.randomBytes(32).toString("hex");

    return {
      accessToken,
      user: {
        id: user.walletAddress,
        walletAddress: user.walletAddress,
        email: user.email,
        fullName: user.fullName,
        avatar: user.avatar,
        role: user.roleId,
      },
    };
  }

  async login(walletAddress: string) {
    const user = await this.usersRepo.findOne({
      where: { walletAddress },
      relations: [],
    });
    if (!user) {
      throw new HttpException("User not found", HttpStatus.UNAUTHORIZED);
    }

    return {
      accessToken: crypto.randomBytes(32).toString("hex"),
      user: {
        id: user.walletAddress,
        walletAddress: user.walletAddress,
        email: user.email,
        fullName: user.fullName,
        avatar: user.avatar,
        role: user.roleId,
      },
    };
  }

  async getAccount(walletAddressOrEmail: string) {
    const user = await this.usersRepo.findOne({
      where: [
        { walletAddress: walletAddressOrEmail },
        { email: walletAddressOrEmail },
      ],
    });
    if (!user) {
      throw new HttpException("User not found", HttpStatus.NOT_FOUND);
    }

    return {
      id: user.walletAddress,
      walletAddress: user.walletAddress,
      email: user.email,
      fullName: user.fullName,
      avatar: user.avatar,
      role: user.roleId,
      centerId: user.centerId,
    };
  }

  async refresh(refreshToken: string) {
    const user = await this.usersRepo.findOne({
      where: { refreshToken },
    });
    if (!user) {
      throw new HttpException("Invalid refresh token", HttpStatus.UNAUTHORIZED);
    }

    return {
      accessToken: crypto.randomBytes(32).toString("hex"),
    };
  }
}
