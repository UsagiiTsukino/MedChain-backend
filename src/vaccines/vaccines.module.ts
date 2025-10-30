import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Vaccine } from "./entities/vaccine.entity";
import { VaccinesController } from "./vaccines.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Vaccine])],
  controllers: [VaccinesController],
  exports: [TypeOrmModule],
})
export class VaccinesModule {}
