import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { ethers } from "ethers";
import abi from "./contract/VaccineAppointment.abi.json";

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  provider!: ethers.JsonRpcProvider;
  contract!: ethers.Contract;

  onModuleInit() {
    if (process.env.BLOCKCHAIN_ENABLED === "false") {
      this.logger.warn(
        "Blockchain disabled via env (BLOCKCHAIN_ENABLED=false). Skipping init."
      );
      return;
    }

    const rpcUrl = process.env.RPC_URL;
    const address = process.env.CONTRACT_ADDRESS as string | undefined;

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

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.contract = new ethers.Contract(address, abi as any, this.provider);
  }
}
