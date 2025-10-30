import { Body, Controller, Get, Post } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Booking } from "./bookings.entity";
import { Vaccine } from "../vaccines/entities/vaccine.entity";
import { Center } from "../centers/entities/center.entity";

@Controller("bookings")
export class BookingsController {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Vaccine)
    private readonly vaccineRepo: Repository<Vaccine>,
    @InjectRepository(Center) private readonly centerRepo: Repository<Center>
  ) {}

  @Post()
  async create(
    @Body()
    body: {
      vaccineId?: string;
      centerId?: string;
      time?: string;
      firstDoseDate?: string;
      amount?: number | string;
      doseSchedules?: any;
      method?: string;
    }
  ) {
    const booking = new Booking();
    if (body.vaccineId) {
      booking.vaccine =
        (await this.vaccineRepo.findOne({ where: { id: body.vaccineId } })) ||
        undefined;
    }
    if (body.centerId) {
      booking.center =
        (await this.centerRepo.findOne({ where: { id: body.centerId } })) ||
        undefined;
    }
    booking.time = body.time;
    booking.firstDoseDate = body.firstDoseDate as any;
    booking.amount = (body.amount as any)?.toString?.() ?? (body.amount as any);
    booking.doseSchedules = body.doseSchedules;
    booking.method = body.method;
    booking.status = "PENDING";
    const saved = await this.bookingRepo.save(booking);
    return saved;
  }

  @Get()
  async list() {
    const items = await this.bookingRepo.find({
      relations: ["vaccine", "center"],
    });
    return items;
  }
}
