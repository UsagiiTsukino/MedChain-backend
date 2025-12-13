import {
  Controller,
  Post,
  Body,
  Session,
  Put,
  Param,
  Get,
  Query,
  Patch,
} from "@nestjs/common";
import { AppointmentsService } from "./appointments.service";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";

@Controller("appointments")
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  create(
    @Body() createAppointmentDto: CreateAppointmentDto,
    @Session() session: Record<string, any>
  ) {
    const patientWalletAddress = session?.walletAddress;
    if (!patientWalletAddress)
      throw new Error("User wallet address not found in session");
    return this.appointmentsService.create(
      createAppointmentDto,
      patientWalletAddress
    );
  }

  @Put(":id/process")
  process(
    @Param("id") id: string,
    @Body() body: { doctorAddress: string; cashierAddress: string }
  ) {
    const appointmentId = BigInt(id);
    return this.appointmentsService.process(
      appointmentId,
      body.doctorAddress,
      body.cashierAddress
    );
  }

  @Put(":id/accept")
  acceptAppointment(
    @Param("id") id: string,
    @Session() session: Record<string, any>
  ) {
    const appointmentId = BigInt(id);
    const doctorId = session?.walletAddress || session?.email;
    if (!doctorId) {
      throw new Error("Doctor not authenticated");
    }
    return this.appointmentsService.confirmAcceptance(appointmentId, doctorId);
  }

  @Put(":id/complete")
  complete(@Param("id") id: string) {
    const appointmentId = BigInt(id);
    return this.appointmentsService.complete(appointmentId);
  }

  @Put(":id/cancel")
  cancel(@Param("id") id: string) {
    const appointmentId = BigInt(id);
    return this.appointmentsService.cancel(appointmentId);
  }

  @Put(":id/unassign-doctor")
  unassignDoctor(@Param("id") id: string) {
    const appointmentId = BigInt(id);
    return this.appointmentsService.unassignDoctor(appointmentId);
  }

  // Get all appointments (admin)
  @Get()
  list() {
    return { items: [] };
  }

  // Get appointments by center (staff/cashier)
  @Get("center")
  async listByCenter(
    @Query("centerId") centerId: string,
    @Query("page") page = "0",
    @Query("size") size = "10"
  ) {
    if (!centerId) {
      return {
        result: [],
        meta: { page: 0, pageSize: 10, total: 0, pages: 0 },
      };
    }
    return this.appointmentsService.getAppointmentsByCenter(
      centerId,
      parseInt(page, 10),
      parseInt(size, 10)
    );
  }

  // Get doctor's schedule - MUST be before :hash route
  @Get("my-schedules")
  async mySchedules(
    @Session() session: Record<string, any>,
    @Query("page") page = "0",
    @Query("size") size = "10"
  ) {
    console.log("[my-schedules] Session:", JSON.stringify(session));
    const doctorId = session?.walletAddress || session?.email;
    console.log("[my-schedules] DoctorId extracted:", doctorId);

    if (!doctorId) {
      console.log("[my-schedules] No doctorId found, returning empty result");
      return {
        result: [],
        meta: { page: 0, pageSize: 10, total: 0, pages: 0 },
      };
    }

    console.log(
      `[my-schedules] Fetching schedules for doctor: ${doctorId}, page: ${page}, size: ${size}`
    );
    const result = await this.appointmentsService.getMySchedule(
      doctorId,
      parseInt(page, 10),
      parseInt(size, 10)
    );
    console.log(`[my-schedules] Found ${result.meta.total} appointments`);
    return result;
  }

  // Get appointments by booking ID
  @Get("booking/:bookingId")
  async getAppointmentsByBooking(@Param("bookingId") bookingId: string) {
    return this.appointmentsService.getAppointmentsByBooking(bookingId);
  }

  @Get(":hash")
  getByHash(@Param("hash") hash: string) {
    return { hash };
  }

  @Post("meta-mark")
  createMetaMark(@Body() body: any) {
    return { created: true, ...body };
  }

  @Post("verify")
  verify(@Body() body: { appointmentHash: string; paymentHash: string }) {
    return { verified: true, ...body };
  }

  @Get(":id/verify")
  verifyId(@Param("id") id: string) {
    return { id, valid: true };
  }

  @Put("")
  updateDoctor(@Body() body: { appointmentId: string; doctorId: string }) {
    return { updated: true, ...body };
  }

  @Patch(":id/confirm")
  confirm(@Param("id") id: string) {
    return { id, status: "CONFIRMED" };
  }

  @Post(":id/book")
  book(@Param("id") id: string) {
    return { id, status: "BOOKED" };
  }

  @Post(":id/finish")
  finish(@Param("id") id: string) {
    return { id, status: "FINISHED" };
  }

  @Get(":id/refund")
  refund(@Param("id") id: string) {
    return { id, refunded: true };
  }
}
