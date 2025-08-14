import { dataResult, errorResult, type Result } from "../../../shared";

/** Import a raw key for use by AES-GCM. */
export async function importAESGCMKey(key: string | Buffer): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw", // Key format
    typeof key === "string" ? new TextEncoder().encode(key) : key,
    { name: "AES-GCM" },
    false, // Non-extractable
    ["encrypt", "decrypt"] // Key usages
  );
}

/** Encrypt plaintext using AES-GCM. */
export async function encryptAESGCM(
  plaintext: string,
  key: CryptoKey,
  ivLengthBytes = 12
): Promise<Result<{ ciphertext: Buffer; iv: Buffer }>> {
  try {
    const iv = crypto.getRandomValues(new Uint8Array(ivLengthBytes));
    const plaintextBytes = new TextEncoder().encode(plaintext);
    const ciphertextBuff = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintextBytes);

    return dataResult({
      ciphertext: Buffer.from(ciphertextBuff),
      iv: Buffer.from(iv),
    });
  } catch (error) {
    return errorResult({ msg: "Encryption failed", data: error });
  }
}

/** Decrypt ciphertext using AES-GCM. */
export async function decryptAESGCM(ciphertext: Buffer, key: CryptoKey, iv: Buffer): Promise<Result<string>> {
  try {
    const plaintextBuff = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return dataResult(new TextDecoder().decode(plaintextBuff));
  } catch (error) {
    return errorResult({ msg: "Decryption failed", data: error });
  }
}
