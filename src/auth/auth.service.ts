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
        phoneNumber: user.phoneNumber,
        birthday: user.birthday,
        address: user.address,
        centerId: user.centerId,
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
        phoneNumber: user.phoneNumber,
        birthday: user.birthday,
        address: user.address,
        centerId: user.centerId,
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
      phoneNumber: user.phoneNumber,
      birthday: user.birthday,
      address: user.address,
    };
  }

  async linkWallet(identifier: string, newWalletAddress: string) {
    // Find user by current wallet or email
    const user = await this.usersRepo
      .createQueryBuilder("user")
      .where("user.walletAddress COLLATE utf8mb4_general_ci = :value", {
        value: identifier,
      })
      .orWhere("user.email COLLATE utf8mb4_general_ci = :value", {
        value: identifier,
      })
      .getOne();

    if (!user) {
      throw new HttpException("User not found", HttpStatus.NOT_FOUND);
    }

    // Check if new wallet address is already used by another user
    const existingUser = await this.usersRepo
      .createQueryBuilder("user")
      .where("user.walletAddress COLLATE utf8mb4_general_ci = :walletAddress", {
        walletAddress: newWalletAddress,
      })
      .andWhere("user.email != :email", { email: user.email })
      .getOne();

    if (existingUser) {
      throw new HttpException(
        "Wallet address already linked to another account",
        HttpStatus.BAD_REQUEST
      );
    }

    // Update wallet address
    user.walletAddress = newWalletAddress;
    await this.usersRepo.save(user);

    return {
      statusCode: 200,
      message: "Wallet linked successfully",
      data: {
        walletAddress: user.walletAddress,
        email: user.email,
        fullName: user.fullName,
      },
    };
  }

  async updateAvatar(identifier: string, avatarUrl: string) {
    const user = await this.usersRepo
      .createQueryBuilder("user")
      .where(
        "user.walletAddress COLLATE utf8mb4_general_ci = :identifier OR user.email COLLATE utf8mb4_general_ci = :identifier",
        { identifier }
      )
      .getOne();

    if (!user) {
      throw new HttpException("User not found", HttpStatus.NOT_FOUND);
    }

    user.avatar = avatarUrl;
    await this.usersRepo.save(user);

    return {
      statusCode: 200,
      message: "Avatar updated successfully",
      data: {
        avatar: user.avatar,
      },
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
      throw new HttpException(
        {
          statusCode: HttpStatus.UNAUTHORIZED,
          message: "Invalid or expired refresh token. Please login again.",
          error: "Unauthorized",
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    return {
      accessToken: crypto.randomBytes(32).toString("hex"),
    };
  }

  async linkMetaMask(identifier: string, metamaskWallet: string) {
    console.log("[AuthService] linkMetaMask called:", {
      identifier,
      metamaskWallet,
    });

    // Find user by wallet_address or email
    let user = await this.usersRepo
      .createQueryBuilder("user")
      .where("user.walletAddress COLLATE utf8mb4_general_ci = :identifier", {
        identifier,
      })
      .orWhere("user.email COLLATE utf8mb4_general_ci = :identifier", {
        identifier,
      })
      .getOne();

    console.log(
      "[AuthService] User found:",
      user
        ? {
            walletAddress: user.walletAddress,
            email: user.email,
            currentMetamaskWallet: user.metamaskWallet,
          }
        : "NOT FOUND"
    );

    if (!user) {
      throw new HttpException("User not found", HttpStatus.NOT_FOUND);
    }

    // Check if MetaMask wallet is already linked to another user
    const existingUser = await this.usersRepo
      .createQueryBuilder("user")
      .where(
        "user.metamaskWallet COLLATE utf8mb4_general_ci = :metamaskWallet",
        {
          metamaskWallet,
        }
      )
      .andWhere("user.walletAddress != :currentWallet", {
        currentWallet: user.walletAddress,
      })
      .getOne();

    if (existingUser) {
      throw new HttpException(
        "This MetaMask wallet is already linked to another account",
        HttpStatus.BAD_REQUEST
      );
    }

    // Update MetaMask wallet
    user.metamaskWallet = metamaskWallet;
    console.log(
      "[AuthService] Saving user with metamaskWallet:",
      metamaskWallet
    );
    const savedUser = await this.usersRepo.save(user);
    console.log("[AuthService] User saved successfully:", {
      walletAddress: savedUser.walletAddress,
      metamaskWallet: savedUser.metamaskWallet,
    });

    return {
      statusCode: 200,
      message: "MetaMask wallet linked successfully",
      data: {
        walletAddress: savedUser.walletAddress,
        metamaskWallet: savedUser.metamaskWallet,
        email: savedUser.email,
        fullName: savedUser.fullName,
      },
    };
  }
}
