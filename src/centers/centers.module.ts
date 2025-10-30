import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Center } from "./entities/center.entity";
import { CentersController } from "./centers.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Center])],
  controllers: [CentersController],
  exports: [TypeOrmModule],
})
export class CentersModule {}
