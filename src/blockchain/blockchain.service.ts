import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";
import appointmentAbi from "./contract/VaccineAppointment.abi.json";
import paymentAbi from "./contract/VaxChainPayment.abi.json";
import { IpfsService } from "../ipfs/ipfs.service";

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);

  provider!: ethers.JsonRpcProvider;
  contract!: ethers.Contract; // VaccineAppointment contract
  paymentContract!: ethers.Contract; // VaxChainPayment contract
  signer!: ethers.Wallet;
  private blockchainEnabled = true;

  constructor(
    private readonly configService: ConfigService,
    private readonly ipfsService: IpfsService
  ) {}

  onModuleInit() {
    if (this.configService.get<string>("BLOCKCHAIN_ENABLED") === "false") {
      this.logger.warn(
        "Blockchain disabled via env (BLOCKCHAIN_ENABLED=false). Skipping init."
      );
      this.blockchainEnabled = false;
      return;
    }

    const rpcUrl =
      this.configService.get<string>("RPC_URL") ||
      this.configService.get<string>("BLOCKCHAIN_RPC_URL");
    const appointmentAddress =
      this.configService.get<string>("CONTRACT_ADDRESS") ||
      this.configService.get<string>("CONTRACT_ADDRESS_APPOINTMENT");
    const paymentAddress =
      this.configService.get<string>("PAYMENT_CONTRACT_ADDRESS") ||
      this.configService.get<string>("CONTRACT_ADDRESS_PAYMENT");
    const privateKey =
      this.configService.get<string>("PRIVATE_KEY") ||
      this.configService.get<string>("DEPLOYER_PRIVATE_KEY");

    this.logger.log(`[Init] RPC URL: ${rpcUrl ? "✅ Found" : "❌ Missing"}`);
    this.logger.log(
      `[Init] Appointment Contract: ${
        appointmentAddress ? "✅ " + appointmentAddress : "❌ Missing"
      }`
    );
    this.logger.log(
      `[Init] Payment Contract: ${
        paymentAddress ? "✅ " + paymentAddress : "❌ Missing"
      }`
    );
    this.logger.log(
      `[Init] Private Key: ${
        privateKey
          ? "✅ Found (" + privateKey.substring(0, 10) + "...)"
          : "❌ Missing"
      }`
    );

    if (!rpcUrl) {
      this.logger.error(
        "❌ RPC_URL not set. Skipping blockchain initialization."
      );
      this.blockchainEnabled = false;
      return;
    }

    if (!appointmentAddress || !ethers.isAddress(appointmentAddress)) {
      this.logger.error(
        "❌ CONTRACT_ADDRESS is missing or invalid. Skipping blockchain initialization."
      );
      this.blockchainEnabled = false;
      return;
    }

    if (!paymentAddress || !ethers.isAddress(paymentAddress)) {
      this.logger.error(
        "❌ PAYMENT_CONTRACT_ADDRESS is missing or invalid. NFT minting will NOT work!"
      );
      // Don't disable blockchain entirely, just paymentContract will be null
    }

    if (!privateKey) {
      this.logger.warn(
        "⚠️ PRIVATE_KEY not set. Contract will be read-only (no signer)."
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
          `✅ VaxChainPayment contract initialized at: ${paymentAddress}`
        );
        this.logger.log(`✅ Signer wallet: ${this.signer.address}`);
      } else {
        this.logger.error(
          `❌ Payment contract NOT initialized - NFT minting will fail!`
        );
      }

      this.logger.log(
        `✅ BlockchainService initialized with signer: ${this.signer.address}`
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
    patientName: string,
    vaccineName: string,
    centerName: string,
    vaccinationDate: string,
    doses: number = 1
  ) {
    this.logger.log(`[mintCertificate] Called for booking ${bookingId}`);

    if (!this.paymentContract) {
      this.logger.error(
        `[mintCertificate] ❌ Payment contract not initialized!`
      );
      this.logger.error(
        `[mintCertificate] Check PAYMENT_CONTRACT_ADDRESS or CONTRACT_ADDRESS_PAYMENT in .env`
      );
      throw new Error(
        "Payment contract not initialized - cannot mint NFT certificate"
      );
    }

    this.logger.log(`[mintCertificate] Creating metadata...`);

    // Create NFT metadata
    const metadata = this.ipfsService.createVaccineCertificateMetadata(
      bookingId,
      patientName,
      vaccineName,
      centerName,
      vaccinationDate,
      doses
    );

    this.logger.log(`[mintCertificate] Metadata created: ${metadata.name}`);
    this.logger.log(`[mintCertificate] Uploading to IPFS...`);

    // Upload metadata to IPFS
    const tokenURI = await this.ipfsService.uploadMetadata(metadata);
    this.logger.log(`[mintCertificate] ✅ IPFS upload complete: ${tokenURI}`);

    this.logger.log(
      `[mintCertificate] Calling smart contract mintCertificate()...`
    );
    this.logger.log(`[mintCertificate] Patient address: ${patientAddress}`);
    this.logger.log(`[mintCertificate] Booking ID: ${bookingId}`);

    // Mint NFT with IPFS URI
    const tx = await this.paymentContract.mintCertificate(
      patientAddress,
      bookingId,
      vaccineName,
      centerName,
      vaccinationDate,
      tokenURI
    );

    this.logger.log(`[mintCertificate] Transaction sent: ${tx.hash}`);
    this.logger.log(`[mintCertificate] Waiting for confirmation...`);

    const receipt = await tx.wait();

    this.logger.log(`[mintCertificate] ✅ Transaction confirmed!`);
    this.logger.log(`[mintCertificate] Block number: ${receipt.blockNumber}`);
    this.logger.log(
      `[mintCertificate] Gas used: ${receipt.gasUsed.toString()}`
    );

    // Extract token ID from CertificateMinted event
    // Event: CertificateMinted(uint256 indexed tokenId, string bookingId, address patient)
    let tokenId = null;
    for (const log of receipt.logs) {
      try {
        const parsed = this.paymentContract.interface.parseLog(log);
        if (parsed && parsed.name === "CertificateMinted") {
          tokenId = parsed.args.tokenId.toString();
          this.logger.log(
            `[mintCertificate] ✅ NFT Token ID extracted from event: ${tokenId}`
          );
          break;
        }
      } catch (err) {
        // Not a VaxChainPayment event, skip
      }
    }

    if (!tokenId) {
      this.logger.error(
        `[mintCertificate] ⚠️ WARNING: Could not extract token ID from transaction!`
      );
    }

    return {
      tokenId,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      tokenURI,
      metadataUrl: this.ipfsService.getHttpUrl(tokenURI),
    };
  }
}
