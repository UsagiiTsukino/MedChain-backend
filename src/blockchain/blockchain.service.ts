import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";
import appointmentAbi from "./contract/VaccineAppointment.abi.json";
import paymentAbi from "./contract/VaxChainPayment.abi.json";

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  provider!: ethers.JsonRpcProvider;
  contract!: ethers.Contract; // VaccineAppointment contract
  paymentContract!: ethers.Contract; // VaxChainPayment contract
  signer!: ethers.Wallet;
  private blockchainEnabled = true;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    if (this.configService.get<string>("BLOCKCHAIN_ENABLED") === "false") {
      this.logger.warn(
        "Blockchain disabled via env (BLOCKCHAIN_ENABLED=false). Skipping init."
      );
      this.blockchainEnabled = false;
      return;
    }

    const rpcUrl = this.configService.get<string>("RPC_URL");
    const appointmentAddress =
      this.configService.get<string>("CONTRACT_ADDRESS");
    const paymentAddress = this.configService.get<string>(
      "PAYMENT_CONTRACT_ADDRESS"
    );
    const privateKey = this.configService.get<string>("PRIVATE_KEY");

    if (!rpcUrl) {
      this.logger.warn("RPC_URL not set. Skipping blockchain initialization.");
      this.blockchainEnabled = false;
      return;
    }

    if (!appointmentAddress || !ethers.isAddress(appointmentAddress)) {
      this.logger.warn(
        "CONTRACT_ADDRESS is missing or invalid. Skipping blockchain initialization."
      );
      this.blockchainEnabled = false;
      return;
    }

    if (!privateKey) {
      this.logger.warn(
        "DEPLOYER_PRIVATE_KEY not set. Contract will be read-only (no signer)."
      );
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    if (privateKey) {
      // create signer wallet and connect to provider
      this.signer = new ethers.Wallet(privateKey, this.provider);
      this.contract = new ethers.Contract(
        appointmentAddress,
        appointmentAbi as any,
        this.signer
      );

      // Initialize payment contract if address is provided
      if (paymentAddress && ethers.isAddress(paymentAddress)) {
        this.paymentContract = new ethers.Contract(
          paymentAddress,
          paymentAbi as any,
          this.signer
        );
        this.logger.log(
          `VaxChainPayment contract initialized at: ${paymentAddress}`
        );
      }

      this.logger.log(
        `BlockchainService initialized with signer: ${this.signer.address}`
      );
    } else {
      this.contract = new ethers.Contract(
        appointmentAddress,
        appointmentAbi as any,
        this.provider
      );

      if (paymentAddress && ethers.isAddress(paymentAddress)) {
        this.paymentContract = new ethers.Contract(
          paymentAddress,
          paymentAbi as any,
          this.provider
        );
      }

      this.logger.log(`BlockchainService initialized in read-only mode.`);
    }
  }

  /**
   * Check if blockchain is enabled
   */
  isEnabled(): boolean {
    return this.blockchainEnabled && !!this.contract;
  }

  /**
   * Get payment by booking ID from VaxChainPayment contract
   */
  async getPaymentByBooking(bookingId: string) {
    if (!this.paymentContract) {
      throw new Error("Payment contract not initialized");
    }
    return this.paymentContract.getPaymentByBooking(bookingId);
  }

  /**
   * Get certificate by booking ID from VaxChainPayment contract
   */
  async getCertificateByBooking(bookingId: string) {
    if (!this.paymentContract) {
      throw new Error("Payment contract not initialized");
    }
    return this.paymentContract.getCertificateByBooking(bookingId);
  }

  /**
   * Verify certificate by token ID
   */
  async verifyCertificate(tokenId: number) {
    if (!this.paymentContract) {
      throw new Error("Payment contract not initialized");
    }
    return this.paymentContract.verifyCertificate(tokenId);
  }

  /**
   * Mint NFT certificate for completed vaccination
   */
  async mintCertificate(
    patientAddress: string,
    bookingId: string,
    vaccineName: string,
    centerName: string,
    vaccinationDate: string,
    tokenURI: string
  ) {
    if (!this.paymentContract) {
      throw new Error("Payment contract not initialized");
    }

    const tx = await this.paymentContract.mintCertificate(
      patientAddress,
      bookingId,
      vaccineName,
      centerName,
      vaccinationDate,
      tokenURI
    );

    const receipt = await tx.wait();
    return {
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    };
  }
}
