import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";
import abi from "./contract/VaccineAppointment.abi.json";

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  provider!: ethers.JsonRpcProvider;
  contract!: ethers.Contract;
  signer!: ethers.Wallet;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    if (this.configService.get<string>("BLOCKCHAIN_ENABLED") === "false") {
      this.logger.warn(
        "Blockchain disabled via env (BLOCKCHAIN_ENABLED=false). Skipping init."
      );
      return;
    }

    const rpcUrl = this.configService.get<string>("RPC_URL");
    const address = this.configService.get<string>("CONTRACT_ADDRESS");
    const privateKey = this.configService.get<string>("PRIVATE_KEY");

    if (!rpcUrl) {
      this.logger.warn("RPC_URL not set. Skipping blockchain initialization.");
      return;
    }

    if (!address || !ethers.isAddress(address)) {
      this.logger.warn(
        "CONTRACT_ADDRESS is missing or invalid. Skipping blockchain initialization."
      );
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
      this.contract = new ethers.Contract(address, abi as any, this.signer);
      this.logger.log(
        `BlockchainService initialized with signer: ${this.signer.address}`
      );
    } else {
      this.contract = new ethers.Contract(address, abi as any, this.provider);
      this.logger.log(`BlockchainService initialized in read-only mode.`);
    }
  }
}
