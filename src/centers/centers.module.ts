import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Center } from './entities/center.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Center])],
  exports: [TypeOrmModule],
})
export class CentersModule {}


