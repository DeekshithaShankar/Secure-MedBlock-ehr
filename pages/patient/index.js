import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { useRouter } from "next/router";
import PatientLayout from "../../components/PatientLayout";
import HealthRecordSecure from "../../artifacts/contracts/HealthRecordSecure.sol/HealthRecordSecure.json";
import DoctorRegistry from "../../artifacts/contracts/DoctorRegistry.sol/DoctorRegistry.json";
import { HealthRecordAddress, ContractAddress } from "../../config";

export default function PatientDashboard() {
  const router = useRouter();
  const { tab } = router.query;
  const [activeTab, setActiveTab] = useState("about");
  const [account, setAccount] = useState("");
  const [patientInfo, setPatientInfo] = useState(null);
  const [doctorHistory, setDoctorHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadPatientData();
  }, []);

  useEffect(() => {
    if (tab && ["about", "history"].includes(tab)) {
      setActiveTab(tab);
    } else {
      setActiveTab("about");
    }
  }, [tab]);

  const loadPatientData = async () => {
    try {
      if (!window.ethereum) throw new Error("MetaMask not detected");

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      setAccount(address);

      const contract = new ethers.Contract(
        HealthRecordAddress,
        HealthRecordSecure.abi,
        signer
      );

      const isPatient = await contract.isPatient(address);
      if (!isPatient) {
        setError("Access denied. Only registered patients can access this dashboard.");
        return;
      }

      const patientData = await contract.getPatient(address);
      setPatientInfo({
        fullName: patientData[0],
        age: patientData[1],
        blood: patientData[2],
        phone: patientData[3],
        doctor: patientData[4],
      });

      await loadDoctorHistory(address, provider);
    } catch (err) {
      setError(err.reason || err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDoctorHistory = async (patientAddress, provider) => {
    try {
      const healthContract = new ethers.Contract(
        HealthRecordAddress,
        HealthRecordSecure.abi,
        provider
      );

      const doctorContract = new ethers.Contract(
        ContractAddress,
        DoctorRegistry.abi,
        provider
      );

      const history = await healthContract.getPatientDoctorHistory(patientAddress);

      const enrichedHistory = await Promise.all(
        history.map(async (assignment) => {
          try {
            const doctorData = await doctorContract.getDoctorByAddress(assignment.doctor);
            return {
              doctor: assignment.doctor,
              doctorName: doctorData[1] || "Unknown",
              specialization: doctorData[3] || "N/A",
              department: doctorData[4] || "N/A",
              assignedDate: new Date(
                assignment.assignedDate.toNumber() * 1000
              ).toLocaleDateString(),
              transferredDate:
                assignment.transferredDate.toNumber() === 0
                  ? "Current"
                  : new Date(
                      assignment.transferredDate.toNumber() * 1000
                    ).toLocaleDateString(),
              reason: assignment.reason,
              isCurrent: assignment.transferredDate.toNumber() === 0,
            };
          } catch {
            return {
              doctor: assignment.doctor,
              doctorName: "Unknown Doctor",
              specialization: "N/A",
              department: "N/A",
              assignedDate: new Date(
                assignment.assignedDate.toNumber() * 1000
              ).toLocaleDateString(),
              transferredDate:
                assignment.transferredDate.toNumber() === 0
                  ? "Current"
                  : new Date(
                      assignment.transferredDate.toNumber() * 1000
                    ).toLocaleDateString(),
              reason: assignment.reason,
              isCurrent: assignment.transferredDate.toNumber() === 0,
            };
          }
        })
      );

      const sortedHistory = enrichedHistory.sort((a, b) => {
        if (a.isCurrent === b.isCurrent) return 0;
        return a.isCurrent ? -1 : 1;
      });

      setDoctorHistory(sortedHistory);
    } catch {
    }
  };

  const renderAbout = () => (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-4xl font-bold mb-8 text-center">My Profile</h1>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-teal-600 to-teal-500 p-8 text-white">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-teal-600 text-5xl font-bold shadow-lg">
              {patientInfo?.fullName.charAt(0)}
            </div>
            <div>
              <h2 className="text-3xl font-bold">{patientInfo?.fullName}</h2>
              <p className="text-teal-100 text-lg mt-1">Patient Profile</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-gray-600 font-semibold text-sm uppercase mb-2">Age</p>
                  <p className="text-3xl font-bold text-gray-800">
                    {patientInfo?.age.toString()}{" "}
                    <span className="text-lg text-gray-600">years</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-gray-600 font-semibold text-sm uppercase mb-2">
                    Blood Group
                  </p>
                  <p className="text-3xl font-bold text-red-600">
                    {patientInfo?.blood}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-gray-600 font-semibold text-sm uppercase mb-2">Phone</p>
                  <p className="text-xl font-bold text-gray-800">
                    {patientInfo?.phone}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDoctorHistory = () => (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-4xl font-bold mb-8 text-center">Doctor Treatment History</h1>

      {doctorHistory.length === 0 ? (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-8 rounded-lg text-center">
          <h3 className="text-2xl font-bold text-blue-800 mb-2">No Doctor History</h3>
          <p className="text-blue-700">You haven't been assigned to any doctors yet.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {doctorHistory.map((item, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 overflow-hidden"
              style={{ minHeight: "380px" }}
            >
              <div
                className={`p-6 text-white ${
                  item.isCurrent
                    ? "bg-gradient-to-r from-teal-600 to-teal-500"
                    : "bg-gradient-to-r from-gray-500 to-gray-600"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-2xl font-bold">Dr. {item.doctorName}</h3>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      item.isCurrent
                        ? "bg-green-400 text-green-900"
                        : "bg-gray-300 text-gray-700"
                    }`}
                  >
                    {item.isCurrent ? "Current" : "Past"}
                  </span>
                </div>
                <p className="text-teal-100 text-sm">{item.department}</p>
              </div>

              <div className="p-7">
                <div className="space-y-3 text-lg">
                  <div className="flex">
                    <span className="font-semibold text-gray-600 min-w-[140px]">
                      Department:
                    </span>
                    <span className="text-gray-800">{item.department}</span>
                  </div>

                  <div className="flex">
                    <span className="font-semibold text-gray-600 min-w-[140px]">
                      Specialization:
                    </span>
                    <span className="text-gray-800">{item.specialization}</span>
                  </div>

                  <div className="flex">
                    <span className="font-semibold text-gray-600 min-w-[140px]">
                      Assigned:
                    </span>
                    <span className="text-gray-800">{item.assignedDate}</span>
                  </div>

                  {!item.isCurrent && (
                    <div className="flex">
                      <span className="font-semibold text-gray-600 min-w-[140px]">
                        Transferred:
                      </span>
                      <span className="text-gray-800">{item.transferredDate}</span>
                    </div>
                  )}

                  <div className="flex">
                    <span className="font-semibold text-gray-600 min-w-[140px]">
                      Reason:
                    </span>
                    <span className="text-gray-800">{item.reason}</span>
                  </div>

                  {/* <div className="flex items-start">
                    <span className="font-semibold text-gray-600 min-w-[140px]">
                      Doctor Phone:
                    </span>
                    <span className="text-gray-700 font-mono text-sm break-all flex-1">
                      {item.doctor}
                    </span>
                  </div> */}
                </div>

                {item.isCurrent ? (
                  <div className="mt-8 bg-gradient-to-r from-teal-50 to-green-50 border-2 border-teal-50 rounded-xl p-4">
                    <p className="text-teal-800 font-bold text-center">
                      Currently Under Care
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 bg-gray-50 border-2 border-gray-50 rounded-xl p-4">
                    <p className="text-gray-700 font-bold text-center">
                      Previous Doctor
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <PatientLayout activeTab={activeTab} account={account}>
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
      </PatientLayout>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
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
    );
  }

  return (
    <PatientLayout activeTab={activeTab} account={account}>
      {activeTab === "about" && renderAbout()}
      {activeTab === "history" && renderDoctorHistory()}
    </PatientLayout>
  );
}