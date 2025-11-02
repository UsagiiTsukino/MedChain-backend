import { Body, Controller, Get, Post, Query, Session } from "@nestjs/common";
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
    const patientWalletAddress = session?.walletAddress || session?.email;
    if (!patientWalletAddress) throw new Error("User not authenticated");

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
}
