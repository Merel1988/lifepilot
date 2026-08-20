import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Versleutelen van gegevens die wél in de database moeten staan maar niet
 * leesbaar mogen zijn: nu alleen het app-specifieke iCloud-wachtwoord.
 *
 * De sleutel komt uit `AUTH_SECRET`, die er voor NextAuth toch al moet zijn. Een
 * rij in Turso is daarmee waardeloos zonder de omgeving van de app. Dit is geen
 * vervanging voor een echte secret manager, maar wel het verschil tussen "staat
 * leesbaar in de database" en "staat versleuteld in de database".
 *
 * Formaat: `v1.<iv base64url>.<authtag base64url>.<ciphertext base64url>`. Het
 * versienummer staat er zodat een latere sleutelwissel te herkennen is.
 */

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";

function key(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET ontbreekt; zonder die sleutel kan er niets versleuteld worden.");
  }
  // AUTH_SECRET heeft geen vaste lengte, dus hashen naar de 32 bytes die AES-256 wil
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    enc.toString("base64url"),
  ].join(".");
}

export function decryptSecret(stored: string): string {
  const [version, ivPart, tagPart, dataPart] = stored.split(".");
  if (version !== VERSION || !ivPart || !tagPart || !dataPart) {
    throw new Error("Versleutelde waarde heeft een onbekend formaat.");
  }

  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
