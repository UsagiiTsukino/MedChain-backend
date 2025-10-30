import { Body, Controller, Get, Post, Session } from "@nestjs/common";
import { AuthService } from "./auth.service";

class RegisterDto {
  walletAddress!: string;
}

class LoginDto {
  walletAddress!: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  login(@Body() dto: LoginDto, @Session() session: Record<string, any>) {
    session.walletAddress = dto.walletAddress;
    return this.authService.login(dto.walletAddress);
  }

  // Compatibility endpoints expected by frontend
  @Post("login/password")
  loginWithPassword(
    @Body() body: { username: string; password: string },
    @Session() session: Record<string, any>
  ) {
    // For now, treat username as walletAddress surrogate
    session.walletAddress = body.username;
    return this.authService.login(body.username);
  }

  @Post("login/google")
  loginWithGoogle(
    @Body() body: { token: string },
    @Session() session: Record<string, any>
  ) {
    // Stub: derive a pseudo wallet from token prefix for dev
    const pseudo = `google_${(body.token || "").slice(0, 8)}`;
    session.walletAddress = pseudo;
    return this.authService.login(pseudo);
  }

  @Get("account")
  me(@Session() session: Record<string, any>) {
    return this.authService.login(session.walletAddress);
  }

  @Post("logout")
  logout(@Session() session: Record<string, any>) {
    session.walletAddress = undefined;
    return { success: true };
  }

  @Get("refresh")
  refresh() {
    // Stub access token compatible with axios interceptor contract
    return { accessToken: "dev-token" };
  }

  @Get("my-appointments")
  myAppointments() {
    // To be implemented later by joining appointments table/contract
    return { items: [] };
  }
}
