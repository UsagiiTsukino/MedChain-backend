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
    const numericId = BigInt(id);
    const vaccine = await this.vaccineRepo.findOne({
      where: { id: numericId as any },
    });
    if (!vaccine) throw new Error("Vaccine not found");

    // Remove 'image' field if present (it might be 'imageUrl' instead)
    const { image, ...updateData } = body as any;

    // Update fields
    Object.assign(vaccine, updateData);
    const saved = await this.vaccineRepo.save(vaccine);
    return { ...saved, vaccineId: saved.id };
  }

  @Get()
  async list(
    @Query("q") q?: string,
    @Query("page") page = "0",
    @Query("size") size = "10",
    @Query("disease") disease?: string,
    @Query("target") target?: string,
    @Query("minPrice") minPrice?: string,
    @Query("maxPrice") maxPrice?: string
  ) {
    const take = Math.max(1, parseInt(size as string, 10) || 10);
    const skip = Math.max(0, parseInt(page as string, 10) || 0) * take;

    const queryBuilder = this.vaccineRepo.createQueryBuilder("vaccine");
    queryBuilder.where("vaccine.isDeleted = :isDeleted", { isDeleted: false });

    if (q) {
      // Tìm kiếm theo tên vaccine, bệnh, hoặc nhà sản xuất
      queryBuilder.andWhere(
        "(vaccine.name COLLATE utf8mb4_general_ci LIKE :q OR vaccine.disease COLLATE utf8mb4_general_ci LIKE :q OR vaccine.manufacturer COLLATE utf8mb4_general_ci LIKE :q)",
        {
          q: `%${q}%`,
        }
      );
    }

    // Filter theo disease
    if (disease) {
      queryBuilder.andWhere(
        "vaccine.disease COLLATE utf8mb4_general_ci LIKE :disease",
        {
          disease: `%${disease}%`,
        }
      );
    }

    // Filter theo target (đối tượng)
    if (target) {
      queryBuilder.andWhere(
        "vaccine.target COLLATE utf8mb4_general_ci LIKE :target",
        {
          target: `%${target}%`,
        }
      );
    }

    // Filter theo khoảng giá
    if (minPrice) {
      const min = parseFloat(minPrice);
      if (!isNaN(min)) {
        queryBuilder.andWhere("vaccine.price >= :minPrice", { minPrice: min });
      }
    }
    if (maxPrice) {
      const max = parseFloat(maxPrice);
      if (!isNaN(max)) {
        queryBuilder.andWhere("vaccine.price < :maxPrice", { maxPrice: max });
      }
    }

    queryBuilder.skip(skip).take(take);
    const [items, total] = await queryBuilder.getManyAndCount();

    // Map id to vaccineId for frontend compatibility
    const result = items.map((v) => ({
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

  @Get(":id")
  async getById(@Param("id") id: string) {
    if (!id || id === "undefined" || id === "null") {
      throw new Error("Vaccine ID is required");
    }

    // Validate that id is a valid number
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      throw new Error("Invalid vaccine ID format");
    }

    const vaccine = await this.vaccineRepo.findOne({
      where: { id: BigInt(numericId) as any },
    });
    if (!vaccine) throw new Error("Vaccine not found");
    return { ...vaccine, vaccineId: vaccine.id };
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    const numericId = BigInt(id);
    const vaccine = await this.vaccineRepo.findOne({
      where: { id: numericId as any },
    });
    if (!vaccine) throw new Error("Vaccine not found");

    // Soft delete
    vaccine.isDeleted = true;
    await this.vaccineRepo.save(vaccine);
    return { id };
  }
}
