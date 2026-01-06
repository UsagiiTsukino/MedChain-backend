import { Module } from "@nestjs/common";
import { BlockchainService } from "./blockchain.service";
import { BlockchainController } from "./blockchain.controller";
import { IpfsModule } from "../ipfs/ipfs.module";

@Module({
  imports: [IpfsModule],
  controllers: [BlockchainController],
  providers: [BlockchainService],
  exports: [BlockchainService],
})
export class BlockchainModule {}
