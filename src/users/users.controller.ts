import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "./entities/user.entity";
import { Center } from "../centers/entities/center.entity";
import { Role } from "../roles/entities/role.entity";

@Controller("users")
export class UsersController {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Center) private readonly centerRepo: Repository<Center>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>
  ) {}

  /**
   * Convert date from DD/MM/YYYY to YYYY-MM-DD format for MySQL
   */
  private convertDateFormat(dateString: string): string {
    // Check if already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }

    // Convert from DD/MM/YYYY to YYYY-MM-DD
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
      const [day, month, year] = dateString.split("/");
      return `${year}-${month}-${day}`;
    }

    // If format is unrecognized, return as-is (will fail validation)
    return dateString;
  }

  @Put(":walletAddress")
  async update(
    @Param("walletAddress") walletAddress: string,
    @Body()
    body: {
      fullName?: string;
      email?: string;
      phoneNumber?: string;
      birthday?: string;
      address?: string;
      centerId?: string;
      roleId?: string;
      centerName?: string;
      role?: string;
    }
  ) {
    const user = await this.userRepo
      .createQueryBuilder("user")
      .where("user.walletAddress COLLATE utf8mb4_general_ci = :walletAddress", {
        walletAddress: walletAddress,
      })
      .getOne();
    if (!user) throw new Error("User not found");

    user.fullName = body.fullName ?? user.fullName;
    user.email = body.email ?? user.email;
    user.phoneNumber = body.phoneNumber ?? user.phoneNumber;

    // Convert birthday from DD/MM/YYYY to YYYY-MM-DD if provided
    if (body.birthday) {
      user.birthday = this.convertDateFormat(body.birthday);
    }

    user.address = body.address ?? user.address;
    if (body.centerId) user.centerId = body.centerId;
    if (body.roleId) user.roleId = body.roleId;

    // Handle centerName by looking up centerId
    if (body.centerName) {
      const center = await this.centerRepo
        .createQueryBuilder("center")
        .where("center.name COLLATE utf8mb4_general_ci = :name", {
          name: body.centerName,
        })
        .getOne();
      if (center) {
        user.centerId = center.id;
      }
    }

    // Handle role name by looking up roleId
    if (body.role) {
      const role = await this.roleRepo
        .createQueryBuilder("role")
        .where("role.name COLLATE utf8mb4_general_ci = :name", {
          name: body.role,
        })
        .getOne();
      if (role) {
        user.roleId = role.id;
      }
    }

    return this.userRepo.save(user);
  }

  @Get()
  async list(
    @Query("q") q?: string,
    @Query("page") page = "0",
    @Query("size") size = "10"
  ) {
    const take = Math.max(1, parseInt(size as string, 10) || 10);
    const skip = Math.max(0, parseInt(page as string, 10) || 0) * take;

    // First, get users with pagination
    const queryBuilder = this.userRepo.createQueryBuilder("user");
    queryBuilder.where("user.isDeleted = :isDeleted", { isDeleted: false });

    if (q) {
      queryBuilder.andWhere(
        "user.fullname COLLATE utf8mb4_general_ci LIKE :q",
        { q: `%${q}%` }
      );
    }

    queryBuilder.skip(skip).take(take);
    const [users, total] = await queryBuilder.getManyAndCount();

    // Then, manually fetch center and role names for each user
    const result = await Promise.all(
      users.map(async (user) => {
        let centerName = null;
        let roleName = null;

        if (user.centerId) {
          const center = await this.centerRepo
            .createQueryBuilder("center")
            .where("center.center_id = :centerId", { centerId: user.centerId })
            .getOne();
          centerName = center?.name || null;
        }

        if (user.roleId) {
          const role = await this.roleRepo
            .createQueryBuilder("role")
            .where("role.id = :roleId", { roleId: user.roleId })
            .getOne();
          roleName = role?.name || null;
        }

        return {
          walletAddress: user.walletAddress,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          address: user.address,
          birthday: user.birthday,
          centerId: user.centerId,
          roleId: user.roleId,
          centerName,
          role: roleName,
          avatar: user.avatar,
          isDeleted: user.isDeleted,
        };
      })
    );

    return {
      result,
      meta: {
        page: Math.floor(skip / take),
        pageSize: take,
        pages: Math.ceil(total / take),
        total,
      },
    };
  }

  @Delete(":walletAddress")
  async remove(@Param("walletAddress") walletAddress: string) {
    // Use QueryBuilder to avoid collation issues
    const result = await this.userRepo
      .createQueryBuilder()
      .update()
      .set({ isDeleted: true })
      .where("walletAddress COLLATE utf8mb4_general_ci = :walletAddress", {
        walletAddress,
      })
      .execute();

    return {
      statusCode: 200,
      message: "User deleted successfully",
      data: { walletAddress, affected: result.affected },
    };
  }

  @Get("doctors")
  async doctors(
    @Query("page") page = "0",
    @Query("size") size = "10",
    @Query("centerId") centerId?: string
  ) {
    // Use Raw query to avoid collation issues
    const doctorRole = await this.roleRepo
      .createQueryBuilder("role")
      .where("role.name COLLATE utf8mb4_general_ci = :name", { name: "DOCTOR" })
      .getOne();
    if (!doctorRole) return { result: [], meta: { total: 0 } };

    const take = Math.max(1, parseInt(size as string, 10) || 10);
    const skip = Math.max(0, parseInt(page as string, 10) || 0) * take;

    // Use QueryBuilder to avoid collation issues
    const queryBuilder = this.userRepo.createQueryBuilder("user");
    queryBuilder
      .where("user.roleId = :roleId", { roleId: doctorRole.id.toString() })
      .andWhere("user.isDeleted = :isDeleted", { isDeleted: false });

    // Filter by centerId if provided
    if (centerId) {
      queryBuilder.andWhere("user.centerId = :centerId", { centerId });
    }

    queryBuilder.skip(skip).take(take);

    const [items, total] = await queryBuilder.getManyAndCount();
    return {
      result: items,
      meta: {
        page: Math.floor(skip / take),
        pageSize: take,
        pages: Math.ceil(total / take),
        total,
      },
    };
  }
}
