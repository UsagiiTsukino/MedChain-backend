import { Controller, Get, Put, Body, UseGuards } from "@nestjs/common";
import { ExchangeRateService } from "../common/services/exchange-rate.service";

@Controller("exchange-rates")
export class ExchangeRateController {
  constructor(private readonly exchangeRateService: ExchangeRateService) {}

  /**
   * Lấy tỷ giá hiện tại
   * GET /exchange-rates
   */
  @Get()
  async getCurrentRates() {
    const rates = await this.exchangeRateService.getCurrentRates();
    return {
      success: true,
      data: rates,
    };
  }

  /**
   * Chuyển đổi VND sang ETH
   * GET /exchange-rates/convert/vnd-to-eth?amount=1000000
   */
  @Get("convert/vnd-to-eth")
  async convertVndToEth(@Body("amount") amount: number) {
    const ethAmount = await this.exchangeRateService.convertVndToEth(amount);
    const rate = await this.exchangeRateService.getVndToEthRate();

    return {
      success: true,
      data: {
        vndAmount: amount,
        ethAmount,
        rate,
        formula: `${amount} VND / ${rate} = ${ethAmount} ETH`,
      },
    };
  }

  /**
   * Cập nhật tỷ giá thủ công (chỉ admin)
   * PUT /exchange-rates/manual
   * Body: { ethToVnd: 85000000, usdToVnd: 24500 }
   */
  @Put("manual")
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('ADMIN')
  async updateManualRate(
    @Body("ethToVnd") ethToVnd?: number,
    @Body("usdToVnd") usdToVnd?: number
  ) {
    if (!ethToVnd && !usdToVnd) {
      return {
        success: false,
        message: "At least one exchange rate must be provided",
      };
    }

    await this.exchangeRateService.updateManualRate(ethToVnd, usdToVnd);
    const rates = await this.exchangeRateService.getCurrentRates();

    return {
      success: true,
      message: "Exchange rates updated successfully",
      data: rates,
    };
  }

  /**
   * Xóa cache và refresh tỷ giá
   * PUT /exchange-rates/refresh
   */
  @Put("refresh")
  async refreshRates() {
    this.exchangeRateService.clearCache();
    const rates = await this.exchangeRateService.getCurrentRates();

    return {
      success: true,
      message: "Exchange rates refreshed successfully",
      data: rates,
    };
  }
}
