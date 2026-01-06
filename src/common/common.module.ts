import { Module, Global } from "@nestjs/common";
import { ExchangeRateService } from "./services/exchange-rate.service";
import { ExchangeRateController } from "./exchange-rate.controller";

@Global()
@Module({
  controllers: [ExchangeRateController],
  providers: [ExchangeRateService],
  exports: [ExchangeRateService],
})
export class CommonModule {}
