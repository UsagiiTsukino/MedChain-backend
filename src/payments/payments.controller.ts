import { Body, Controller, Post } from "@nestjs/common";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("paypal")
  async paypal(
    @Body() body: { bookingId?: string; paymentId: string; orderId?: string }
  ) {
    return this.paymentsService.updatePaymentPaypal(
      body.paymentId,
      body.bookingId,
      body.orderId
    );
  }

  @Post("meta-mask")
  async metaMask(@Body() body: { paymentId: string; bookingId: string }) {
    return this.paymentsService.updatePaymentMetaMask(
      body.paymentId,
      body.bookingId
    );
  }
}
