import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Not, IsNull } from "typeorm";
import { BlockchainService } from "../blockchain/blockchain.service";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";
import { Vaccine } from "../vaccines/entities/vaccine.entity";
import { Center } from "../centers/entities/center.entity";
import { Appointment } from "./appointments.entity";
import { User } from "../users/entities/user.entity";
import { Booking } from "../bookings/bookings.entity";

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly blockchainService: BlockchainService,
    @InjectRepository(Vaccine)
    private readonly vaccineRepository: Repository<Vaccine>,
    @InjectRepository(Center)
    private readonly centerRepository: Repository<Center>,
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>
  ) {}

  async create(dto: CreateAppointmentDto, patientWalletAddress: string) {
    const vaccine = await this.vaccineRepository.findOneBy({
      id: dto.vaccineId,
    });
    const center = await this.centerRepository.findOneBy({ id: dto.centerId });

    if (!vaccine)
      throw new NotFoundException(`Vaccine ${dto.vaccineId} not found`);
    if (!center)
      throw new NotFoundException(`Center ${dto.centerId} not found`);

    if (!this.blockchainService.contract) {
      this.logger.warn("Blockchain contract not initialized");
      throw new Error("Blockchain not available");
    }

    const tx = await this.blockchainService.contract.createAppointment(
      vaccine.name,
      center.name,
      dto.date,
      dto.time,
      patientWalletAddress
    );

    const receipt = await tx.wait();
    return { transactionHash: receipt.transactionHash ?? receipt.hash };
  }

  async process(
    appointmentId: bigint,
    doctorAddress: string,
    cashierAddress: string
  ) {
    // Find appointment in database (without doctor relation to avoid collation error)
    const appointment = await this.appointmentRepository.findOne({
      where: { appointmentId: appointmentId.toString() },
      relations: ["booking", "center"],
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment ${appointmentId} not found`);
    }

    // Check if already assigned to a doctor (ASSIGNED or CONFIRMED status)
    if (
      appointment.doctorId &&
      (appointment.status === "ASSIGNED" || appointment.status === "CONFIRMED")
    ) {
      throw new Error(
        `Appointment already assigned to doctor ${
          appointment.doctor?.fullName || appointment.doctorId
        }. Please unassign first.`
      );
    }

    // Verify doctor and cashier exist
    const doctor = await this.userRepository.findOne({
      where: { walletAddress: doctorAddress },
    });
    if (!doctor) {
      throw new NotFoundException(`Doctor ${doctorAddress} not found`);
    }

    // Update appointment with doctor assignment - status ASSIGNED (waiting for doctor to accept)
    appointment.doctorId = doctorAddress;
    appointment.status = "ASSIGNED";
    await this.appointmentRepository.save(appointment);

    // Update booking doctorAssigned flag and overall status
    if (appointment.booking) {
      appointment.booking.doctorAssigned = true;
      await this.bookingRepository.save(appointment.booking);
    }

    await this.updateBookingOverallStatus(appointment.bookingId);

    this.logger.log(
      `Appointment ${appointmentId} assigned to doctor ${doctorAddress} with status ASSIGNED`
    );

    return {
      message: "Appointment processed successfully",
      appointmentId: appointment.appointmentId,
      doctorId: appointment.doctorId,
      status: appointment.status,
    };
  }

  /**
   * Doctor confirms acceptance of the assigned case
   * Only ASSIGNED appointments can be confirmed
   */
  async confirmAcceptance(appointmentId: bigint, doctorId: string) {
    const appointment = await this.appointmentRepository.findOne({
      where: { appointmentId: appointmentId.toString() },
      relations: ["booking"],
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment ${appointmentId} not found`);
    }

    // Verify this is the assigned doctor
    if (appointment.doctorId !== doctorId) {
      throw new Error("You are not authorized to confirm this appointment");
    }

    // Only ASSIGNED appointments can be confirmed
    if (appointment.status !== "ASSIGNED") {
      throw new Error(
        `Cannot confirm appointment with status ${appointment.status}. Must be ASSIGNED.`
      );
    }

    appointment.status = "CONFIRMED";
    await this.appointmentRepository.save(appointment);

    // Update booking overall status
    await this.updateBookingOverallStatus(appointment.bookingId);

    this.logger.log(
      `Appointment ${appointmentId} confirmed by doctor ${doctorId}`
    );

    return {
      message: "Appointment confirmed successfully",
      appointmentId: appointment.appointmentId,
      status: appointment.status,
    };
  }

  /**
   * Unassign doctor from appointment (when doctor rejects or needs reassignment)
   * Only allowed if status is ASSIGNED (before doctor accepts)
   */
  async unassignDoctor(appointmentId: bigint) {
    this.logger.log(
      `[unassignDoctor] Called with appointmentId: ${appointmentId}`
    );

    // Load appointment WITHOUT doctor relation to avoid collation error
    const appointment = await this.appointmentRepository.findOne({
      where: { appointmentId: appointmentId.toString() },
      relations: ["booking"],
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment ${appointmentId} not found`);
    }

    this.logger.log(
      `[unassignDoctor] Found appointment with status: ${appointment.status}, doctorId: ${appointment.doctorId}`
    );

    if (!appointment.doctorId) {
      throw new Error("Appointment has no doctor assigned");
    }

    // Only ASSIGNED status can be unassigned (before doctor accepts)
    if (appointment.status !== "ASSIGNED") {
      throw new Error(
        `Cannot unassign doctor - appointment status is ${appointment.status}. Only ASSIGNED appointments can be unassigned.`
      );
    }

    const previousDoctorId = appointment.doctorId;

    // Remove doctor assignment and reset status
    appointment.doctorId = null;
    appointment.status = "SCHEDULED";
    const savedAppointment = await this.appointmentRepository.save(appointment);

    this.logger.log(
      `[unassignDoctor] Saved appointment, doctorId now: ${savedAppointment.doctorId}, status: ${savedAppointment.status}`
    );

    // Check if booking still has any other appointments with doctors
    // Must use the appointmentId from saved entity to ensure type consistency
    if (appointment.booking) {
      const otherAppointmentsWithDoctor =
        await this.appointmentRepository.count({
          where: {
            bookingId: appointment.bookingId,
            appointmentId: Not(savedAppointment.appointmentId),
            doctorId: Not(IsNull()),
          },
        });

      // If no other appointments have doctors, set doctorAssigned to false
      if (otherAppointmentsWithDoctor === 0) {
        appointment.booking.doctorAssigned = false;
        await this.bookingRepository.save(appointment.booking);
      }
    }

    // Update booking overall status
    await this.updateBookingOverallStatus(appointment.bookingId);

    this.logger.log(
      `Appointment ${appointmentId} unassigned from doctor ${previousDoctorId}`
    );

    return {
      message: "Doctor unassigned successfully",
      appointmentId: appointment.appointmentId,
      previousDoctor: previousDoctorId,
      status: appointment.status,
    };
  }

  async complete(appointmentId: bigint) {
    const appointment = await this.appointmentRepository.findOneBy({
      appointmentId: appointmentId.toString(),
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment ${appointmentId} not found`);
    }

    // Only CONFIRMED appointments can be completed
    if (appointment.status !== "CONFIRMED") {
      throw new Error(
        `Cannot complete appointment with status ${appointment.status}. Must be CONFIRMED first.`
      );
    }

    appointment.status = "COMPLETED";
    await this.appointmentRepository.save(appointment);

    // Update booking overall status
    await this.updateBookingOverallStatus(appointment.bookingId);

    this.logger.log(`Appointment ${appointmentId} marked as completed`);

    return {
      message: "Appointment completed successfully",
      appointmentId: appointment.appointmentId,
      status: appointment.status,
    };
  }

  async cancel(appointmentId: bigint) {
    const appointment = await this.appointmentRepository.findOne({
      where: { appointmentId: appointmentId.toString() },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment ${appointmentId} not found`);
    }

    appointment.status = "CANCELLED";
    await this.appointmentRepository.save(appointment);

    this.logger.log(`Appointment ${appointmentId} cancelled`);

    return {
      message: "Appointment cancelled successfully",
      appointmentId: appointment.appointmentId,
      status: appointment.status,
    };
  }

  /**
   * Get all appointments by center (for staff/cashier)
   */
  async getAppointmentsByCenter(centerId: string, page = 0, size = 10) {
    const [appointments, total] = await this.appointmentRepository.findAndCount(
      {
        where: { centerId },
        relations: [
          "booking",
          "booking.patient",
          "booking.vaccine",
          "center",
          "doctor",
        ],
        skip: page * size,
        take: size,
        order: { appointmentDate: "DESC", createdAt: "DESC" },
      }
    );

    // Transform to match frontend expected format
    const result = appointments.map((apt) => ({
      id: apt.appointmentId,
      appointmentId: apt.appointmentId,
      patientName: apt.booking?.patient?.fullName || "N/A",
      vaccineName: apt.booking?.vaccine?.name || "N/A",
      centerName: apt.center?.name || "N/A",
      scheduledDate: apt.appointmentDate,
      scheduledTime: apt.appointmentTime,
      doctorName: apt.doctor?.fullName || null,
      cashierName: null, // TODO: Add cashier relation if needed
      status: apt.status,
      doseNumber: apt.doseNumber,
    }));

    return {
      result,
      meta: {
        page,
        pageSize: size,
        total,
        pages: Math.ceil(total / size),
      },
    };
  }

  /**
   * Get appointments assigned to a doctor (for doctor's schedule)
   */
  async getMySchedule(doctorId: string, page = 0, size = 10) {
    this.logger.log(
      `[getMySchedule] Called with doctorId: ${doctorId}, page: ${page}, size: ${size}`
    );

    // Use query builder to avoid collation issues with doctorId
    const queryBuilder = this.appointmentRepository
      .createQueryBuilder("appointment")
      .leftJoinAndSelect("appointment.booking", "booking")
      .leftJoinAndSelect("booking.patient", "patient")
      .leftJoinAndSelect("booking.vaccine", "vaccine")
      .leftJoinAndSelect("appointment.center", "center")
      .where("appointment.doctorId COLLATE utf8mb4_general_ci = :doctorId", {
        doctorId,
      })
      .orderBy("appointment.appointmentDate", "ASC")
      .addOrderBy("appointment.appointmentTime", "ASC")
      .skip(page * size)
      .take(size);

    // Log the generated SQL for debugging
    const sql = queryBuilder.getSql();
    this.logger.log(`[getMySchedule] Generated SQL: ${sql}`);

    const [appointments, total] = await queryBuilder.getManyAndCount();

    this.logger.log(
      `[getMySchedule] Found ${total} appointments for doctor ${doctorId}`
    );

    const result = appointments.map((apt) => ({
      id: apt.appointmentId,
      appointmentId: apt.appointmentId,
      patientName: apt.booking?.patient?.fullName || "N/A",
      patientAddress: apt.booking?.patient?.walletAddress || null,
      patientPhone: apt.booking?.patient?.phoneNumber || "N/A",
      patientEmail: apt.booking?.patient?.email || "N/A",
      vaccineName: apt.booking?.vaccine?.name || "N/A",
      centerName: apt.center?.name || "N/A",
      scheduledDate: apt.appointmentDate,
      scheduledTime: apt.appointmentTime,
      status: apt.status,
      doseNumber: apt.doseNumber,
      totalDoses: apt.booking?.totalDoses || 1,
      notes: apt.notes || "",
    }));

    return {
      result,
      meta: {
        page,
        pageSize: size,
        total,
        pages: Math.ceil(total / size),
      },
    };
  }

  /**
   * Update booking overall status based on all its appointments
   * This method calculates the aggregate status of all appointments in a booking
   */
  private async updateBookingOverallStatus(bookingId: string) {
    // Get all appointments for this booking
    const appointments = await this.appointmentRepository.find({
      where: { bookingId },
    });

    if (!appointments || appointments.length === 0) {
      this.logger.warn(`No appointments found for booking ${bookingId}`);
      return;
    }

    const totalDoses = appointments.length;
    const completedDoses = appointments.filter(
      (a) => a.status === "COMPLETED"
    ).length;
    const confirmedOrCompletedDoses = appointments.filter(
      (a) => a.status === "COMPLETED" || a.status === "CONFIRMED"
    ).length;

    let overallStatus = "PENDING";

    if (completedDoses === totalDoses) {
      // ALL doses completed
      overallStatus = "COMPLETED";

      // Mint NFT certificate when all doses are completed
      await this.mintCertificateForCompletedBooking(bookingId, appointments[0]);
    } else if (confirmedOrCompletedDoses > 0) {
      // At least one dose in progress or completed
      overallStatus = "PROGRESS";
    } else if (appointments.some((a) => a.status === "ASSIGNED")) {
      // At least one dose assigned to doctor
      overallStatus = "ASSIGNED";
    }

    // Update booking
    await this.bookingRepository.update(bookingId, { overallStatus });

    this.logger.log(
      `Updated booking ${bookingId} overall status to ${overallStatus} (${completedDoses}/${totalDoses} doses completed)`
    );
  }

  /**
   * Get all appointments for a specific booking
   * Useful for tracking multi-dose vaccination progress
   * @param bookingId - The ID of the booking
   * @returns Array of appointments with doctor and center information
   */
  async getAppointmentsByBooking(bookingId: string) {
    const appointments = await this.appointmentRepository.find({
      where: { bookingId },
      relations: ["center"],
      order: { doseNumber: "ASC" },
    });

    // Get doctor information separately to avoid collation issues
    const result = await Promise.all(
      appointments.map(async (appointment) => {
        let doctor = null;
        if (appointment.doctorId) {
          doctor = await this.userRepository
            .createQueryBuilder("user")
            .where(
              "user.walletAddress COLLATE utf8mb4_general_ci = :walletAddress COLLATE utf8mb4_general_ci",
              { walletAddress: appointment.doctorId }
            )
            .getOne();
        }

        return {
          appointmentId: appointment.appointmentId,
          bookingId: appointment.bookingId,
          doseNumber: appointment.doseNumber,
          appointmentDate: appointment.appointmentDate,
          appointmentTime: appointment.appointmentTime,
          status: appointment.status,
          center: appointment.center,
          doctor: doctor
            ? {
                walletAddress: doctor.walletAddress,
                fullName: doctor.fullName,
                email: doctor.email,
              }
            : null,
          notes: appointment.notes,
          createdAt: appointment.createdAt,
          updatedAt: appointment.updatedAt,
        };
      })
    );

    return result;
  }

  /**
   * Mint NFT certificate when all vaccination doses are completed
   */
  private async mintCertificateForCompletedBooking(
    bookingId: string,
    firstAppointment: Appointment
  ) {
    try {
      this.logger.log(
        `[mintCertificate] Starting mint process for booking ${bookingId}`
      );

      // Get booking with patient information
      const booking = await this.bookingRepository.findOne({
        where: { bookingId },
        relations: ["patient", "vaccine", "center"],
      });

      if (!booking || !booking.patient) {
        this.logger.warn(
          `[mintCertificate] Cannot mint certificate: booking ${bookingId} or patient not found`
        );
        return;
      }

      // Check if certificate already minted
      if (booking.nftTokenId) {
        this.logger.log(
          `[mintCertificate] Certificate already minted for booking ${bookingId}, token ID: ${booking.nftTokenId}`
        );
        return;
      }

      const patient = booking.patient;

      // Use MetaMask wallet if available, otherwise fall back to wallet address
      const ethAddress = patient.metamaskWallet || patient.walletAddress;

      // Check if patient has valid Ethereum wallet address
      if (!ethAddress) {
        this.logger.warn(
          `[mintCertificate] Cannot mint certificate: patient ${
            patient.walletAddress || "unknown"
          } has no wallet address`
        );
        return;
      }

      // Validate Ethereum address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(ethAddress)) {
        this.logger.error(
          `[mintCertificate] Invalid Ethereum address format: ${ethAddress}. Wallet must start with 0x and have 40 hex characters.`
        );
        return;
      }

      this.logger.log(
        `[mintCertificate] Patient wallet: ${ethAddress} ${
          patient.metamaskWallet ? "(MetaMask)" : "(Primary)"
        }`
      );

      // Get all appointments to count doses
      const allAppointments = await this.appointmentRepository.find({
        where: { bookingId },
      });

      this.logger.log(
        `[mintCertificate] Total doses: ${allAppointments.length}`
      );
      this.logger.log(`[mintCertificate] Vaccine: ${booking.vaccine?.name}`);
      this.logger.log(`[mintCertificate] Center: ${booking.center?.name}`);

      // Mint NFT certificate
      this.logger.log(
        `[mintCertificate] Calling BlockchainService.mintCertificate...`
      );
      const result = await this.blockchainService.mintCertificate(
        ethAddress, // Use validated Ethereum address (MetaMask or primary)
        bookingId,
        patient.fullName || "Patient",
        booking.vaccine?.name || "Unknown Vaccine",
        booking.center?.name || "Unknown Center",
        firstAppointment.appointmentDate,
        allAppointments.length // Total doses
      );

      this.logger.log(
        `[mintCertificate] ✅ NFT Certificate minted successfully!`
      );
      this.logger.log(`[mintCertificate] Token ID: ${result.tokenId}`);
      this.logger.log(`[mintCertificate] Token URI: ${result.tokenURI}`);
      this.logger.log(
        `[mintCertificate] Transaction Hash: ${result.transactionHash}`
      );
      this.logger.log(`[mintCertificate] Block Number: ${result.blockNumber}`);

      // Update booking with NFT info (manual update since TypeORM strict mode)
      this.logger.log(
        `[mintCertificate] Updating booking ${bookingId} with NFT info...`
      );
      this.logger.log(
        `[mintCertificate] Saving Token ID: ${result.tokenId}, Transaction Hash: ${result.transactionHash}`
      );
      const updateResult = await this.bookingRepository
        .createQueryBuilder()
        .update(Booking)
        .set({
          nftTokenId: result.tokenId,
          nftTransactionHash: result.transactionHash,
        } as any) // Type assertion to bypass TypeORM strict checking
        .where("bookingId = :bookingId", { bookingId })
        .execute();

      this.logger.log(
        `[mintCertificate] ✅ Database updated. Affected rows: ${updateResult.affected}`
      );

      if (updateResult.affected === 0) {
        this.logger.error(
          `[mintCertificate] ⚠️ WARNING: Database update affected 0 rows! Booking ${bookingId} may not exist.`
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : "";
      this.logger.error(
        `[mintCertificate] ❌ Failed to mint certificate for booking ${bookingId}`
      );
      this.logger.error(`[mintCertificate] Error message: ${errorMessage}`);
      this.logger.error(`[mintCertificate] Error stack: ${errorStack}`);
      // Don't throw error, allow booking completion to proceed
    }
  }
}
