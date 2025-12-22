import { Module } from "@nestjs/common";
import { FilesController } from "./files.controller";
import { CloudinaryService } from "./cloudinary.service";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [ConfigModule],
  controllers: [FilesController],
  providers: [CloudinaryService],
  exports: [CloudinaryService],
})
export class FilesModule {}
