import {
  Body,
  Controller,
  Get,
  Post,
  Session,
  Headers,
  HttpException,
  HttpStatus,
  Res,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { BookingsService } from "../bookings/bookings.service";
import { Response } from "express";

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
    console.log("[AuthController] Get account - session:", session);
    const identifier = session?.walletAddress || session?.email;
    console.log("[AuthController] Identifier:", identifier);
    if (!identifier) {
      console.log("[AuthController] No identifier found in session");
      return null; // Return null instead of throwing error for frontend compatibility
    }
    try {
      const account = await this.authService.getAccount(identifier);
      console.log("[AuthController] Account found:", account);
      return account;
    } catch (error) {
      console.error("[AuthController] Error getting account:", error);
      return null;
    }
  }

  @Post("logout")
  logout(@Session() session: Record<string, any>) {
    console.log("[AuthController] Logout - clearing session");
    session.walletAddress = undefined;
    session.email = undefined;
    return {
      statusCode: 200,
      message: "Logged out successfully",
    };
  }

  @Post("link-wallet")
  async linkWallet(
    @Body() dto: { walletAddress: string },
    @Session() session: Record<string, any>
  ) {
    const identifier = session?.walletAddress || session?.email;
    if (!identifier) {
      throw new HttpException("Not authenticated", HttpStatus.UNAUTHORIZED);
    }

    try {
      const result = await this.authService.linkWallet(
        identifier,
        dto.walletAddress
      );
      // Update session with new wallet address
      session.walletAddress = dto.walletAddress;
      return result;
    } catch (error) {
      console.error("[AuthController] Link wallet error:", error);
      throw new HttpException(
        (error as Error).message || "Failed to link wallet",
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get("refresh")
  async refresh(
    @Headers("cookie") cookieHeader?: string,
    @Res({ passthrough: true }) response?: Response
  ) {
    const refreshToken = cookieHeader
      ?.split(";")
      .find((c) => c.trim().startsWith("refresh_token="))
      ?.split("=")[1];

    if (!refreshToken) {
      // Clear cookies and return 401 to trigger frontend logout
      response?.clearCookie("refresh_token");
      response?.clearCookie("access_token");
      throw new HttpException(
        {
          statusCode: HttpStatus.UNAUTHORIZED,
          message: "Refresh token missing. Please login again.",
          error: "Unauthorized",
        },
        HttpStatus.UNAUTHORIZED
      );
    }

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

  @Post("link-metamask")
  async linkMetaMask(
    @Body() body: { metamaskWallet: string },
    @Session() session: Record<string, any>
  ) {
    console.log("[AuthController] Link MetaMask request:", {
      metamaskWallet: body.metamaskWallet,
      sessionData: {
        walletAddress: session?.walletAddress,
        email: session?.email,
      },
    });

    const identifier = session?.walletAddress || session?.email;
    if (!identifier) {
      throw new HttpException("Not authenticated", HttpStatus.UNAUTHORIZED);
    }

    const result = await this.authService.linkMetaMask(
      identifier,
      body.metamaskWallet
    );
    console.log("[AuthController] Link MetaMask success:", result);
    return result;
  }
}
