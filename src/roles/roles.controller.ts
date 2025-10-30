import { Body, Controller, Get, Param, Put, Query } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Like, Repository } from "typeorm";
import { Role } from "./entities/role.entity";

@Controller("roles")
export class RolesController {
  constructor(
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>
  ) {}

  @Get()
  async list(@Query("q") q?: string) {
    const where = q ? { name: Like(`%${q}%`) } : {};
    const items = await this.roleRepo.find({ where });
    return { items, total: items.length };
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() body: Partial<Role>) {
    await this.roleRepo.update({ id }, body);
    return this.roleRepo.findOne({ where: { id } });
  }
}
