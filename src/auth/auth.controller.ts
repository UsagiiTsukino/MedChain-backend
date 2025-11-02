import {
  Body,
  Controller,
  Get,
  Post,
  Session,
  Headers,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { BookingsService } from "../bookings/bookings.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly bookingsService: BookingsService
  ) {}

  @Post("register")
  async register(
    @Body()
    dto: {
      fullName?: string;
      email?: string;
      password?: string;
      walletAddress?: string;
    },
    @Session() session: Record<string, any>
  ) {
    try {
      console.log("[AuthController] Register request:", {
        ...dto,
        password: dto.password ? "***" : undefined,
      });
      const result = await this.authService.register(dto);
      session.walletAddress = result.walletAddress;
      session.email = result.email;
      return result;
    } catch (error) {
      console.error(
        "[AuthController] Register error:",
        (error as Error).message
      );
      throw error;
    }
  }

  @Post("login")
  async login(
    @Body() dto: { walletAddress: string },
    @Session() session: Record<string, any>
  ) {
    const result = await this.authService.login(dto.walletAddress);
    session.walletAddress = dto.walletAddress;
    return result;
  }

  @Post("login/password")
  async loginWithPassword(
    @Body() body: { username: string; password: string },
    @Session() session: Record<string, any>
  ) {
    const result = await this.authService.loginWithPassword(
      body.username,
      body.password
    );
    session.email = body.username;
    session.walletAddress = result.user.walletAddress || result.user.id;
    return result;
  }

  @Post("login/google")
  async loginWithGoogle(
    @Body() body: { token: string },
    @Session() session: Record<string, any>
  ) {
    // Stub: derive a pseudo wallet from token prefix for dev
    const pseudo = `google_${(body.token || "").slice(0, 8)}`;
    session.walletAddress = pseudo;
    return this.authService.login(pseudo);
  }

  @Get("account")
  async me(@Session() session: Record<string, any>) {
    const identifier = session?.walletAddress || session?.email;
    if (!identifier) {
      return null; // Return null instead of throwing error for frontend compatibility
    }
    try {
      return this.authService.getAccount(identifier);
    } catch (error) {
      return null;
    }
  }

  @Post("logout")
  logout(@Session() session: Record<string, any>) {
    session.walletAddress = undefined;
    session.email = undefined;
    return { success: true };
  }

  @Get("refresh")
  async refresh(@Headers("cookie") cookieHeader?: string) {
    const refreshToken = cookieHeader
      ?.split(";")
      .find((c) => c.trim().startsWith("refresh_token="))
      ?.split("=")[1];
    if (!refreshToken) throw new Error("Missing refresh token");
    return this.authService.refresh(refreshToken);
  }

  @Get("my-appointments")
  myAppointments() {
    // To be implemented later by joining appointments table/contract
    return { items: [] };
  }

  @Get("booking")
  async getBooking(@Session() session: Record<string, any>) {
    const identifier = session?.walletAddress || session?.email;
    if (!identifier) {
      throw new HttpException("Not authenticated", HttpStatus.UNAUTHORIZED);
    }
    return this.bookingsService.getBooking(identifier);
  }

  @Get("history-booking")
  async getHistoryBooking(@Session() session: Record<string, any>) {
    const identifier = session?.walletAddress || session?.email;
    if (!identifier) {
      throw new HttpException("Not authenticated", HttpStatus.UNAUTHORIZED);
    }
    return this.bookingsService.getHistoryBooking(identifier);
  }
}
