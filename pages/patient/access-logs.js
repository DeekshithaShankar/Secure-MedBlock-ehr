import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { useRouter } from "next/router";
import { Icon, Message, Loader, Pagination } from "semantic-ui-react";
import PatientLayout from "../../components/PatientLayout";
import HealthRecordSecure from "../../artifacts/contracts/HealthRecordSecure.sol/HealthRecordSecure.json";
import DoctorRegistry from "../../artifacts/contracts/DoctorRegistry.sol/DoctorRegistry.json";
import { HealthRecordAddress, ContractAddress } from "../../config";

export default function AccessLogs() {
  const router = useRouter();
  const [account, setAccount] = useState("");
  const [accessLogs, setAccessLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totalLogs, setTotalLogs] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 10;

  useEffect(() => {
    loadAccessLogs();
  }, []);

  const loadAccessLogs = async () => {
    try {
      if (!window.ethereum) throw new Error("MetaMask not detected");

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      setAccount(address);

      const healthContract = new ethers.Contract(
        HealthRecordAddress,
        HealthRecordSecure.abi,
        signer
      );

      const doctorContract = new ethers.Contract(
        ContractAddress,
        DoctorRegistry.abi,
        provider
      );

      const isPatient = await healthContract.isPatient(address);
      if (!isPatient) {
        setError("Access denied. Only registered patients can view access logs.");
        setLoading(false);
        return;
      }

      let logCount = 0;
      try {
        logCount = await healthContract.getAccessLogCount(address);
        setTotalLogs(logCount.toNumber());
      } catch {
      }

      let logs = [];
      try {
        logs = await healthContract.getAccessLogs(address);
      } catch {
        setError("Unable to fetch access logs. The contract may not support this feature yet.");
        setLoading(false);
        return;
      }

      const enrichedLogs = await Promise.all(
        logs.map(async (log) => {
          let accessorName = "Unknown";
          let accessorRole = "Unknown";

          try {
            if (log.accessor.toLowerCase() === address.toLowerCase()) {
              accessorName = "You (Patient)";
              accessorRole = "Patient";
            } else {
              const doctorInfo = await doctorContract.getDoctorByAddress(log.accessor);
              accessorName = "Dr. " + doctorInfo[1];
              accessorRole = doctorInfo[4];
            }
          } catch {
            accessorName = log.accessor.slice(0, 10) + "...";
            accessorRole = "Unknown";
          }

          return {
            accessor: log.accessor,
            accessorName,
            accessorRole,
            timestamp: new Date(log.timestamp.toNumber() * 1000),
            accessType: log.accessType,
            description: log.description,
            wasSuccessful: log.wasSuccessful
          };
        })
      );

      enrichedLogs.sort((a, b) => b.timestamp - a.timestamp);

      setAccessLogs(enrichedLogs);
      setTotalLogs(enrichedLogs.length);
    } catch (err) {
      setError(err.reason || err.message);
    } finally {
      setLoading(false);
    }
  };

  const getAccessTypeColor = (type) => {
    switch (type) {
      case "VIEW_RECORDS":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "ADD_RECORD":
        return "bg-green-100 text-green-800 border-green-200";
      case "REGISTER":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "TRANSFER":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "GRANT_CONSENT":
        return "bg-teal-100 text-teal-800 border-teal-200";
      case "REVOKE_CONSENT":
        return "bg-red-100 text-red-800 border-red-200";
      case "REMOVE":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "REACTIVATE":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getAccessTypeIcon = (type) => {
    switch (type) {
      case "VIEW_RECORDS":
        return "eye";
      case "ADD_RECORD":
        return "plus";
      case "REGISTER":
        return "user plus";
      case "TRANSFER":
        return "exchange";
      case "GRANT_CONSENT":
        return "check circle";
      case "REVOKE_CONSENT":
        return "times circle";
      case "REMOVE":
        return "trash";
      case "REACTIVATE":
        return "redo";
      default:
        return "info";
    }
  };

  const formatAccessType = (type) => {
    return type.replace(/_/g, " ");
  };

  const formatDescription = (log) => {
    const desc = log.description || "";
    switch (log.accessType) {
      case "ADD_RECORD":
        return `Added medical record: "${desc}"`;
      case "VIEW_RECORDS":
        return "Viewed your medical records";
      case "REGISTER":
        return "Registered you as a patient";
      case "TRANSFER":
        return desc ? `Transferred: ${desc}` : "Transferred your care to another doctor";
      case "GRANT_CONSENT":
        return desc ? `Granted access: ${desc}` : "Granted access to records";
      case "REVOKE_CONSENT":
        return desc ? `Revoked access: ${desc}` : "Revoked access to records";
      case "REMOVE":
        return "Removed from active patients";
      case "REACTIVATE":
        return "Reactivated as a patient";
      default:
        return desc || "Accessed your records";
    }
  };

  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = accessLogs.slice(indexOfFirstLog, indexOfLastLog);
  const totalPages = Math.ceil(accessLogs.length / logsPerPage);

  if (loading) {
    return (
      <PatientLayout activeTab="logs" account={account}>
        <div className="flex justify-center items-center h-96">
          <Loader active size="large">Loading Access Logs...</Loader>
        </div>
      </PatientLayout>
    );
  }

  if (error) {
    return (
      <PatientLayout activeTab="logs" account={account}>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Message negative>
            <Message.Header>Error Loading Access Logs</Message.Header>
            <p>{error}</p>
          </Message>
          <button
            onClick={() => router.push("/patient")}
            className="mt-4 bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700"
          >
            Back to Dashboard
          </button>
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout activeTab="logs" account={account}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-center mb-2">
            Access Audit Log
          </h1>
          <p className="text-gray-600 text-center text-lg">
            View who has accessed your medical records
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-100">
            <div className="text-3xl font-bold text-teal-600">{totalLogs}</div>
            <div className="text-gray-600 font-medium">Total Access Events</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-100">
            <div className="text-3xl font-bold text-blue-600">
              {accessLogs.filter(l => l.accessType === "VIEW_RECORDS").length}
            </div>
            <div className="text-gray-600 font-medium">Record Views</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-100">
            <div className="text-3xl font-bold text-green-600">
              {accessLogs.filter(l => l.accessType === "ADD_RECORD").length}
            </div>
            <div className="text-gray-600 font-medium">Records Added</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-100">
            <div className="text-3xl font-bold text-orange-600">
              {accessLogs.filter(l => l.accessType === "TRANSFER").length}
            </div>
            <div className="text-gray-600 font-medium">Transfers</div>
          </div>
        </div>

        {accessLogs.length === 0 ? (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-8 rounded-lg text-center">
            <Icon name="info circle" size="huge" className="text-blue-500 mb-4" />
            <h3 className="text-2xl font-bold text-blue-800 mb-2">No Access Logs Yet</h3>
            <p className="text-blue-700">
              Your medical records haven't been accessed yet. Access logs will appear here
              when doctors view or modify your records.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-teal-600 to-teal-500 p-6 text-white">
              <h2 className="text-2xl font-bold">Recent Activity</h2>
              <p className="text-teal-100">Showing {currentLogs.length} of {totalLogs} events</p>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentLogs.map((log, idx) => (
                <div
                  key={idx}
                  className="bg-gray-50 rounded-xl p-5 hover:bg-gray-100 transition-colors border border-gray-200 relative"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-full ${getAccessTypeColor(log.accessType)}`}>
                        <Icon name={getAccessTypeIcon(log.accessType)} className="m-0" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-gray-800">
                          {log.accessorName}
                        </h3>
                        <p className="text-sm text-gray-500">{log.accessorRole}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs text-gray-400">#{totalLogs - (indexOfFirstLog + idx)}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getAccessTypeColor(log.accessType)}`}>
                        {formatAccessType(log.accessType)}
                      </span>
                    </div>
                  </div>

                  <p className="text-gray-700 mb-4 text-base">{formatDescription(log)}</p>

                  <div className="flex items-center text-sm text-gray-500 pt-3 border-t border-gray-200">
                    <Icon name="clock" className="mr-2" />
                    {log.timestamp.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="p-6 bg-gray-50 flex justify-center">
                <Pagination
                  activePage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(_, { activePage }) => setCurrentPage(activePage)}
                  firstItem={null}
                  lastItem={null}
                  siblingRange={1}
                />
              </div>
            )}
          </div>
        )}

      </div>
    </PatientLayout>
  );
}
