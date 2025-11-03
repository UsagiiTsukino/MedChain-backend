import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Booking } from "./bookings.entity";
import { Vaccine } from "../vaccines/entities/vaccine.entity";
import { Center } from "../centers/entities/center.entity";
import { User } from "../users/entities/user.entity";
import { Payment } from "../payments/payments.entity";

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Vaccine)
    private readonly vaccineRepo: Repository<Vaccine>,
    @InjectRepository(Center)
    private readonly centerRepo: Repository<Center>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>
  ) {}

  async createBooking(
    request: {
      vaccineId: string;
      centerId: string;
      familyMemberId?: string;
      firstDoseDate: string;
      firstDoseTime: string;
      amount: number;
      doseSchedules: Array<{ date: string; time: string; centerId: string }>;
      paymentMethod: string;
    },
    patientWalletAddress: string
  ) {
    const patient = await this.userRepo
      .createQueryBuilder("user")
      .where("user.walletAddress COLLATE utf8mb4_general_ci = :walletAddress", {
        walletAddress: patientWalletAddress,
      })
      .getOne();
    if (!patient) throw new Error("Patient not found");

    const vaccine = await this.vaccineRepo.findOne({
      where: { id: BigInt(request.vaccineId) as any },
    });
    if (!vaccine) throw new Error("Vaccine not found");

    const center = await this.centerRepo.findOne({
      where: { id: BigInt(request.centerId) as any },
    });
    if (!center) throw new Error("Center not found");

    const booking = new Booking();
    booking.patient = patient;
    if (request.familyMemberId) {
      booking.familyMemberId = request.familyMemberId;
    }
    booking.vaccine = vaccine;
    booking.totalAmount = request.amount;
    booking.status = "PENDING";
    booking.totalDoses = (request.doseSchedules?.length || 0) + 1;
    booking.overallStatus = "PROGRESS";

    const saved = await this.bookingRepo.save(booking);

    // Create payment
    const payment = new Payment();
    payment.referenceId = saved.bookingId;
    payment.referenceType = "BOOKING";
    payment.method = request.paymentMethod;
    payment.amount = request.amount;
    payment.currency = request.paymentMethod === "PAYPAL" ? "USD" : "VND";
    payment.status = "INITIATED";

    // Calculate payment amount based on method
    if (request.paymentMethod === "PAYPAL") {
      payment.amount = request.amount * 0.000041; // EXCHANGE_RATE_TO_USD
    } else if (request.paymentMethod === "METAMASK") {
      payment.amount = Math.round(request.amount / 200000.0);
    }

    const savedPayment = await this.paymentRepo.save(payment);

    // Note: Appointments will be created separately or via Appointment entity
    // For now, return payment response
    return {
      referenceId: saved.bookingId,
      paymentId: savedPayment.id,
      method: payment.method,
      amount: payment.amount,
      paymentURL:
        request.paymentMethod === "PAYPAL" ? "http://paypal.com/..." : null,
    };
  }

  async getAllBookings(page: number = 0, size: number = 10) {
    const take = Math.max(1, size);
    const skip = Math.max(0, page) * take;

    // Use QueryBuilder with explicit COLLATE in join condition to avoid collation issues
    // Join patient manually with COLLATE to fix collation mismatch
    const queryBuilder = this.bookingRepo
      .createQueryBuilder("booking")
      .leftJoinAndSelect(
        User,
        "patient",
        "patient.walletAddress COLLATE utf8mb4_general_ci = booking.patientId COLLATE utf8mb4_general_ci"
      )
      .leftJoinAndSelect(Vaccine, "vaccine", "vaccine.id = booking.vaccineId")
      .skip(skip)
      .take(take);

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      result: items,
      meta: {
        page: Math.floor(skip / take),
        pageSize: take,
        pages: Math.ceil(total / take),
        total,
      },
    };
  }

  async getBooking(patientWalletAddress: string) {
    const items = await this.bookingRepo
      .createQueryBuilder("booking")
      .leftJoinAndSelect(
        User,
        "patient",
        "patient.walletAddress COLLATE utf8mb4_general_ci = booking.patientId COLLATE utf8mb4_general_ci"
      )
      .leftJoinAndSelect(Vaccine, "vaccine", "vaccine.id = booking.vaccineId")
      .where(
        "patient.walletAddress COLLATE utf8mb4_general_ci = :walletAddress",
        { walletAddress: patientWalletAddress }
      )
      .andWhere("booking.overallStatus COLLATE utf8mb4_general_ci = :status", {
        status: "PROGRESS",
      })
      .getMany();
    return items;
  }

  async getHistoryBooking(patientWalletAddress: string) {
    const items = await this.bookingRepo
      .createQueryBuilder("booking")
      .leftJoinAndSelect(
        User,
        "patient",
        "patient.walletAddress COLLATE utf8mb4_general_ci = booking.patientId COLLATE utf8mb4_general_ci"
      )
      .leftJoinAndSelect(Vaccine, "vaccine", "vaccine.id = booking.vaccineId")
      .where(
        "patient.walletAddress COLLATE utf8mb4_general_ci = :walletAddress",
        { walletAddress: patientWalletAddress }
      )
      .getMany();
    return items;
  }
}
