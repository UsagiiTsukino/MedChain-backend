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

  @Put(":walletAddress")
  async updateProfile(
    @Param("walletAddress") walletAddress: string,
    @Body()
    body: {
      fullname?: string;
      email?: string;
      phoneNumber?: string;
      birthday?: string;
      address?: string;
      centerName?: string;
    }
  ) {
    const user = await this.userRepo.findOne({ where: { walletAddress } });
    if (!user) throw new Error("User not found");

    let center: Center | null = null;
    if (body.centerName) {
      center = await this.centerRepo.findOne({
        where: { name: body.centerName },
      });
    }

    user.fullName = body.fullname ?? user.fullName;
    user.email = body.email ?? user.email;
    user.phoneNumber = body.phoneNumber ?? user.phoneNumber;
    user.birthday = body.birthday ?? user.birthday;
    user.address = body.address ?? user.address;
    user.center = center ?? user.center ?? null;
    return this.userRepo.save(user);
  }

  @Get()
  async list(@Query("q") q?: string) {
    const where = q
      ? [{ fullName: ILike(`%${q}%`) }, { email: ILike(`%${q}%`) }]
      : ({} as any);
    const items = await this.userRepo.find({
      where,
      relations: ["center", "role"],
    });
    return { items, total: items.length };
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.userRepo.update({ id }, { isDeleted: true });
    return { id };
  }

  @Get("doctors")
  async doctors() {
    const doctorRole = await this.roleRepo.findOne({
      where: { name: "DOCTOR" },
    });
    if (!doctorRole) return { items: [] };
    const items = await this.userRepo.find({
      where: { role: { id: doctorRole.id } as any },
    });
    return { items, total: items.length };
  }
}
