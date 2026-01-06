import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";
const FormData = require("form-data");

interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
}

@Injectable()
export class IpfsService {
  private readonly logger = new Logger(IpfsService.name);
  private readonly pinataApiKey = process.env.PINATA_API_KEY;
  private readonly pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;
  private readonly pinataJWT = process.env.PINATA_JWT;
  private readonly pinataGateway =
    process.env.PINATA_GATEWAY || "gateway.pinata.cloud";

  /**
   * Upload JSON metadata to IPFS via Pinata
   */
  async uploadMetadata(metadata: NFTMetadata): Promise<string> {
    try {
      this.logger.log(`[uploadMetadata] Starting upload for: ${metadata.name}`);

      if (!this.pinataJWT && (!this.pinataApiKey || !this.pinataSecretApiKey)) {
        this.logger.warn(
          `[uploadMetadata] ⚠️ Pinata credentials not configured!`
        );
        this.logger.warn(
          `[uploadMetadata] PINATA_JWT: ${this.pinataJWT ? "Found" : "Missing"}`
        );
        this.logger.warn(
          `[uploadMetadata] PINATA_API_KEY: ${
            this.pinataApiKey ? "Found" : "Missing"
          }`
        );
        this.logger.warn(
          `[uploadMetadata] PINATA_SECRET_API_KEY: ${
            this.pinataSecretApiKey ? "Found" : "Missing"
          }`
        );
        this.logger.warn(
          `[uploadMetadata] 📝 Using mock IPFS hash (development mode)`
        );
        // Return mock hash for development
        return "ipfs://QmMockHash123456789";
      }

      this.logger.log(
        `[uploadMetadata] Pinata credentials found, uploading to IPFS...`
      );

      const url = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

      const data = {
        pinataContent: metadata,
        pinataMetadata: {
          name: `${metadata.name}.json`,
        },
      };

      const headers = this.pinataJWT
        ? {
            Authorization: `Bearer ${this.pinataJWT}`,
            "Content-Type": "application/json",
          }
        : {
            pinata_api_key: this.pinataApiKey,
            pinata_secret_api_key: this.pinataSecretApiKey,
            "Content-Type": "application/json",
          };

      this.logger.log(`[uploadMetadata] Sending request to Pinata API...`);

      const response = await axios.post(url, data, { headers });

      const ipfsHash = response.data.IpfsHash;
      const ipfsUrl = `ipfs://${ipfsHash}`;

      this.logger.log(`[uploadMetadata] ✅ Upload successful!`);
      this.logger.log(`[uploadMetadata] IPFS Hash: ${ipfsHash}`);
      this.logger.log(`[uploadMetadata] IPFS URL: ${ipfsUrl}`);

      return ipfsUrl;
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorResponse = error?.response?.data || "No response data";

      this.logger.error(`[uploadMetadata] ❌ Failed to upload to IPFS`);
      this.logger.error(`[uploadMetadata] Error: ${errorMessage}`);
      this.logger.error(
        `[uploadMetadata] Response: ${JSON.stringify(errorResponse)}`
      );
      this.logger.warn(`[uploadMetadata] 📝 Falling back to mock IPFS hash`);

      // Fallback to mock hash in case of error
      return "ipfs://QmMockHash123456789";
    }
  }

  /**
   * Upload file (image) to IPFS via Pinata
   */
  async uploadFile(file: Buffer, fileName: string): Promise<string> {
    try {
      if (!this.pinataJWT && (!this.pinataApiKey || !this.pinataSecretApiKey)) {
        this.logger.warn(
          "Pinata credentials not configured, returning mock IPFS hash"
        );
        return "ipfs://QmMockImageHash123456789";
      }

      const url = "https://api.pinata.cloud/pinning/pinFileToIPFS";

      const formData = new FormData();
      formData.append("file", file, fileName);

      const metadata = JSON.stringify({
        name: fileName,
      });
      formData.append("pinataMetadata", metadata);

      const headers = this.pinataJWT
        ? {
            Authorization: `Bearer ${this.pinataJWT}`,
            ...formData.getHeaders(),
          }
        : {
            pinata_api_key: this.pinataApiKey,
            pinata_secret_api_key: this.pinataSecretApiKey,
            ...formData.getHeaders(),
          };

      const response = await axios.post(url, formData, {
        headers,
        maxBodyLength: Infinity,
      });

      const ipfsHash = response.data.IpfsHash;
      const ipfsUrl = `ipfs://${ipfsHash}`;

      this.logger.log(`File uploaded to IPFS: ${ipfsUrl}`);
      return ipfsUrl;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error("Failed to upload file to IPFS", errorMessage);
      return "ipfs://QmMockImageHash123456789";
    }
  }

  /**
   * Get HTTP URL from IPFS URL
   */
  getHttpUrl(ipfsUrl: string): string {
    if (!ipfsUrl || !ipfsUrl.startsWith("ipfs://")) {
      return ipfsUrl;
    }
    const hash = ipfsUrl.replace("ipfs://", "");
    return `https://${this.pinataGateway}/ipfs/${hash}`;
  }

  /**
   * Create NFT metadata for vaccination certificate
   */
  createVaccineCertificateMetadata(
    bookingId: string,
    patientName: string,
    vaccineName: string,
    centerName: string,
    vaccinationDate: string,
    doses: number,
    imageUrl?: string
  ): NFTMetadata {
    return {
      name: `VaxChain Certificate #${bookingId}`,
      description: `Official vaccination certificate for ${patientName}. This NFT certificate proves vaccination with ${vaccineName} at ${centerName} on ${vaccinationDate}. Issued by MedChainAI Platform.`,
      image: imageUrl || "ipfs://QmDefaultVaccineCertificateImage",
      attributes: [
        {
          trait_type: "Booking ID",
          value: bookingId,
        },
        {
          trait_type: "Patient Name",
          value: patientName,
        },
        {
          trait_type: "Vaccine Name",
          value: vaccineName,
        },
        {
          trait_type: "Vaccination Center",
          value: centerName,
        },
        {
          trait_type: "Vaccination Date",
          value: vaccinationDate,
        },
        {
          trait_type: "Number of Doses",
          value: doses.toString(),
        },
        {
          trait_type: "Issued By",
          value: "MedChainAI Platform",
        },
        {
          trait_type: "Certificate Type",
          value: "Vaccination Certificate",
        },
        {
          trait_type: "Blockchain",
          value: "Ethereum",
        },
        {
          trait_type: "Standard",
          value: "ERC-721",
        },
      ],
    };
  }
}
