import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { useRouter } from "next/router";
import { Icon, Message, Loader, Pagination, Dropdown } from "semantic-ui-react";
import AdminLayout from "../../components/AdminLayout";
import HealthRecordSecure from "../../artifacts/contracts/HealthRecordSecure.sol/HealthRecordSecure.json";
import DoctorRegistry from "../../artifacts/contracts/DoctorRegistry.sol/DoctorRegistry.json";
import { HealthRecordAddress, ContractAddress } from "../../config";

export default function AdminAuditLogs() {
  const router = useRouter();
  const [account, setAccount] = useState("");
  const [allLogs, setAllLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState("all");
  const [selectedAccessType, setSelectedAccessType] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 15;

  useEffect(() => {
    loadAllAuditLogs();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [selectedPatient, selectedAccessType, allLogs]);

  const loadAllAuditLogs = async () => {
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

      const isAdmin = await doctorContract.isAdmin(address);
      if (!isAdmin) {
        setError("Access denied. Only admin can view system audit logs.");
        setLoading(false);
        return;
      }

      const allPatients = await healthContract.getAllPatients();

      const patientOptions = [
        { key: "all", text: "All Patients", value: "all" },
        ...allPatients.map((p) => ({
          key: p.walletAddress,
          text: p.fullName, // Show only name, no wallet address
          value: p.walletAddress,
        })),
      ];
      setPatients(patientOptions);

      let combinedLogs = [];

      for (const patient of allPatients) {
        try {
          const logs = await healthContract.getAccessLogs(patient.walletAddress);

          const enrichedLogs = await Promise.all(
            logs.map(async (log) => {
              let accessorName = "Unknown";
              let accessorRole = "Unknown";

              let isRemovedDoctor = false;
              try {
                if (log.accessor.toLowerCase() === patient.walletAddress.toLowerCase()) {
                  accessorName = patient.fullName + " (Self)";
                  accessorRole = "Patient";
                } else {
                  try {
                    const isAdminAccessor = await doctorContract.isAdmin(log.accessor);
                    if (isAdminAccessor) {
                      accessorName = "System Admin";
                      accessorRole = "Administrator";
                    } else {
                      const doctorInfo = await doctorContract.getDoctorInfoSafe(log.accessor);
                      if (doctorInfo.exists) {
                        accessorName = "Dr. " + doctorInfo.fullName;
                        accessorRole = doctorInfo.department || doctorInfo.specialization;
                        if (!doctorInfo.isActive) {
                          isRemovedDoctor = true;
                          accessorName += " (No Longer Working)";
                        }
                      } else {
                        accessorName = log.accessor.slice(0, 10) + "...";
                        accessorRole = "Unknown";
                      }
                    }
                  } catch {
                    try {
                      const oldDoctorInfo = await doctorContract.getDoctorByAddress(log.accessor);
                      accessorName = "Dr. " + oldDoctorInfo[1];
                      accessorRole = oldDoctorInfo[4];
                    } catch {
                      accessorName = log.accessor.slice(0, 10) + "...";
                      accessorRole = "Unknown";
                    }
                  }
                }
              } catch {
                accessorName = log.accessor.slice(0, 10) + "...";
              }

              return {
                patientAddress: patient.walletAddress,
                patientName: patient.fullName,
                accessor: log.accessor,
                accessorName,
                accessorRole,
                isRemovedDoctor,
                timestamp: new Date(log.timestamp.toNumber() * 1000),
                accessType: log.accessType,
                description: log.description,
                wasSuccessful: log.wasSuccessful,
              };
            })
          );

          combinedLogs = [...combinedLogs, ...enrichedLogs];
        } catch {
        }
      }

      combinedLogs.sort((a, b) => b.timestamp - a.timestamp);

      setAllLogs(combinedLogs);
      setFilteredLogs(combinedLogs);
    } catch (err) {
      setError(err.reason || err.message);
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = [...allLogs];

    if (selectedPatient !== "all") {
      filtered = filtered.filter((log) => log.patientAddress === selectedPatient);
    }

    if (selectedAccessType !== "all") {
      filtered = filtered.filter((log) => log.accessType === selectedAccessType);
    }

    setFilteredLogs(filtered);
    setCurrentPage(1);
  };

  const accessTypeOptions = [
    { key: "all", text: "All Types", value: "all" },
    { key: "VIEW_RECORDS", text: "View Records", value: "VIEW_RECORDS" },
    { key: "ADD_RECORD", text: "Add Record", value: "ADD_RECORD" },
    { key: "REGISTER", text: "Registration", value: "REGISTER" },
    { key: "TRANSFER", text: "Transfer", value: "TRANSFER" },
    { key: "GRANT_CONSENT", text: "Grant Consent", value: "GRANT_CONSENT" },
    { key: "REVOKE_CONSENT", text: "Revoke Consent", value: "REVOKE_CONSENT" },
    { key: "REMOVE", text: "Remove", value: "REMOVE" },
    { key: "REACTIVATE", text: "Reactivate", value: "REACTIVATE" },
    { key: "ADMIN_TRANSFER", text: "Admin Transfer", value: "ADMIN_TRANSFER" },
  ];

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
      case "ADMIN_TRANSFER":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
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
      case "ADMIN_TRANSFER":
        return "shield";
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
        return "Viewed medical records";
      case "REGISTER":
        return "Registered patient";
      case "TRANSFER":
        return desc ? `Transferred: ${desc}` : "Transferred patient to another doctor";
      case "ADMIN_TRANSFER":
        return desc ? `Admin transfer: ${desc}` : "Admin transferred patient";
      case "GRANT_CONSENT":
        return desc ? `Granted access: ${desc}` : "Granted access to records";
      case "REVOKE_CONSENT":
        return desc ? `Revoked access: ${desc}` : "Revoked access to records";
      case "REMOVE":
        return "Removed patient from active list";
      case "REACTIVATE":
        return "Reactivated patient";
      default:
        return desc || "Accessed records";
    }
  };

  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstLog, indexOfLastLog);
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);

  const stats = {
    total: allLogs.length,
    views: allLogs.filter((l) => l.accessType === "VIEW_RECORDS").length,
    additions: allLogs.filter((l) => l.accessType === "ADD_RECORD").length,
    transfers: allLogs.filter((l) => l.accessType === "TRANSFER" || l.accessType === "ADMIN_TRANSFER").length,
    consents: allLogs.filter((l) => l.accessType === "GRANT_CONSENT" || l.accessType === "REVOKE_CONSENT").length,
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-96">
          <Loader active size="large">Loading System Audit Logs...</Loader>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Message negative>
            <Message.Header>Error Loading Audit Logs</Message.Header>
            <p>{error}</p>
          </Message>
          <button
            onClick={() => router.push("/admin")}
            className="mt-4 bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700"
          >
            Back to Dashboard
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-center mb-2">
            System Audit Logs
          </h1>
          <p className="text-gray-600 text-center text-lg">
            Monitor all access events across the healthcare system
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-100">
            <div className="text-3xl font-bold text-teal-600">{stats.total}</div>
            <div className="text-gray-600 font-medium">Total Events</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-100">
            <div className="text-3xl font-bold text-blue-600">{stats.views}</div>
            <div className="text-gray-600 font-medium">Record Views</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-100">
            <div className="text-3xl font-bold text-green-600">{stats.additions}</div>
            <div className="text-gray-600 font-medium">Records Added</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-100">
            <div className="text-3xl font-bold text-orange-600">{stats.transfers}</div>
            <div className="text-gray-600 font-medium">Transfers</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-100">
            <div className="text-3xl font-bold text-purple-600">{stats.consents}</div>
            <div className="text-gray-600 font-medium">Consent Changes</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 mb-6 border-2 border-gray-100">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Icon name="filter" /> Filter Logs
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Patient
              </label>
              <Dropdown
                placeholder="Select Patient"
                fluid
                selection
                search
                options={patients}
                value={selectedPatient}
                onChange={(_, { value }) => setSelectedPatient(value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Access Type
              </label>
              <Dropdown
                placeholder="Select Access Type"
                fluid
                selection
                options={accessTypeOptions}
                value={selectedAccessType}
                onChange={(_, { value }) => setSelectedAccessType(value)}
              />
            </div>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-8 rounded-lg text-center">
            <Icon name="info circle" size="huge" className="text-blue-500 mb-4" />
            <h3 className="text-2xl font-bold text-blue-800 mb-2">No Audit Logs Found</h3>
            <p className="text-blue-700">
              {selectedPatient !== "all" || selectedAccessType !== "all"
                ? "No logs match your filter criteria. Try adjusting the filters."
                : "No access events have been recorded yet."}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-teal-600 to-teal-500 p-6 text-white">
              <h2 className="text-2xl font-bold">Access Events</h2>
              <p className="text-teal-100">
                Showing {currentLogs.length} of {filteredLogs.length} events
                {(selectedPatient !== "all" || selectedAccessType !== "all") && " (filtered)"}
              </p>
            </div>

            <div className="divide-y divide-gray-100">
              {currentLogs.map((log, idx) => (
                <div key={idx} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-full ${getAccessTypeColor(log.accessType)}`}>
                        <Icon name={getAccessTypeIcon(log.accessType)} className="m-0" />
                      </div>

                      <div>
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <span className="font-bold text-lg text-gray-800">
                            {log.accessorName}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getAccessTypeColor(log.accessType)}`}>
                            {formatAccessType(log.accessType)}
                          </span>
                        </div>

                        <p className="text-gray-600 mb-2">{formatDescription(log)}</p>

                        <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Icon name="user" />
                            {log.patientName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Icon name="user md" />
                            {log.accessorRole}
                          </span>
                          <span className="flex items-center gap-1">
                            <Icon name="clock" />
                            {log.timestamp.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
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
    </AdminLayout>
  );
}
