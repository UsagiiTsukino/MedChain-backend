import { Body, Controller, Post } from "@nestjs/common";

@Controller("payments")
export class PaymentsController {
  @Post("paypal")
  paypal(@Body() body: { bookingId: string; paymentId: string }) {
    return { success: true, method: "PAYPAL", ...body };
  }

  @Post("meta-mask")
  metaMask(@Body() body: { paymentId: string; bookingId: string }) {
    return { success: true, method: "META_MASK", ...body };
  }
}
