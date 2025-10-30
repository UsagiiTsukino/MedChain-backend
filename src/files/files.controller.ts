import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";

function randomName(originalName: string) {
  const name = Date.now() + "-" + Math.round(Math.random() * 1e9);
  return name + extname(originalName);
}

@Controller("files")
export class FilesController {
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
}
