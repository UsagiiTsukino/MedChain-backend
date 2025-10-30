import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BlockchainService } from "../blockchain/blockchain.service";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";
import { Vaccine } from "../vaccines/entities/vaccine.entity";
import { Center } from "../centers/entities/center.entity";

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly blockchainService: BlockchainService,
    @InjectRepository(Vaccine)
    private readonly vaccineRepository: Repository<Vaccine>,
    @InjectRepository(Center)
    private readonly centerRepository: Repository<Center>
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
    if (!this.blockchainService.contract)
      throw new Error("Blockchain not available");
    const tx = await this.blockchainService.contract.processAppointment(
      appointmentId,
      doctorAddress,
      cashierAddress
    );
    const receipt = await tx.wait();
    return {
      message: "Appointment processed",
      transactionHash: receipt.transactionHash ?? receipt.hash,
    };
  }

  async complete(appointmentId: bigint) {
    if (!this.blockchainService.contract)
      throw new Error("Blockchain not available");
    const tx = await this.blockchainService.contract.completeAppointment(
      appointmentId
    );
    const receipt = await tx.wait();
    return {
      message: "Appointment completed",
      transactionHash: receipt.transactionHash ?? receipt.hash,
    };
  }

  async cancel(appointmentId: bigint) {
    if (!this.blockchainService.contract)
      throw new Error("Blockchain not available");
    const tx = await this.blockchainService.contract.cancelAppointment(
      appointmentId
    );
    const receipt = await tx.wait();
    return {
      message: "Appointment cancelled",
      transactionHash: receipt.transactionHash ?? receipt.hash,
    };
  }
}
