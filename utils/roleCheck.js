import { ethers } from "ethers";
import DoctorRegistry from "../artifacts/contracts/DoctorRegistry.sol/DoctorRegistry.json";
import HealthRecord from "../artifacts/contracts/HealthRecord.sol/HealthRecord.json";
import { ContractAddress, HealthRecordAddress } from "../config";

export async function detectUserRole() {
  if (!window.ethereum) throw new Error("MetaMask not detected");
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();
  const address = await signer.getAddress();
  const doctorContract = new ethers.Contract(ContractAddress, DoctorRegistry.abi, signer);
  const healthContract = new ethers.Contract(HealthRecordAddress, HealthRecord.abi, signer);
  try {
    const admin = await healthContract.admin();
    if (address.toLowerCase() === admin.toLowerCase()) return "ADMIN";
    const isDoctor = await doctorContract.isDoctor(address);
    if (isDoctor) return "DOCTOR";
    const isPatient = await healthContract.isPatient(address);
    if (isPatient) return "PATIENT";
    return "Unregistered";
  } catch {
    return "Error!";
  }
}
