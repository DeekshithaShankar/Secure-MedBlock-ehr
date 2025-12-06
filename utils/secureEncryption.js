import CryptoJS from "crypto-js";

export async function generateWalletKey(address, signer) {
  const message = `MedBlock-Encryption-Key-${address.toLowerCase()}-v2`;
  const signature = await signer.signMessage(message);
  return CryptoJS.SHA256(signature).toString();
}

export function generateSharedKey(doctorAddr, patientAddr) {
  return CryptoJS.SHA256(`MedBlock-Shared-${doctorAddr.toLowerCase()}-${patientAddr.toLowerCase()}`).toString();
}

export function encryptWithKey(data, key) {
  return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
}

export function decryptWithKey(encrypted, key) {
  const bytes = CryptoJS.AES.decrypt(encrypted, key);
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);
  if (!decrypted) throw new Error("Decryption failed");
  return JSON.parse(decrypted);
}

export function generateHash(data) {
  return CryptoJS.SHA256(typeof data === "string" ? data : JSON.stringify(data)).toString();
}

export async function prepareSecureRecord(recordData, patientAddr, signer) {
  const doctorAddr = await signer.getAddress();
  const doctorKey = await generateWalletKey(doctorAddr, signer);
  const sharedKey = generateSharedKey(doctorAddr, patientAddr);
  const record = {
    ...recordData,
    encryptedAt: new Date().toISOString(),
    version: "2.0",
    encryptionMethod: "AES-256-DUAL-KEY",
    encryptedBy: doctorAddr,
    forPatient: patientAddr
  };
  const payload = {
    v: "2.0",
    doctor: encryptWithKey(record, doctorKey),
    shared: encryptWithKey(record, sharedKey),
    doctorAddr,
    patientAddr
  };
  const encrypted = JSON.stringify(payload);
  return { encryptedData: encrypted, integrityHash: generateHash(encrypted) };
}

export function decryptWithSharedKey(payload, viewerAddr) {
  const sharedKey = generateSharedKey(payload.doctorAddr, payload.patientAddr);
  return {
    data: decryptWithKey(payload.shared, sharedKey),
    isPatient: payload.patientAddr.toLowerCase() === viewerAddr.toLowerCase(),
    isCreator: payload.doctorAddr.toLowerCase() === viewerAddr.toLowerCase()
  };
}

export function decryptLegacy(encrypted) {
  try {
    let bytes = CryptoJS.AES.decrypt(encrypted, "medblock-key");
    let decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) {
      bytes = CryptoJS.AES.decrypt(encrypted, "medblock-secret-key");
      decrypted = bytes.toString(CryptoJS.enc.Utf8);
    }
    return decrypted ? JSON.parse(decrypted) : null;
  } catch {
    return null;
  }
}

export async function smartDecrypt(encryptedData, storedHash, signer) {
  if (storedHash && generateHash(encryptedData) !== storedHash) {
    return { data: null, integrityVerified: false, error: "Data integrity check failed" };
  }
  let payload;
  try {
    payload = JSON.parse(encryptedData);
  } catch {
    const legacy = decryptLegacy(encryptedData);
    if (legacy) return { data: legacy, integrityVerified: !storedHash, isLegacy: true };
    throw new Error("Unable to decrypt record");
  }
  if (payload.v === "2.0") {
    const addr = await signer.getAddress();
    const result = decryptWithSharedKey(payload, addr);
    return { ...result, integrityVerified: true };
  }
  const legacy = decryptLegacy(encryptedData);
  if (legacy) return { data: legacy, integrityVerified: !storedHash, isLegacy: true };
  throw new Error("Unable to decrypt record");
}

export const generatePatientKey = generateWalletKey;
export const decryptAsPatient = decryptWithSharedKey;
