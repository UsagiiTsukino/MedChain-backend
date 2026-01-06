import { Injectable, Logger } from "@nestjs/common";

/**
 * Service quản lý tỷ giá chuyển đổi giữa các loại tiền tệ
 *
 * Có thể tích hợp với API tỷ giá thực như:
 * - CoinGecko API: https://api.coingecko.com/api/v3/simple/price
 * - Binance API: https://api.binance.com/api/v3/ticker/price
 * - CryptoCompare API: https://min-api.cryptocompare.com/data/price
 */
@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);

  // Cache tỷ giá với thời gian hết hạn
  private rateCache: Map<string, { rate: number; timestamp: number }> =
    new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 phút

  /**
   * Tỷ giá mặc định (fallback) - Có thể config từ .env
   * 1 ETH ≈ 85,000,000 VND (tỷ giá thực tế thay đổi liên tục)
   * 1 USD ≈ 24,500 VND
   */
  private readonly DEFAULT_RATES = {
    ETH_TO_VND: process.env.ETH_TO_VND_RATE
      ? parseFloat(process.env.ETH_TO_VND_RATE)
      : 85000000,
    USD_TO_VND: process.env.USD_TO_VND_RATE
      ? parseFloat(process.env.USD_TO_VND_RATE)
      : 24500,
  };

  /**
   * Lấy tỷ giá VND/ETH
   * @param useCache - Sử dụng cache hay lấy mới
   */
  async getVndToEthRate(useCache = true): Promise<number> {
    const cacheKey = "VND_TO_ETH";

    // Kiểm tra cache
    if (useCache && this.rateCache.has(cacheKey)) {
      const cached = this.rateCache.get(cacheKey);
      const now = Date.now();

      if (cached && now - cached.timestamp < this.CACHE_DURATION) {
        this.logger.debug(
          `Using cached rate: 1 ETH = ${cached.rate.toLocaleString()} VND`
        );
        return cached.rate;
      }
    }

    // Lấy tỷ giá mới
    try {
      const rate = await this.fetchRealTimeRate();

      // Lưu vào cache
      this.rateCache.set(cacheKey, {
        rate,
        timestamp: Date.now(),
      });

      this.logger.log(
        `Updated exchange rate: 1 ETH = ${rate.toLocaleString()} VND`
      );
      return rate;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.warn(
        `Failed to fetch real-time rate, using default: ${errorMessage}`
      );
      return this.DEFAULT_RATES.ETH_TO_VND;
    }
  }

  /**
   * Lấy tỷ giá VND/USD
   */
  async getVndToUsdRate(): Promise<number> {
    return this.DEFAULT_RATES.USD_TO_VND;
  }

  /**
   * Chuyển đổi VND sang ETH
   */
  async convertVndToEth(vndAmount: number): Promise<number> {
    const rate = await this.getVndToEthRate();
    return vndAmount / rate;
  }

  /**
   * Chuyển đổi ETH sang VND
   */
  async convertEthToVnd(ethAmount: number): Promise<number> {
    const rate = await this.getVndToEthRate();
    return ethAmount * rate;
  }

  /**
   * Chuyển đổi VND sang USD
   */
  async convertVndToUsd(vndAmount: number): Promise<number> {
    const rate = await this.getVndToUsdRate();
    return vndAmount / rate;
  }

  /**
   * Lấy tỷ giá thời gian thực từ API
   *
   * Option 1: CoinGecko (Free, no API key required)
   * Option 2: Binance (Free)
   * Option 3: Manual update from admin panel
   */
  private async fetchRealTimeRate(): Promise<number> {
    // Nếu có config API key thì gọi API thực
    if (process.env.ENABLE_REAL_TIME_RATE === "true") {
      try {
        // Option 1: CoinGecko API (Free)
        const response = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=vnd"
        );

        if (response.ok) {
          const data = (await response.json()) as {
            ethereum?: { vnd?: number };
          };
          const rate = data?.ethereum?.vnd;

          if (rate && rate > 0) {
            return rate;
          }
        }

        // Option 2: Binance API (backup)
        // Lấy ETH/USDT và USD/VND rồi nhân lại
        const binanceResponse = await fetch(
          "https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT"
        );

        if (binanceResponse.ok) {
          const binanceData = (await binanceResponse.json()) as {
            price: string;
          };
          const ethToUsdt = parseFloat(binanceData.price);
          const usdToVnd = this.DEFAULT_RATES.USD_TO_VND;

          return ethToUsdt * usdToVnd;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        this.logger.error(`Error fetching real-time rate: ${errorMessage}`);
      }
    }

    // Fallback về tỷ giá mặc định
    return this.DEFAULT_RATES.ETH_TO_VND;
  }

  /**
   * Cập nhật tỷ giá thủ công (dành cho admin)
   */
  async updateManualRate(ethToVnd?: number, usdToVnd?: number): Promise<void> {
    if (ethToVnd && ethToVnd > 0) {
      this.DEFAULT_RATES.ETH_TO_VND = ethToVnd;
      this.rateCache.delete("VND_TO_ETH");
      this.logger.log(
        `Manual rate updated: 1 ETH = ${ethToVnd.toLocaleString()} VND`
      );
    }

    if (usdToVnd && usdToVnd > 0) {
      this.DEFAULT_RATES.USD_TO_VND = usdToVnd;
      this.logger.log(
        `Manual rate updated: 1 USD = ${usdToVnd.toLocaleString()} VND`
      );
    }
  }

  /**
   * Xóa cache tỷ giá (force refresh)
   */
  clearCache(): void {
    this.rateCache.clear();
    this.logger.log("Exchange rate cache cleared");
  }

  /**
   * Lấy thông tin tỷ giá hiện tại
   */
  async getCurrentRates(): Promise<{
    ethToVnd: number;
    usdToVnd: number;
    lastUpdated: Date;
    source: "realtime" | "cache" | "default";
  }> {
    const ethToVnd = await this.getVndToEthRate();
    const usdToVnd = await this.getVndToUsdRate();

    const cached = this.rateCache.get("VND_TO_ETH");
    const source = cached ? "cache" : "default";
    const lastUpdated = cached ? new Date(cached.timestamp) : new Date();

    return {
      ethToVnd,
      usdToVnd,
      lastUpdated,
      source,
    };
  }
}
