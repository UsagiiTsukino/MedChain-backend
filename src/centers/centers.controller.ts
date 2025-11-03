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

  @Get(":id")
  async getById(@Param("id") id: string) {
    const center = await this.centerRepo.findOne({
      where: { id: BigInt(id) as any },
    });
    if (!center) throw new Error("Center not found");
    return { ...center, centerId: center.id };
  }

  @Get()
  async list(
    @Query("q") q?: string,
    @Query("page") page = "0",
    @Query("size") size = "10"
  ) {
    const take = Math.max(1, parseInt(size as string, 10) || 10);
    const skip = Math.max(0, parseInt(page as string, 10) || 0) * take;

    const queryBuilder = this.centerRepo.createQueryBuilder("center");

    if (q) {
      queryBuilder.where(
        "(center.name COLLATE utf8mb4_general_ci LIKE :q OR center.address COLLATE utf8mb4_general_ci LIKE :q)",
        { q: `%${q}%` }
      );
    }

    queryBuilder.skip(skip).take(take);
    const [items, total] = await queryBuilder.getManyAndCount();

    // Map id to centerId for frontend compatibility
    const result = items.map((c) => ({
      ...c,
      centerId: c.id,
    }));

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

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.centerRepo.delete({ id: BigInt(id) as any });
    return { id };
  }
}
