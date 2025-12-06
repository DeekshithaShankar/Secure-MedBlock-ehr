import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { ethers } from "ethers";
import AdminLayout from "../../components/AdminLayout";
import DoctorRegistry from "../../artifacts/contracts/DoctorRegistry.sol/DoctorRegistry.json";
import HealthRecordSecure from "../../artifacts/contracts/HealthRecordSecure.sol/HealthRecordSecure.json";
import { ContractAddress, HealthRecordAddress } from "../../config";

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalDoctors: 0,
    totalPatients: 0,
    activeDoctors: 0,
    activePatients: 0,
    inactiveDoctors: 0,
    inactivePatients: 0,
    totalDepartments: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      if (!window.ethereum) throw new Error("MetaMask not detected");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const doctorContract = new ethers.Contract(ContractAddress, DoctorRegistry.abi, provider);
      const healthContract = new ethers.Contract(HealthRecordAddress, HealthRecordSecure.abi, signer);

      const allDoctors = await doctorContract.getAllDoctors();
      const activeDoctors = allDoctors.filter((d) => d.isActive);
      const allPatients = await healthContract.getAllPatients();
      const activePatients = allPatients.filter((p) => p.isActive);
      const departments = await doctorContract.getAllDepartments();

      setStats({
        totalDoctors: allDoctors.length,
        activeDoctors: activeDoctors.length,
        inactiveDoctors: allDoctors.length - activeDoctors.length,
        totalPatients: allPatients.length,
        activePatients: activePatients.length,
        inactivePatients: allPatients.length - activePatients.length,
        totalDepartments: departments.length,
      });
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const calculateBarWidth = (value) => {
    if (value === 0) return 5;
    return Math.max(Math.min((value / 10) * 100, 100), 10);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-4 border-teal-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6 flex justify-between items-start">
          <h1 className="text-4xl font-bold text-gray-800">Welcome, Admin!</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-100 mb-6">
          <h2 className="text-2xl font-bold text-teal-800 mb-6">
            Platform Statistics
          </h2>

          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="font-semibold text-gray-700">Total Doctors</span>
                <div className="flex gap-4 text-sm">
                  <span className="text-teal-600 font-semibold">
                    Active: {stats.activeDoctors}
                  </span>
                  <span className="text-red-600 font-semibold">
                    Inactive: {stats.inactiveDoctors}
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-400 to-blue-600 h-8 rounded-full flex items-center justify-end pr-3 transition-all duration-500"
                  style={{
                    width: `${calculateBarWidth(stats.totalDoctors)}%`,
                  }}
                >
                  <span className="text-white font-bold text-sm">
                    {stats.totalDoctors}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="font-semibold text-gray-700">Total Patients</span>
                <div className="flex gap-4 text-sm">
                  <span className="text-teal-600 font-semibold">
                    Active: {stats.activePatients}
                  </span>
                  <span className="text-red-600 font-semibold">
                    Inactive: {stats.inactivePatients}
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-pink-400 to-pink-600 h-8 rounded-full flex items-center justify-end pr-3 transition-all duration-500"
                  style={{
                    width: `${calculateBarWidth(stats.totalPatients)}%`,
                  }}
                >
                  <span className="text-white font-bold text-sm">
                    {stats.totalPatients}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="font-semibold text-gray-700">
                  Total Departments
                </span>
                <span className="text-teal-600 font-semibold text-sm">
                  All Active
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-cyan-400 to-cyan-600 h-8 rounded-full flex items-center justify-end pr-3 transition-all duration-500"
                  style={{
                    width: `${calculateBarWidth(stats.totalDepartments)}%`,
                  }}
                >
                  <span className="text-white font-bold text-sm">
                    {stats.totalDepartments}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t-2 border-gray-200">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-2 shadow-lg">
                {stats.activeDoctors}
              </div>
              <p className="text-sm font-semibold text-gray-700">
                Active Doctors
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-pink-400 to-pink-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-2 shadow-lg">
                {stats.activePatients}
              </div>
              <p className="text-sm font-semibold text-gray-700">
                Active Patients
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-2 shadow-lg">
                {stats.totalDepartments}
              </div>
              <p className="text-sm font-semibold text-gray-700">Departments</p>
            </div>
          </div>

          <button
            onClick={() => router.push("/admin/departments")}
            className="mt-6 w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-600 hover:to-cyan-600 text-white text-xl font-bold py-4 rounded-xl shadow-lg transition"
          >
            View Departments
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}