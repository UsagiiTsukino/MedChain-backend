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

  @Get(":id")
  async getById(@Param("id") id: string) {
    const vaccine = await this.vaccineRepo.findOne({ where: { id: BigInt(id) as any } });
    if (!vaccine) throw new Error("Vaccine not found");
    return { ...vaccine, vaccineId: vaccine.id };
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
      where.name = Like(`%${q}%`);
    }
    const [items, total] = await this.vaccineRepo.findAndCount({
      where,
      skip,
      take,
    });
    
    // Map id to vaccineId for frontend compatibility
    const result = items.map(v => ({
      ...v,
      vaccineId: v.id,
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
    await this.vaccineRepo.delete({ id });
    return { id };
  }
}
