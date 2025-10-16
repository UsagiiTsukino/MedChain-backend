import { Body, Controller, Get, Post, Session } from '@nestjs/common';
import { AuthService } from './auth.service';

class RegisterDto {
  walletAddress!: string;
}

class LoginDto {
  walletAddress!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Session() session: Record<string, any>) {
    session.walletAddress = dto.walletAddress;
    return this.authService.login(dto.walletAddress);
  }

  @Get('account')
  me(@Session() session: Record<string, any>) {
    return this.authService.login(session.walletAddress);
  }
}


