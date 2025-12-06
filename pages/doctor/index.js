import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { useRouter } from "next/router";
import DoctorLayout from "../../components/DoctorLayout";
import DoctorRegistry from "../../artifacts/contracts/DoctorRegistry.sol/DoctorRegistry.json";
import HealthRecordSecure from "../../artifacts/contracts/HealthRecordSecure.sol/HealthRecordSecure.json";
import { ContractAddress, HealthRecordAddress } from "../../config";

export default function DoctorDashboard() {
  const router = useRouter();
  const [doctorInfo, setDoctorInfo] = useState(null);
  const [totalPatients, setTotalPatients] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDoctorData();
  }, []);

  const loadDoctorData = async () => {
    try {
      if (!window.ethereum) throw new Error("MetaMask not detected");

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();
      const address = await signer.getAddress();

      const doctorContract = new ethers.Contract(
        ContractAddress,
        DoctorRegistry.abi,
        provider
      );

      const healthContract = new ethers.Contract(
        HealthRecordAddress,
        HealthRecordSecure.abi,
        signer
      );

      const isDoctor = await doctorContract.isDoctor(address);
      if (!isDoctor) {
        setError("Access denied. Only registered doctors can access this dashboard.");
        return;
      }

      const doctorData = await doctorContract.getDoctorByAddress(address);
      setDoctorInfo({
        wallet: doctorData[0],
        fullName: doctorData[1],
        age: doctorData[2].toString(),
        specialization: doctorData[3],
        department: doctorData[4],
        licenseId: doctorData[5],
      });

      const patients = await healthContract.getMyPatients();
      setTotalPatients(patients.length);
    } catch (err) {
      setError(err.reason || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DoctorLayout>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "70vh",
          }}
        >
          <div className="animate-spin rounded-full h-32 w-32 border-b-4 border-teal-600"></div>
        </div>
      </DoctorLayout>
    );
  }

  if (error) {
    return (
      <DoctorLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="bg-white rounded-2xl p-10 shadow-2xl text-center max-w-md">
            <h2 className="text-3xl font-bold text-red-600 mb-4">Access Denied</h2>
            <p className="text-gray-700 mb-6">{error}</p>
            <button
              onClick={() => router.push("/")}
              className="bg-gradient-to-r from-teal-500 to-green-500 text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg transition"
            >
              Go to Home
            </button>
          </div>
        </div>
      </DoctorLayout>
    );
  }

  return (
    <DoctorLayout>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-4xl font-bold mb-8">
          Welcome, Dr. {doctorInfo?.fullName}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-teal-600 to-teal-500 p-6 text-white">
                <h2 className="text-2xl font-bold mb-1">Your Profile</h2>
                <p className="text-teal-100">Doctor Information</p>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm">
                    <p className="text-gray-600 font-semibold text-sm uppercase mb-2">
                      Full Name
                    </p>
                    <p className="text-xl font-bold text-gray-800">
                      Dr. {doctorInfo?.fullName}
                    </p>
                  </div>

                  <div className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm">
                    <p className="text-gray-600 font-semibold text-sm uppercase mb-2">
                      Age
                    </p>
                    <p className="text-xl font-bold text-gray-800">
                      {doctorInfo?.age} years
                    </p>
                  </div>

                  <div className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm">
                    <p className="text-gray-600 font-semibold text-sm uppercase mb-2">
                      Specialization
                    </p>
                    <p className="text-xl font-bold text-gray-800">
                      {doctorInfo?.specialization}
                    </p>
                  </div>

                  <div className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm">
                    <p className="text-gray-600 font-semibold text-sm uppercase mb-2">
                      Department
                    </p>
                    <p className="text-xl font-bold text-gray-800">
                      {doctorInfo?.department}
                    </p>
                  </div>

                  <div className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm md:col-span-2">
                    <p className="text-gray-600 font-semibold text-sm uppercase mb-2">
                      License ID
                    </p>
                    <p className="text-xl font-bold text-gray-800">
                      {doctorInfo?.licenseId}
                    </p>
                  </div>

                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 overflow-hidden h-full">
              <div className="bg-gradient-to-r from-teal-600 to-teal-500 p-6 text-white">
                <h2 className="text-2xl font-bold mb-1">Statistics</h2>
                <p className="text-teal-100">Patient Overview</p>
              </div>

              <div className="p-6 flex flex-col justify-up items-center h-full">
                <div className="text-center">
                  <div className="bg-teal-50 rounded-2xl p-8 border-2 border-teal-200 mb-4">
                    <p className="text-8xl font-bold text-teal-600 mb-4">
                      {totalPatients}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 mb-2">
                      TOTAL PATIENTS
                    </p>
                    <p className="text-teal-800 text-lg">
                      Active under your care
                    </p>
                  </div>

                  <button
                    onClick={() => router.push("/doctor/view-patients")}
                    className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white px-6 py-3 rounded-xl font-bold text-lg transition duration-200 shadow-md"
                  >
                    View All Patients
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DoctorLayout>
  );
}