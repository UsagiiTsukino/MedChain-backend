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
import { ILike, Repository } from "typeorm";
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

  @Put()
  async updateProfile(
    @Body()
    body: {
      walletAddress?: string;
      fullname?: string;
      email?: string;
      phoneNumber?: string;
      birthday?: string;
      address?: string;
      centerId?: string;
      roleId?: string;
    }
  ) {
    if (!body.walletAddress) throw new Error("walletAddress is required");
    const user = await this.userRepo.findOne({
      where: { walletAddress: body.walletAddress },
    });
    if (!user) throw new Error("User not found");

    user.fullName = body.fullname ?? user.fullName;
    user.email = body.email ?? user.email;
    user.phoneNumber = body.phoneNumber ?? user.phoneNumber;
    user.birthday = body.birthday ?? user.birthday;
    user.address = body.address ?? user.address;
    if (body.centerId) user.centerId = body.centerId;
    if (body.roleId) user.roleId = body.roleId;

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
    const where: any = { isDeleted: false };
    if (q) {
      where.fullName = ILike(`%${q}%`);
    }

    const [items, total] = await this.userRepo.findAndCount({
      where,
      skip,
      take,
    });
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

  @Delete(":walletAddress")
  async remove(@Param("walletAddress") walletAddress: string) {
    await this.userRepo.update({ walletAddress }, { isDeleted: true });
    return { walletAddress };
  }

  @Get("doctors")
  async doctors(@Query("page") page = "0", @Query("size") size = "10") {
    const doctorRole = await this.roleRepo.findOne({
      where: { name: "DOCTOR" },
    });
    if (!doctorRole) return { result: [], meta: { total: 0 } };

    const take = Math.max(1, parseInt(size as string, 10) || 10);
    const skip = Math.max(0, parseInt(page as string, 10) || 0) * take;

    const [items, total] = await this.userRepo.findAndCount({
      where: { roleId: doctorRole.id, isDeleted: false },
      skip,
      take,
    });
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
