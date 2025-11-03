import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Permission } from "./entities/permission.entity";

@Controller("permissions")
export class PermissionsController {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>
  ) {}

  @Post()
  async create(
    @Body()
    body: Pick<Permission, "name" | "method" | "apiPath" | "module">
  ) {
    const entity = this.permissionRepo.create(body as any);
    return this.permissionRepo.save(entity);
  }

  @Put()
  async update(@Body() body: Partial<Permission> & { id: string }) {
    const { id, ...rest } = body;
    await this.permissionRepo.update({ id }, rest);
    return this.permissionRepo.findOne({ where: { id } });
  }

  @Get()
  async list(@Query("q") q?: string, @Query("module") module?: string) {
    const queryBuilder = this.permissionRepo.createQueryBuilder("permission");

    if (module) {
      queryBuilder.where(
        "permission.module COLLATE utf8mb4_general_ci = :module",
        { module }
      );
    }

    if (q) {
      if (module) {
        queryBuilder.andWhere(
          "permission.name COLLATE utf8mb4_general_ci LIKE :q",
          { q: `%${q}%` }
        );
      } else {
        queryBuilder.where(
          "permission.name COLLATE utf8mb4_general_ci LIKE :q",
          { q: `%${q}%` }
        );
      }
    }

    const items = await queryBuilder.getMany();
    return { items, total: items.length };
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.permissionRepo.delete({ id });
    return { id };
  }
}
