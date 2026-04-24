import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ENCRYPTION_KEY_ENV = "THEFACTORY_CREDENTIALS_ENCRYPTION_KEY";

function normalizeKey(rawKey) {
  if (!rawKey || typeof rawKey !== "string") {
    throw new Error(
      `Missing ${ENCRYPTION_KEY_ENV}. Configure a 32-byte encryption key.`
    );
  }

  const trimmed = rawKey.trim();
  if (!trimmed) {
    throw new Error(
      `Missing ${ENCRYPTION_KEY_ENV}. Configure a 32-byte encryption key.`
    );
  }

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  try {
    const keyFromBase64 = Buffer.from(trimmed, "base64");
    if (keyFromBase64.length === 32) return keyFromBase64;
  } catch {
    // Ignore and continue with UTF-8 fallback
  }

  const utf8Key = Buffer.from(trimmed, "utf8");
  if (utf8Key.length === 32) return utf8Key;

  throw new Error(
    `${ENCRYPTION_KEY_ENV} must be 32 bytes (hex/base64/raw UTF-8).`
  );
}

function getEncryptionKey() {
  return normalizeKey(process.env[ENCRYPTION_KEY_ENV]);
}

export function encryptTheFactoryPassword(password) {
  const plain = typeof password === "string" ? password.trim() : "";
  if (!plain) {
    throw new Error("The Factory password is required to encrypt.");
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptTheFactoryPassword(encryptedPayload) {
  if (!encryptedPayload || typeof encryptedPayload !== "string") {
    throw new Error("The Factory encrypted password payload is required.");
  }

  const [ivB64, authTagB64, dataB64] = encryptedPayload.split(":");
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error("Invalid The Factory encrypted password payload format.");
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const encrypted = Buffer.from(dataB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
