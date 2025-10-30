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
import { Repository, Like } from "typeorm";
import { Center } from "./entities/center.entity";

@Controller("centers")
export class CentersController {
  constructor(
    @InjectRepository(Center)
    private readonly centerRepo: Repository<Center>
  ) {}

  @Post()
  async create(@Body() body: Partial<Center>) {
    const created = this.centerRepo.create(body);
    const saved = await this.centerRepo.save(created);
    return saved;
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() body: Partial<Center>) {
    await this.centerRepo.update({ id }, body);
    return this.centerRepo.findOne({ where: { id } });
  }

  @Get()
  async list(
    @Query("q") q?: string,
    @Query("page") page = "1",
    @Query("size") size = "10"
  ) {
    const take = Math.max(1, parseInt(size as string, 10) || 10);
    const skip = (Math.max(1, parseInt(page as string, 10) || 1) - 1) * take;
    const where = q
      ? [{ name: Like(`%${q}%`) }, { address: Like(`%${q}%`) }]
      : {};
    const [items, total] = await this.centerRepo.findAndCount({
      where,
      skip,
      take,
    });
    return { items, total, page: Math.floor(skip / take) + 1, size: take };
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.centerRepo.delete({ id });
    return { id };
  }
}
