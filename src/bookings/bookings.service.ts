import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Booking } from "./bookings.entity";
import { Vaccine } from "../vaccines/entities/vaccine.entity";
import { Center } from "../centers/entities/center.entity";
import { User } from "../users/entities/user.entity";
import { Payment } from "../payments/payments.entity";
import { Appointment } from "../appointments/appointments.entity";

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
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>
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
    booking.patientId = patient.walletAddress;
    booking.patient = patient;
    if (request.familyMemberId) {
      booking.familyMemberId = request.familyMemberId;
    }
    booking.vaccineId = vaccine.id;
    booking.vaccine = vaccine;
    booking.centerId = center.id;
    booking.center = center;
    booking.firstDoseDate = request.firstDoseDate;
    booking.firstDoseTime = request.firstDoseTime;
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

    // For CASH payment, automatically mark as completed
    if (request.paymentMethod === "CASH") {
      savedPayment.status = "COMPLETED";
      await this.paymentRepo.save(savedPayment);

      // Update booking status to CONFIRMED
      saved.status = "CONFIRMED";
      await this.bookingRepo.save(saved);
    }

    // Return payment response (bookings table already stores the booking info)
    return {
      referenceId: saved.bookingId,
      bookingId: saved.bookingId,
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

    // Query bookings without collation issues - get relations separately
    const [bookings, total] = await this.bookingRepo.findAndCount({
      skip,
      take,
      order: { createdAt: "DESC" },
    });

    // Manually load relations to avoid collation mismatch
    const enrichedBookings = await Promise.all(
      bookings.map(async (booking) => {
        // Load patient
        const patient = await this.userRepo
          .createQueryBuilder("user")
          .where(
            "user.walletAddress COLLATE utf8mb4_general_ci = :walletAddress COLLATE utf8mb4_general_ci",
            { walletAddress: booking.patientId }
          )
          .getOne();

        // Load vaccine
        const vaccine = await this.vaccineRepo.findOne({
          where: { id: booking.vaccineId },
        });

        // Load center
        const center = await this.centerRepo.findOne({
          where: { id: booking.centerId },
        });

        // Load payment
        const payment = await this.paymentRepo.findOne({
          where: {
            referenceId: booking.bookingId,
            referenceType: "BOOKING",
          },
        });

        return {
          ...booking,
          patient,
          vaccine,
          center,
          payment,
        };
      })
    );

    return {
      result: enrichedBookings,
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
    // Get bookings for this patient
    const bookings = await this.bookingRepo.find({
      where: { patientId: patientWalletAddress },
      order: { createdAt: "DESC" },
    });

    // Manually load relations to avoid collation mismatch
    const enrichedBookings = await Promise.all(
      bookings.map(async (booking) => {
        // Load patient
        const patient = await this.userRepo
          .createQueryBuilder("user")
          .where(
            "user.walletAddress COLLATE utf8mb4_general_ci = :walletAddress COLLATE utf8mb4_general_ci",
            { walletAddress: booking.patientId }
          )
          .getOne();

        // Load vaccine
        const vaccine = await this.vaccineRepo.findOne({
          where: { id: booking.vaccineId },
        });

        // Load center
        const center = await this.centerRepo.findOne({
          where: { id: booking.centerId },
        });

        // Load payment
        const payment = await this.paymentRepo.findOne({
          where: {
            referenceId: booking.bookingId,
            referenceType: "BOOKING",
          },
        });

        return {
          ...booking,
          patient,
          vaccine,
          center,
          payment,
        };
      })
    );

    return enrichedBookings;
  }

  async getBookingById(bookingId: string) {
    try {
      // Get booking without relations first (avoid collation issues)
      const booking = await this.bookingRepo.findOne({
        where: { bookingId },
      });

      if (!booking) {
        throw new Error("Booking not found");
      }

      // Get patient separately with proper collation
      const patient = await this.userRepo
        .createQueryBuilder("user")
        .where(
          "user.walletAddress COLLATE utf8mb4_general_ci = :walletAddress COLLATE utf8mb4_general_ci",
          { walletAddress: booking.patientId }
        )
        .getOne();

      // Get vaccine
      const vaccine = await this.vaccineRepo.findOne({
        where: { id: booking.vaccineId },
      });

      // Get center
      const center = await this.centerRepo.findOne({
        where: { id: booking.centerId },
      });

      // Get payment info
      const payment = await this.paymentRepo.findOne({
        where: { referenceId: bookingId, referenceType: "BOOKING" as any },
      });

      return {
        bookingId: booking.bookingId,
        patientId: booking.patientId,
        vaccineId: booking.vaccineId,
        centerId: booking.centerId,
        totalDoses: booking.totalDoses,
        totalAmount: booking.totalAmount,
        status: booking.status,
        overallStatus: booking.overallStatus,
        createdAt: booking.createdAt,
        patient: patient || null,
        vaccine: vaccine || null,
        center: center || null,
        appointmentDate: booking.firstDoseDate || null,
        appointmentTime: booking.firstDoseTime || null,
        payment: payment || null,
      };
    } catch (error) {
      console.error("[BookingsService] Error in getBookingById:", error);
      throw error;
    }
  }
}
