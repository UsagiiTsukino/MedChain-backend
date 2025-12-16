import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Message } from "./messages.entity";
import { MessagesService } from "./messages.service";
import { MessagesController } from "./messages.controller";
import { MessagesGateway } from "./messages.gateway";
import { Appointment } from "../appointments/appointments.entity";
import { User } from "../users/entities/user.entity";
import { Role } from "../roles/entities/role.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Message, Appointment, User, Role])],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesGateway],
  exports: [MessagesService, MessagesGateway],
})
export class MessagesModule {}
