/**
 * Certificate ID Formatter
 * Formats raw token IDs into professional-looking certificate identifiers
 */

export class CertificateFormatter {
  /**
   * Format token ID as VaxChain Certificate Number
   * Examples:
   * 1 -> VXC-000001
   * 42 -> VXC-000042
   * 999 -> VXC-000999
   */
  static formatCertificateId(tokenId: string | number): string {
    const numericId =
      typeof tokenId === "string" ? parseInt(tokenId, 10) : tokenId;

    if (isNaN(numericId) || numericId <= 0) {
      return "VXC-INVALID";
    }

    // Pad with zeros to 6 digits
    const paddedId = numericId.toString().padStart(6, "0");
    return `VXC-${paddedId}`;
  }

  /**
   * Format token ID with year prefix for better tracking
   * Examples:
   * 1 -> VXC-2026-000001
   * 42 -> VXC-2026-000042
   */
  static formatWithYear(tokenId: string | number): string {
    const numericId =
      typeof tokenId === "string" ? parseInt(tokenId, 10) : tokenId;

    if (isNaN(numericId) || numericId <= 0) {
      return "VXC-INVALID";
    }

    const year = new Date().getFullYear();
    const paddedId = numericId.toString().padStart(6, "0");
    return `VXC-${year}-${paddedId}`;
  }

  /**
   * Format with checksum digit for validation (Luhn algorithm)
   * Examples:
   * 1 -> VXC-0000017
   * 42 -> VXC-0000428
   */
  static formatWithChecksum(tokenId: string | number): string {
    const numericId =
      typeof tokenId === "string" ? parseInt(tokenId, 10) : tokenId;

    if (isNaN(numericId) || numericId <= 0) {
      return "VXC-INVALID";
    }

    const paddedId = numericId.toString().padStart(6, "0");
    const checksum = this.calculateChecksum(paddedId);
    return `VXC-${paddedId}${checksum}`;
  }

  /**
   * Format as hexadecimal ID (tech-looking)
   * Examples:
   * 1 -> VXC-0x000001
   * 255 -> VXC-0x0000FF
   * 4096 -> VXC-0x001000
   */
  static formatHex(tokenId: string | number): string {
    const numericId =
      typeof tokenId === "string" ? parseInt(tokenId, 10) : tokenId;

    if (isNaN(numericId) || numericId <= 0) {
      return "VXC-INVALID";
    }

    const hexId = numericId.toString(16).toUpperCase().padStart(6, "0");
    return `VXC-0x${hexId}`;
  }

  /**
   * Format as Base36 (alphanumeric, compact)
   * Examples:
   * 1 -> VXC-00001
   * 1000 -> VXC-00RS
   * 46656 -> VXC-01000
   */
  static formatBase36(tokenId: string | number): string {
    const numericId =
      typeof tokenId === "string" ? parseInt(tokenId, 10) : tokenId;

    if (isNaN(numericId) || numericId <= 0) {
      return "VXC-INVALID";
    }

    const base36 = numericId.toString(36).toUpperCase().padStart(5, "0");
    return `VXC-${base36}`;
  }

  /**
   * Parse formatted certificate ID back to token ID
   * VXC-000042 -> 42
   * VXC-2026-000042 -> 42
   * VXC-0x00002A -> 42
   */
  static parseTokenId(formattedId: string): number | null {
    if (!formattedId || !formattedId.startsWith("VXC-")) {
      return null;
    }

    // Remove prefix
    const withoutPrefix = formattedId.substring(4);

    // Try hex format
    if (withoutPrefix.startsWith("0x")) {
      const hexValue = withoutPrefix.substring(2);
      return parseInt(hexValue, 16);
    }

    // Try year format (VXC-2026-000042)
    if (withoutPrefix.includes("-")) {
      const parts = withoutPrefix.split("-");
      const lastPart = parts[parts.length - 1];
      // Remove checksum if present
      const numericPart = lastPart.replace(/\D/g, "").substring(0, 6);
      return parseInt(numericPart, 10);
    }

    // Try base36
    if (/[A-Z]/.test(withoutPrefix)) {
      return parseInt(withoutPrefix, 36);
    }

    // Try regular format (VXC-000042 or with checksum VXC-0000428)
    const numericPart = withoutPrefix.replace(/\D/g, "").substring(0, 6);
    return parseInt(numericPart, 10);
  }

  /**
   * Calculate Luhn checksum digit
   */
  private static calculateChecksum(id: string): number {
    let sum = 0;
    let alternate = false;

    for (let i = id.length - 1; i >= 0; i--) {
      let digit = parseInt(id.charAt(i), 10);

      if (alternate) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      alternate = !alternate;
    }

    return (10 - (sum % 10)) % 10;
  }

  /**
   * Generate QR-friendly format (shorter, alphanumeric)
   * Examples:
   * 1 -> VXC1
   * 1000 -> VXCRS
   * 46656 -> VXC1000
   */
  static formatForQR(tokenId: string | number): string {
    const numericId =
      typeof tokenId === "string" ? parseInt(tokenId, 10) : tokenId;

    if (isNaN(numericId) || numericId <= 0) {
      return "VXCINVALID";
    }

    // Use base36 for compact representation
    const base36 = numericId.toString(36).toUpperCase();
    return `VXC${base36}`;
  }

  /**
   * Get display format based on preference
   */
  static format(
    tokenId: string | number,
    style: "standard" | "year" | "checksum" | "hex" | "compact" = "standard"
  ): string {
    switch (style) {
      case "year":
        return this.formatWithYear(tokenId);
      case "checksum":
        return this.formatWithChecksum(tokenId);
      case "hex":
        return this.formatHex(tokenId);
      case "compact":
        return this.formatBase36(tokenId);
      case "standard":
      default:
        return this.formatCertificateId(tokenId);
    }
  }
}

// Export convenience functions
export const formatCertificateId = CertificateFormatter.formatCertificateId;
export const parseTokenId = CertificateFormatter.parseTokenId;
export const formatForQR = CertificateFormatter.formatForQR;
