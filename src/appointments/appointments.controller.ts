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

  // Additional endpoints to match frontend contract (temporary stubs/minimal)
  @Get()
  list() {
    return { items: [] };
  }

  @Get("center")
  listByCenter(@Query() query: any) {
    return { items: [], query };
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

  @Get("my-schedules")
  mySchedules() {
    return { items: [] };
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
