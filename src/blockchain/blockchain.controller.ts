import { Controller, Get, Param, NotFoundException } from "@nestjs/common";
import { BlockchainService } from "./blockchain.service";
import { CertificateFormatter } from "./utils/certificate-formatter";

@Controller("blockchain")
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  /**
   * Public endpoint to verify a certificate on blockchain
   * Anyone can verify a certificate by providing the tokenId
   */
  @Get("verify-certificate/:tokenId")
  async verifyCertificate(@Param("tokenId") tokenId: string) {
    try {
      const tokenIdNumber = parseInt(tokenId, 10);

      if (isNaN(tokenIdNumber) || tokenIdNumber <= 0) {
        throw new NotFoundException("Invalid token ID");
      }

      const certificateData = await this.blockchainService.verifyCertificate(
        tokenIdNumber
      );

      // Parse the result from blockchain
      const [
        isValid,
        patient,
        vaccineName,
        centerName,
        vaccinationDate,
        issuedAt,
      ] = certificateData;

      return {
        success: true,
        data: {
          tokenId: tokenIdNumber,
          certificateId: CertificateFormatter.formatWithYear(tokenIdNumber),
          certificateIdShort:
            CertificateFormatter.formatCertificateId(tokenIdNumber),
          isValid,
          patient,
          vaccineName,
          centerName,
          vaccinationDate,
          issuedAt: new Date(Number(issuedAt) * 1000).toISOString(), // Convert from timestamp
        },
      };
    } catch (error) {
      throw new NotFoundException(
        `Certificate with token ID ${tokenId} not found or invalid`
      );
    }
  }

  /**
   * Get certificate by booking ID
   */
  @Get("certificate/:bookingId")
  async getCertificateByBooking(@Param("bookingId") bookingId: string) {
    try {
      const certificateData =
        await this.blockchainService.getCertificateByBooking(bookingId);

      // Parse certificate struct from blockchain
      // Certificate struct: (tokenId, bookingId, patient, vaccineName, centerName, vaccinationDate, issuedAt, isValid)
      const {
        tokenId,
        patient,
        vaccineName,
        centerName,
        vaccinationDate,
        issuedAt,
        isValid,
      } = certificateData;

      return {
        success: true,
        certificateId: CertificateFormatter.formatWithYear(tokenId.toString()),
        certificateIdShort: CertificateFormatter.formatCertificateId(
          tokenId.toString()
        ),
        data: {
          tokenId: tokenId.toString(),
          bookingId,
          patient,
          vaccineName,
          centerName,
          vaccinationDate,
          issuedAt: new Date(Number(issuedAt) * 1000).toISOString(),
          isValid,
          certificateId: CertificateFormatter.formatWithYear(
            tokenId.toString()
          ),
          certificateIdShort: CertificateFormatter.formatCertificateId(
            tokenId.toString()
          ),
        },
      };
    } catch (error) {
      throw new NotFoundException(
        `No certificate found for booking ID ${bookingId}`
      );
    }
  }
}
