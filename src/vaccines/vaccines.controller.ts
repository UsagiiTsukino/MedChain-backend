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
import { Vaccine } from "./entities/vaccine.entity";

@Controller("vaccines")
export class VaccinesController {
  constructor(
    @InjectRepository(Vaccine) private readonly vaccineRepo: Repository<Vaccine>
  ) {}

  @Post()
  async create(@Body() body: any) {
    const entity = this.vaccineRepo.create(body);
    return this.vaccineRepo.save(entity);
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() body: Partial<Vaccine>) {
    await this.vaccineRepo.update({ id }, body);
    return this.vaccineRepo.findOne({ where: { id } });
  }

  @Get()
  async list(
    @Query("q") q?: string,
    @Query("page") page = "1",
    @Query("size") size = "10"
  ) {
    const take = Math.max(1, parseInt(size as string, 10) || 10);
    const skip = (Math.max(1, parseInt(page as string, 10) || 1) - 1) * take;
    const where = q ? [{ name: Like(`%${q}%`) }] : {};
    const [items, total] = await this.vaccineRepo.findAndCount({
      where,
      skip,
      take,
    });
    return { items, total, page: Math.floor(skip / take) + 1, size: take };
  }

  @Get(":slug")
  async getBySlug(@Param("slug") slug: string) {
    // legacy DB không có slug: tìm theo slug suy ra từ name
    const items = await this.vaccineRepo.find();
    const norm = (s: string) =>
      s
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
    return items.find((v) => norm(v.name) === slug) || null;
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.vaccineRepo.delete({ id });
    return { id };
  }
}
