import { describe, it, expect } from "vitest";
import { StrKey } from "@stellar/stellar-sdk";

describe("StrKey Address Validation Unit Tests", () => {
  it("validates genuine Stellar Ed25519 public keys", () => {
    // Real Stellar testnet addresses
    const validVerifier = "GCMKX5CZ4UCWKKUMGQ3WDEJ4AFCNCCJW5R54IWZH7BE6RK6H2KG45QCU";
    const validAdmin = "GD3VW6CXVC2IEP23QWLHY6E2TLJCJI436FTLAYI3VC73YETPSW2ZQ3DY";
    const validPlayer = "GBWBXAM6L3LIFPGM37TGXHKCHVZNNMA5AVCLEEK4DGDT4DZSBLB4EVLT";

    expect(StrKey.isValidEd25519PublicKey(validVerifier)).toBe(true);
    expect(StrKey.isValidEd25519PublicKey(validAdmin)).toBe(true);
    expect(StrKey.isValidEd25519PublicKey(validPlayer)).toBe(true);
  });

  it("strictly rejects old 0x Ethereum/Celo addresses", () => {
    const celoAddresses = [
      "0x22baf440fF5eFB18015413D2Bb4FDFC8b63a6484",
      "0x1234567890123456789012345678901234567890",
      "0x0000000000000000000000000000000000000000",
    ];

    celoAddresses.forEach((addr) => {
      expect(StrKey.isValidEd25519PublicKey(addr)).toBe(false);
    });
  });

  it("rejects malformed, empty, or invalid inputs", () => {
    const invalidInputs = [
      "",
      "guest",
      "G12345",
      "GBWBXAM6L3LIFPGM37TGXHKCHVZNNMA5AVCLEEK4DGDT4DZSBLB4EVL", // too short
      "GBWBXAM6L3LIFPGM37TGXHKCHVZNNMA5AVCLEEK4DGDT4DZSBLB4EVLT0", // too long
      "invalid-string",
      "CBELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA", // Contract ID (C...), not account public key (G...)
    ];

    invalidInputs.forEach((input) => {
      expect(StrKey.isValidEd25519PublicKey(input)).toBe(false);
    });
  });
});
