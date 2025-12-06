import { useEffect, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import Link from "next/link";
import { ethers } from "ethers";
import DoctorRegistry from "../../artifacts/contracts/DoctorRegistry.sol/DoctorRegistry.json";
import { ContractAddress } from "../../config";

export default function ViewDepartments() {
  const departments = [
    "Cardiology",
    "Neurology",
    "Orthopedics",
    "Dermatology",
    "Pediatrics",
    "Oncology",
    "Gastroenterology",
    "Radiology",
    "Emergency Medicine",
    "General Surgery",
    "Dental",
    "Gynocology"
  ];

  const [doctorCount, setDoctorCount] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDoctorsFromBlockchain();
  }, []);

  const loadDoctorsFromBlockchain = async () => {
    try {
      if (!window.ethereum) throw new Error("MetaMask not found");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(ContractAddress, DoctorRegistry.abi, provider);

      const allDocs = await contract.getAllDoctors();

      const countByDept = {};
      departments.forEach((dept) => {
        countByDept[dept] = allDocs.filter(
          (d) => d.department && d.department.toLowerCase() === dept.toLowerCase()
        ).length;
      });

      setDoctorCount(countByDept);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <h2 className="text-3xl font-bold mb-8 text-center text-gray-800">
        Department Overview
      </h2>

      {loading ? (
        <p className="text-center text-gray-500">Loading departments...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept) => (
            <div
              key={dept}
              className="bg-gray-50 p-6 rounded-lg shadow hover:shadow-lg transition"
            >
              <h3 className="text-lg font-semibold text-gray-700 mb-1">{dept}</h3>
              <p className="text-sm text-gray-600 mb-4">
                Doctors: {doctorCount[dept] || 0}
              </p>
              <Link
                href={`/admin/department/${encodeURIComponent(dept)}`}
                className="inline-block mt-2 bg-cyan-600 hover:bg-black-500 text-white px-4 py-2 rounded"
              >
                View Doctors
              </Link>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
