import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { CloudinaryService } from "./cloudinary.service";

function randomName(originalName: string) {
  const name = Date.now() + "-" + Math.round(Math.random() * 1e9);
  return name + extname(originalName);
}

@Controller("files")
export class FilesController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (req, file, cb) => cb(null, "uploads"),
        filename: (req, file, cb) => cb(null, randomName(file.originalname)),
      }),
    })
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body("folder") folder?: string
  ) {
    return { path: file.path, filename: file.filename, folder: folder || null };
  }

  @Post("upload-avatar")
  @UseInterceptors(FileInterceptor("avatar"))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    // Validate file type
    const allowedMimes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException("Only image files are allowed");
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException("File size must be less than 5MB");
    }

    try {
      const imageUrl = await this.cloudinaryService.uploadImage(
        file,
        "avatars"
      );
      return { url: imageUrl };
    } catch (error) {
      throw new BadRequestException("Failed to upload image");
    }
  }
}
