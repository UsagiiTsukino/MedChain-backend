import { Body, Controller, Get, Param, Put, Query } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Role } from "./entities/role.entity";

@Controller("roles")
export class RolesController {
  constructor(
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>
  ) {}

  @Get()
  async list(@Query("q") q?: string) {
    const queryBuilder = this.roleRepo.createQueryBuilder("role");

    if (q) {
      queryBuilder.where("role.name COLLATE utf8mb4_general_ci LIKE :q", {
        q: `%${q}%`,
      });
    }

    const items = await queryBuilder.getMany();
    return { items, total: items.length };
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() body: Partial<Role>) {
    await this.roleRepo.update({ id }, body);
    return this.roleRepo.findOne({ where: { id } });
  }
}
