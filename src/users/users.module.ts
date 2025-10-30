import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "./entities/user.entity";
import { UsersController } from "./users.controller";
import { Center } from "../centers/entities/center.entity";
import { Role } from "../roles/entities/role.entity";

@Module({
  imports: [TypeOrmModule.forFeature([User, Center, Role])],
  controllers: [UsersController],
  exports: [TypeOrmModule],
})
export class UsersModule {}
