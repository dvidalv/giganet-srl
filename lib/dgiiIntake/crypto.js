import {
  encryptTheFactoryPassword,
  decryptTheFactoryPassword,
} from "@/utils/thefactoryCredentials";

/** Encrypt sensitive DGII intake secrets (same AES-256-GCM key as The Factory). */
export function encryptDgiiSecret(plain) {
  return encryptTheFactoryPassword(plain);
}

export function decryptDgiiSecret(encryptedPayload) {
  return decryptTheFactoryPassword(encryptedPayload);
}

export function hasEncryptedSecret(value) {
  return typeof value === "string" && value.split(":").length === 3;
}
