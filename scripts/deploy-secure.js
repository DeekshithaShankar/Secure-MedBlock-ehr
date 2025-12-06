const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const DoctorRegistry = await hre.ethers.getContractFactory("DoctorRegistry");
  const registry = await DoctorRegistry.deploy();
  await registry.deployed();

  const HealthRecord = await hre.ethers.getContractFactory("HealthRecordSecure");
  const health = await HealthRecord.deploy(registry.address);
  await health.deployed();

  fs.writeFileSync(path.join(__dirname, "../config.js"), `
export const ContractAddress = "${registry.address}";
export const HealthRecordAddress = "${health.address}";

export const contracts = {
  doctorRegistry: { address: "${registry.address}", name: "DoctorRegistry" },
  healthRecord: { address: "${health.address}", name: "HealthRecordSecure" }
};

export const features = {
  secureEncryption: true,
  integrityVerification: true,
  accessLogging: true,
  consentManagement: true
};
`);
}

main().catch(e => { console.error(e); process.exit(1); });
