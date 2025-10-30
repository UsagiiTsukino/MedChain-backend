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
import { Like, Repository } from "typeorm";
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
    const where: any = {};
    if (module) where.module = module;
    if (q) {
      where.name = Like(`%${q}%`);
    }
    const items = await this.permissionRepo.find({ where });
    return { items, total: items.length };
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.permissionRepo.delete({ id });
    return { id };
  }
}
