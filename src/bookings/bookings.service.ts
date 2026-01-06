import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Booking } from "./bookings.entity";
import { Vaccine } from "../vaccines/entities/vaccine.entity";
import { Center } from "../centers/entities/center.entity";
import { User } from "../users/entities/user.entity";
import { BookingPayment } from "../payments/entities/booking-payment.entity";
import { Appointment } from "../appointments/appointments.entity";
import { BlockchainService } from "../blockchain/blockchain.service";
import { ExchangeRateService } from "../common/services/exchange-rate.service";

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Vaccine)
    private readonly vaccineRepo: Repository<Vaccine>,
    @InjectRepository(Center)
    private readonly centerRepo: Repository<Center>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(BookingPayment)
    private readonly bookingPaymentRepo: Repository<BookingPayment>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    private readonly blockchainService: BlockchainService,
    private readonly exchangeRateService: ExchangeRateService
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
    booking.blockchainStatus = "PENDING";

    const saved = await this.bookingRepo.save(booking);

    // Create appointments for each dose
    const appointments: Appointment[] = [];

    // First dose appointment
    const firstAppointment = new Appointment();
    firstAppointment.bookingId = saved.bookingId;
    firstAppointment.centerId = center.id;
    firstAppointment.appointmentDate = request.firstDoseDate;
    firstAppointment.appointmentTime = request.firstDoseTime;
    firstAppointment.doseNumber = 1;
    firstAppointment.status = "SCHEDULED";
    appointments.push(firstAppointment);

    // Additional dose appointments from doseSchedules
    if (request.doseSchedules && request.doseSchedules.length > 0) {
      for (let i = 0; i < request.doseSchedules.length; i++) {
        const schedule = request.doseSchedules[i];
        const appointment = new Appointment();
        appointment.bookingId = saved.bookingId;
        appointment.centerId = schedule.centerId || center.id;
        appointment.appointmentDate = schedule.date;
        appointment.appointmentTime = schedule.time;
        appointment.doseNumber = i + 2; // 2nd dose, 3rd dose, etc.
        appointment.status = "SCHEDULED";
        appointments.push(appointment);
      }
    }

    // Save all appointments
    await this.appointmentRepo.save(appointments);
    this.logger.log(
      `Created ${appointments.length} appointments for booking ${saved.bookingId}`
    );

    // ============ BLOCKCHAIN INTEGRATION ============
    // Record booking on blockchain for transparency and immutability
    let blockchainTxHash: string | null = null;
    let blockchainAppointmentId: string | null = null;

    try {
      if (!this.blockchainService.contract) {
        this.logger.warn(
          "Blockchain contract not initialized. Check if Ganache is running and .env is configured correctly."
        );
        this.logger.warn(`- RPC_URL: ${process.env.RPC_URL}`);
        this.logger.warn(`- CONTRACT_ADDRESS: ${process.env.CONTRACT_ADDRESS}`);
        this.logger.warn(
          `- BLOCKCHAIN_ENABLED: ${process.env.BLOCKCHAIN_ENABLED}`
        );
        saved.blockchainStatus = "SKIPPED";
        await this.bookingRepo.save(saved);
      } else {
        this.logger.log(
          `Recording booking ${saved.bookingId} on blockchain...`
        );
        this.logger.log(`- Patient wallet: ${patient.walletAddress}`);
        this.logger.log(
          `- Patient MetaMask: ${patient.metamaskWallet || "Not connected"}`
        );
        this.logger.log(
          `- Contract address: ${this.blockchainService.contract.target}`
        );

        // Use MetaMask wallet if available, otherwise skip blockchain
        if (!patient.metamaskWallet) {
          this.logger.warn(
            `User has not connected MetaMask wallet, skipping blockchain`
          );
          saved.blockchainStatus = "SKIPPED";
          await this.bookingRepo.save(saved);
        } else {
          // Validate wallet address before calling contract
          const { ethers } = await import("ethers");
          let patientAddr = patient.metamaskWallet;

          // Check if it's a valid Ethereum address
          if (!ethers.isAddress(patientAddr)) {
            this.logger.warn(
              `Invalid MetaMask wallet address: ${patientAddr}, skipping blockchain`
            );
            saved.blockchainStatus = "SKIPPED";
            await this.bookingRepo.save(saved);
          } else {
            // Ensure address is checksummed
            patientAddr = ethers.getAddress(patientAddr);

            // Call smart contract to create appointment
            const tx = await this.blockchainService.contract.createAppointment(
              vaccine.name,
              center.name,
              request.firstDoseDate,
              request.firstDoseTime,
              patientAddr,
              Math.round(request.amount) // price in VND as uint256
            );

            // Wait for transaction confirmation
            const receipt = await tx.wait();
            blockchainTxHash = receipt.hash || receipt.transactionHash;

            // Parse event to get appointmentId
            const event = receipt.logs?.find((log: any) => {
              try {
                const parsed =
                  this.blockchainService.contract.interface.parseLog(log);
                return parsed?.name === "AppointmentCreated";
              } catch {
                return false;
              }
            });

            if (event) {
              const parsed =
                this.blockchainService.contract.interface.parseLog(event);
              blockchainAppointmentId = parsed?.args?.appointmentId?.toString();
            }

            // Update booking with blockchain info
            saved.blockchainTxHash = blockchainTxHash;
            saved.blockchainAppointmentId = blockchainAppointmentId;
            saved.blockchainStatus = "CONFIRMED";
            await this.bookingRepo.save(saved);

            this.logger.log(
              `Blockchain record created: txHash=${blockchainTxHash}, appointmentId=${blockchainAppointmentId}`
            );
          }
        }
      }
    } catch (blockchainError: any) {
      this.logger.error(`Blockchain error for booking ${saved.bookingId}:`);
      this.logger.error(
        `- Error message: ${blockchainError?.message || blockchainError}`
      );
      this.logger.error(
        `- Error stack: ${blockchainError?.stack || "No stack trace"}`
      );
      saved.blockchainStatus = "FAILED";
      await this.bookingRepo.save(saved);
      // Don't throw - booking is still valid in database
    }
    // ============ END BLOCKCHAIN INTEGRATION ============

    // Create payment
    const payment = new BookingPayment();
    payment.bookingId = saved.bookingId;
    payment.booking = saved;
    payment.method = request.paymentMethod;
    payment.status = "INITIATED";

    // Calculate payment amount and currency based on method
    if (request.paymentMethod === "PAYPAL") {
      // Convert VND to USD using dynamic exchange rate
      payment.amount = await this.exchangeRateService.convertVndToUsd(
        request.amount
      );
      payment.currency = "USD";
    } else if (request.paymentMethod === "METAMASK") {
      // Convert VND to ETH using dynamic exchange rate
      payment.amount = await this.exchangeRateService.convertVndToEth(
        request.amount
      );
      payment.currency = "ETH";
    } else {
      // CASH or BANK_TRANSFER - keep VND
      payment.amount = request.amount;
      payment.currency = "VND";
    }

    const savedPayment = await this.bookingPaymentRepo.save(payment);

    // For CASH payment, automatically mark as completed
    if (request.paymentMethod === "CASH") {
      savedPayment.status = "COMPLETED";
      await this.bookingPaymentRepo.save(savedPayment);

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
      // Blockchain info
      blockchain: {
        txHash: blockchainTxHash,
        appointmentId: blockchainAppointmentId,
        status: saved.blockchainStatus,
      },
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
        const payment = await this.bookingPaymentRepo.findOne({
          where: {
            bookingId: booking.bookingId,
          },
        });

        // Load appointments with doctor info
        const appointments = await this.appointmentRepo
          .createQueryBuilder("appointment")
          .where("appointment.bookingId = :bookingId", {
            bookingId: booking.bookingId,
          })
          .orderBy("appointment.doseNumber", "ASC")
          .getMany();

        // Load doctor for each appointment
        const appointmentsWithDoctor = await Promise.all(
          appointments.map(async (appointment) => {
            if (appointment.doctorId) {
              const doctor = await this.userRepo
                .createQueryBuilder("user")
                .where(
                  "user.walletAddress COLLATE utf8mb4_general_ci = :walletAddress COLLATE utf8mb4_general_ci",
                  { walletAddress: appointment.doctorId }
                )
                .getOne();
              return { ...appointment, doctor };
            }
            return appointment;
          })
        );

        // Calculate progress
        const totalDoses = appointments.length;
        const completedDoses = appointments.filter(
          (a) => a.status === "COMPLETED"
        ).length;
        const nextDose = appointments.find(
          (a) =>
            a.status === "SCHEDULED" ||
            a.status === "ASSIGNED" ||
            a.status === "CONFIRMED"
        );

        return {
          ...booking,
          patient,
          vaccine,
          center,
          payment,
          appointments: appointmentsWithDoctor,
          progress: {
            totalDoses,
            completedDoses,
            percentComplete:
              totalDoses > 0 ? (completedDoses / totalDoses) * 100 : 0,
            nextDose: nextDose
              ? {
                  appointmentId: nextDose.appointmentId,
                  doseNumber: nextDose.doseNumber,
                  date: nextDose.appointmentDate,
                  time: nextDose.appointmentTime,
                  status: nextDose.status,
                }
              : null,
          },
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
        const payment = await this.bookingPaymentRepo.findOne({
          where: {
            bookingId: booking.bookingId,
          },
        });

        // Load appointments to calculate progress
        const appointments = await this.appointmentRepo.find({
          where: { bookingId: booking.bookingId },
          order: { doseNumber: "ASC" },
        });

        // Load doctor info for each appointment
        const appointmentsWithDoctor = await Promise.all(
          appointments.map(async (appointment) => {
            if (appointment.doctorId) {
              const doctor = await this.userRepo
                .createQueryBuilder("user")
                .where(
                  "user.walletAddress COLLATE utf8mb4_general_ci = :walletAddress COLLATE utf8mb4_general_ci",
                  { walletAddress: appointment.doctorId }
                )
                .getOne();
              return {
                ...appointment,
                doctor: doctor
                  ? {
                      walletAddress: doctor.walletAddress,
                      fullName: doctor.fullName,
                      email: doctor.email,
                      phoneNumber: doctor.phoneNumber,
                    }
                  : null,
              };
            }
            return appointment;
          })
        );

        const totalDoses = appointments.length;
        const completedDoses = appointments.filter(
          (a) => a.status === "COMPLETED"
        ).length;
        const nextDose = appointments.find(
          (a) =>
            a.status === "SCHEDULED" ||
            a.status === "ASSIGNED" ||
            a.status === "CONFIRMED"
        );

        return {
          ...booking,
          patient,
          vaccine,
          center,
          payment,
          appointments: appointmentsWithDoctor, // Include appointments with doctor info
          progress: {
            totalDoses,
            completedDoses,
            percentComplete:
              totalDoses > 0 ? (completedDoses / totalDoses) * 100 : 0,
            nextDose: nextDose
              ? {
                  appointmentId: nextDose.appointmentId,
                  doseNumber: nextDose.doseNumber,
                  date: nextDose.appointmentDate,
                  time: nextDose.appointmentTime,
                  status: nextDose.status,
                }
              : null,
          },
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
      const payment = await this.bookingPaymentRepo.findOne({
        where: { bookingId: bookingId },
      });

      // Get all appointments for this booking to calculate progress
      const appointments = await this.appointmentRepo.find({
        where: { bookingId },
        order: { doseNumber: "ASC" },
      });

      const totalDoses = appointments.length;
      const completedDoses = appointments.filter(
        (a) => a.status === "COMPLETED"
      ).length;

      // Find next scheduled appointment
      const nextDose = appointments.find(
        (a) =>
          a.status === "SCHEDULED" ||
          a.status === "ASSIGNED" ||
          a.status === "CONFIRMED"
      );

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
        firstDoseDate: booking.firstDoseDate || null,
        firstDoseTime: booking.firstDoseTime || null,
        payment: payment || null,
        // Progress tracking
        progress: {
          totalDoses,
          completedDoses,
          percentComplete:
            totalDoses > 0 ? (completedDoses / totalDoses) * 100 : 0,
          nextDose: nextDose
            ? {
                appointmentId: nextDose.appointmentId,
                doseNumber: nextDose.doseNumber,
                date: nextDose.appointmentDate,
                time: nextDose.appointmentTime,
                status: nextDose.status,
              }
            : null,
        },
        // Appointments list
        appointments: appointments.map((a) => ({
          appointmentId: a.appointmentId,
          doseNumber: a.doseNumber,
          date: a.appointmentDate,
          time: a.appointmentTime,
          status: a.status,
          doctorId: a.doctorId,
          centerId: a.centerId,
        })),
        // Blockchain info
        blockchain: {
          txHash: booking.blockchainTxHash || null,
          appointmentId: booking.blockchainAppointmentId || null,
          status: booking.blockchainStatus || null,
        },
      };
    } catch (error) {
      console.error("[BookingsService] Error in getBookingById:", error);
      throw error;
    }
  }

  // ============ BLOCKCHAIN VERIFICATION ============
  async verifyBookingOnChain(bookingId: string) {
    const booking = await this.bookingRepo.findOne({ where: { bookingId } });
    if (!booking) throw new Error("Booking not found");
    if (!booking.blockchainAppointmentId) {
      return { verified: false, reason: "No blockchain record" };
    }

    try {
      if (!this.blockchainService.contract) {
        return { verified: false, reason: "Blockchain not available" };
      }

      const onChainData = await this.blockchainService.contract.getAppointment(
        BigInt(booking.blockchainAppointmentId)
      );

      return {
        verified: true,
        onChainData: {
          appointmentId: onChainData.appointmentId.toString(),
          vaccineName: onChainData.vaccineName,
          centerName: onChainData.centerName,
          patientAddress: onChainData.patientAddress,
          date: onChainData.date,
          time: onChainData.time,
          price: onChainData.price.toString(),
          status: [
            "PENDING",
            "PROCESSING",
            "COMPLETED",
            "CANCELLED",
            "REFUNDED",
          ][onChainData.status],
        },
        txHash: booking.blockchainTxHash,
      };
    } catch (error) {
      this.logger.error(`Verification error: ${error}`);
      return { verified: false, reason: "Failed to verify on chain" };
    }
  }
}
