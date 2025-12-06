import { ethers } from "ethers";
import { ContractAddress, HealthRecordAddress } from "../config";
import DoctorRegistry from "../artifacts/contracts/DoctorRegistry.sol/DoctorRegistry.json";
import HealthRecordSecure from "../artifacts/contracts/HealthRecordSecure.sol/HealthRecordSecure.json";

export const getContracts = async () => {
  if (!window.ethereum) throw new Error("Please install MetaMask!");
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();
  const doctorContract = new ethers.Contract(ContractAddress, DoctorRegistry.abi, signer);
  const healthContract = new ethers.Contract(HealthRecordAddress, HealthRecordSecure.abi, signer);
  return { provider, signer, doctorContract, healthContract };
};

export const getReadOnlyContracts = () => {
  const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
  const doctorContract = new ethers.Contract(ContractAddress, DoctorRegistry.abi, provider);
  const healthContract = new ethers.Contract(HealthRecordAddress, HealthRecordSecure.abi, provider);
  return { provider, doctorContract, healthContract };
};
