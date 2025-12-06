import CryptoJS from "crypto-js";

const pinataJwt = process.env.NEXT_PUBLIC_PINATA_JWT;
const pinataGateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY;

export async function uploadToIPFS(data) {
  const blob = new Blob([data], { type: "application/json" });
  const form = new FormData();
  form.append("file", blob, "record.json");
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { "Authorization": `Bearer ${pinataJwt}` },
    body: form
  });
  if (!res.ok) throw new Error("Upload failed");
  return (await res.json()).IpfsHash;
}

export async function uploadFileToIPFS(file, key) {
  const fileData = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const encrypted = JSON.stringify({
    encrypted: true,
    originalName: file.name,
    originalType: file.type,
    data: CryptoJS.AES.encrypt(fileData, key).toString()
  });
  const blob = new Blob([encrypted], { type: "application/json" });
  const form = new FormData();
  form.append("file", blob, "attachment.json");
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { "Authorization": `Bearer ${pinataJwt}` },
    body: form
  });
  if (!res.ok) throw new Error("File upload failed");
  return (await res.json()).IpfsHash;
}

export async function downloadFromIPFS(hash) {
  const res = await fetch(`${pinataGateway}/${hash}`);
  if (!res.ok) throw new Error("Download failed");
  return await res.text();
}

export async function downloadEncryptedFile(hash, key) {
  const res = await fetch(`${pinataGateway}/${hash}`);
  if (!res.ok) throw new Error("Download failed");
  const pkg = await res.json();
  if (!pkg.encrypted) throw new Error("File not encrypted");
  const decrypted = CryptoJS.AES.decrypt(pkg.data, key).toString(CryptoJS.enc.Utf8);
  return { dataUrl: decrypted, fileName: pkg.originalName, fileType: pkg.originalType };
}
