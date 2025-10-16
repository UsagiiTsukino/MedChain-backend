import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform, ValidationPipe as NestValidationPipe } from '@nestjs/common';

@Injectable()
export class ValidationPipe extends NestValidationPipe implements PipeTransform<any> {
  constructor() {
    super({ whitelist: true, transform: true });
  }

  async transform(value: any, metadata: ArgumentMetadata) {
    try {
      return await super.transform(value, metadata);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Validation failed');
    }
  }
}


