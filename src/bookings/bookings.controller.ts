import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Session,
  HttpException,
  HttpStatus,
  Param,
} from "@nestjs/common";
import { BookingsService } from "./bookings.service";

@Controller("bookings")
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  async create(
    @Body()
    body: {
      vaccineId: string;
      centerId: string;
      familyMemberId?: string;
      firstDoseDate: string;
      firstDoseTime?: string;
      time?: string;
      amount: number;
      doseSchedules?: Array<{ date: string; time: string; centerId: string }>;
      method?: string;
      paymentMethod?: string;
    },
    @Session() session: Record<string, any>
  ) {
    console.log("[BookingsController] Session keys:", Object.keys(session));
    console.log("[BookingsController] Session data:", {
      walletAddress: session?.walletAddress,
      email: session?.email,
      cookie: session?.cookie,
    });

    const patientWalletAddress = session?.walletAddress || session?.email;
    if (!patientWalletAddress) {
      console.error(
        "[BookingsController] User not authenticated. Session:",
        session
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.UNAUTHORIZED,
          message: "User not authenticated. Please login again.",
          error: "Unauthorized",
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    return this.bookingsService.createBooking(
      {
        vaccineId: body.vaccineId,
        centerId: body.centerId,
        familyMemberId: body.familyMemberId,
        firstDoseDate: body.firstDoseDate,
        firstDoseTime: body.firstDoseTime || body.time || "09:00",
        amount: body.amount,
        doseSchedules: body.doseSchedules || [],
        paymentMethod: body.paymentMethod || body.method || "CASH",
      },
      patientWalletAddress
    );
  }

  @Get()
  async list(@Query("page") page = "0", @Query("size") size = "10") {
    return this.bookingsService.getAllBookings(
      parseInt(page, 10),
      parseInt(size, 10)
    );
  }

  @Get("my-history")
  async myHistory(@Session() session: Record<string, any>) {
    const patientWalletAddress = session?.walletAddress || session?.email;
    if (!patientWalletAddress) {
      throw new HttpException(
        {
          statusCode: HttpStatus.UNAUTHORIZED,
          message: "User not authenticated. Please login again.",
          error: "Unauthorized",
        },
        HttpStatus.UNAUTHORIZED
      );
    }
    return this.bookingsService.getHistoryBooking(patientWalletAddress);
  }

  @Get(":id")
  async getById(@Param("id") id: string) {
    return this.bookingsService.getBookingById(id);
  }

  @Get(":id/verify")
  async verifyOnChain(@Param("id") id: string) {
    return this.bookingsService.verifyBookingOnChain(id);
  }
}
