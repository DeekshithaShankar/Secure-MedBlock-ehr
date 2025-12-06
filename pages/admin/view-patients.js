import { useState, useEffect } from "react";
import { ethers } from "ethers";
import AdminLayout from "../../components/AdminLayout";
import HealthRecordSecure from "../../artifacts/contracts/HealthRecordSecure.sol/HealthRecordSecure.json";
import DoctorRegistry from "../../artifacts/contracts/DoctorRegistry.sol/DoctorRegistry.json";
import { HealthRecordAddress, ContractAddress } from "../../config";

export default function AdminViewPatients() {
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState("all");
  const [transferModal, setTransferModal] = useState({
    open: false,
    patient: null,
  });
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      if (!window.ethereum) throw new Error("MetaMask not detected");

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      const healthContract = new ethers.Contract(HealthRecordAddress, HealthRecordSecure.abi, signer);
      const doctorContract = new ethers.Contract(ContractAddress, DoctorRegistry.abi, signer);
      const allPatients = await healthContract.getAllPatients();

      const enriched = await Promise.all(
        allPatients.map(async (p) => {
          let doctorName = "Unknown";
          let doctorDept = "N/A";
          let doctorStatus = "removed";

          try {
            const doctorData = await doctorContract.getDoctorByAddress(
              p.currentDoctor
            );
            doctorName = doctorData[1] || "Unknown";
            doctorDept = doctorData[4] || "N/A";
            const isDoctorActive = doctorData[5];
            doctorStatus = isDoctorActive ? "active" : "removed";
          } catch (err) {
            doctorStatus = "removed";
          }

          return {
            wallet: p.walletAddress,
            fullName: p.fullName,
            age: p.age.toString(),
            bloodGroup: p.bloodGroup,
            phone: p.phone,
            patientId: p.patientId.toString(),
            currentDoctor: p.currentDoctor,
            doctorName: doctorName,
            doctorDept: doctorDept,
            doctorStatus: doctorStatus,
            isActive: p.isActive,
          };
        })
      );

      setPatients(enriched);

      const allDoctors = await doctorContract.getAllDoctors();
      const activeDoctors = allDoctors.filter((d) => d.isActive);
      setDoctors(activeDoctors);
    } catch (err) {
      setError(err.reason || err.message);
    } finally {
      setLoading(false);
    }
  };

const handleTransferPatient = async () => {
  if (!transferModal.patient || !selectedDoctor) {
    setError("Please select a doctor");
    setTimeout(() => setError(""), 3000);
    return;
  }

  try {
    setActionLoading(true);
    setError("");
    
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();

    const contract = new ethers.Contract(HealthRecordAddress, HealthRecordSecure.abi, signer);

    let tx;
    if (!transferModal.patient.isActive) {
      tx = await contract.reactivatePatient(transferModal.patient.wallet, selectedDoctor);
    } else if (transferModal.patient.doctorStatus === "removed") {
      tx = await contract.adminTransferPatient(transferModal.patient.wallet, selectedDoctor);
    } else {
      setError("Cannot transfer patient with an active doctor.");
      setActionLoading(false);
      return;
    }

    await tx.wait();

    setSuccess(
      `${transferModal.patient.fullName} has been successfully assigned to Dr. ${
        doctors.find(d => d.walletAddress === selectedDoctor)?.fullName || 'the new doctor'
      }.`
    );
    setTransferModal({ open: false, patient: null });
    setSelectedDoctor("");

    setTimeout(() => {
      loadData();
      setSuccess("");
    }, 3000);
  } catch (err) {
    setError(`Failed to transfer: ${err.reason || err.message}`);
    setTimeout(() => setError(""), 5000);
  } finally {
    setActionLoading(false);
  }
};
  const filteredPatients = patients.filter((p) => {
    if (filter === "active") return p.isActive;
    if (filter === "inactive") return !p.isActive;
    return true;
  });

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
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "2em" }}>
        <h1 style={{ fontSize: "2.5em", fontWeight: "bold", marginBottom: "1em" }}>
          All Patients
        </h1>

        {success && (
          <div
            style={{
              backgroundColor: "#d4edda",
              borderLeft: "4px solid #28a745",
              padding: "1em",
              borderRadius: "8px",
              marginBottom: "1.5em",
            }}
          >
            <p style={{ color: "#155724", margin: 0 }}>{success}</p>
          </div>
        )}

        {error && (
          <div
            style={{
              backgroundColor: "#fee",
              borderLeft: "4px solid #f44",
              padding: "1em",
              borderRadius: "8px",
              marginBottom: "1.5em",
            }}
          >
            <p style={{ color: "#c00", margin: 0 }}>{error}</p>
          </div>
        )}

        <div style={{ display: "flex", gap: "0.8em", marginBottom: "1.5em" }}>
          <button
            onClick={() => setFilter("all")}
            style={{
              backgroundColor: filter === "all" ? "#009688" : "white",
              color: filter === "all" ? "white" : "#555",
              border: "2px solid #009688",
              padding: "0.7em 1.2em",
              borderRadius: "8px",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: "0.95em",
            }}
          >
            All Patients ({patients.length})
          </button>
          <button
            onClick={() => setFilter("active")}
            style={{
              backgroundColor: filter === "active" ? "#009688" : "white",
              color: filter === "active" ? "white" : "#555",
              border: "2px solid #009688",
              padding: "0.7em 1.2em",
              borderRadius: "8px",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: "0.95em",
            }}
          >
            Active ({patients.filter((p) => p.isActive).length})
          </button>
          <button
            onClick={() => setFilter("inactive")}
            style={{
              backgroundColor: filter === "inactive" ? "#d32f2f" : "white",
              color: filter === "inactive" ? "white" : "#555",
              border: "2px solid #d32f2f",
              padding: "0.7em 1.2em",
              borderRadius: "8px",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: "0.95em",
            }}
          >
            Inactive ({patients.filter((p) => !p.isActive).length})
          </button>
        </div>

        {filteredPatients.length === 0 ? (
          <div
            style={{
              backgroundColor: "#e3f2fd",
              borderLeft: "4px solid #2196F3",
              padding: "2em",
              borderRadius: "8px",
              textAlign: "center",
            }}
          >
            <h3 style={{ fontSize: "1.5em", fontWeight: "bold", color: "#1565C0" }}>
              No Patients Found
            </h3>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(500px, 1fr))",
              gap: "1.5em",
            }}
          >
            {filteredPatients.map((patient, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: "white",
                  borderRadius: "12px",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                  border: "2px solid #e8e8e8",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    background: patient.isActive
                      ? "linear-gradient(135deg, #009688 0%, #00bfa5 100%)"
                      : "linear-gradient(135deg, #757575 0%, #616161 100%)",
                    padding: "1.2em",
                    color: "white",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <h3 style={{ fontSize: "1.5em", fontWeight: "bold", margin: 0 }}>
                      {patient.fullName}
                    </h3>
                    <span
                      style={{
                        backgroundColor: "white",
                        color: patient.isActive ? "#009688" : "#757575",
                        padding: "0.4em 0.9em",
                        borderRadius: "15px",
                        fontWeight: "bold",
                        fontSize: "0.9em",
                      }}
                    >
                      ID: {patient.patientId}
                    </span>
                  </div>
                </div>

                <div style={{ padding: "1.3em" }}>
                  <div style={{ marginBottom: "1.2em" }}>
                    <span
                      style={{
                        backgroundColor: patient.isActive ? "#e8f5e9" : "#ffebee",
                        color: patient.isActive ? "#2e7d32" : "#c62828",
                        padding: "0.5em 1em",
                        borderRadius: "15px",
                        fontWeight: "600",
                        fontSize: "0.9em",
                      }}
                    >
                      {patient.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "1em",
                      marginBottom: "1.2em",
                    }}
                  >
                    <div>
                      <p
                        style={{
                          fontSize: "0.8em",
                          color: "#555",
                          fontWeight: "600",
                          margin: 0,
                          marginBottom: "0.3em",
                        }}
                      >
                        AGE
                      </p>
                      <p
                        style={{
                          fontSize: "1.3em",
                          fontWeight: "bold",
                          color: "#2c3e50",
                          margin: 0,
                        }}
                      >
                        {patient.age} years
                      </p>
                    </div>

                    <div>
                      <p
                        style={{
                          fontSize: "0.8em",
                          color: "#555",
                          fontWeight: "600",
                          margin: 0,
                          marginBottom: "0.3em",
                        }}
                      >
                        BLOOD GROUP
                      </p>
                      <p
                        style={{
                          fontSize: "1.4em",
                          fontWeight: "bold",
                          color: "#d32f2f",
                          margin: 0,
                        }}
                      >
                        {patient.bloodGroup}
                      </p>
                    </div>

                    <div style={{ gridColumn: "1 / -1" }}>
                      <p
                        style={{
                          fontSize: "0.8em",
                          color: "#555",
                          fontWeight: "600",
                          margin: 0,
                          marginBottom: "0.3em",
                        }}
                      >
                        PHONE NUMBER
                      </p>
                      <p
                        style={{
                          fontSize: "1.1em",
                          color: "#2c3e50",
                          margin: 0,
                          fontWeight: "500",
                        }}
                      >
                        {patient.phone}
                      </p>
                    </div>
                  </div>

                  {patient.doctorStatus === "removed" ? (
                    <div
                      style={{
                        backgroundColor: "#fff3cd",
                        border: "2px solid #ffc107",
                        borderRadius: "8px",
                        padding: "1em",
                        marginBottom: "1em",
                      }}
                    >
                      <p
                        style={{
                          color: "#856404",
                          fontSize: "0.8em",
                          fontWeight: "600",
                          margin: 0,
                          marginBottom: "0.5em",
                        }}
                      >
                        DOCTOR NOT IN SYSTEM
                      </p>
                      <p
                        style={{
                          margin: 0,
                          color: "#856404",
                          fontSize: "1.1em",
                          fontWeight: "bold",
                          marginBottom: "0.3em",
                        }}
                      >
                        Dr. {patient.doctorName}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          color: "#856404",
                          fontSize: "0.85em",
                        }}
                      >
                        Transfer to available doctor required
                      </p>
                    </div>
                  ) : (
                    <div
                      style={{
                        backgroundColor: "#f5f5f5",
                        border: "1px solid #e0e0e0",
                        borderRadius: "8px",
                        padding: "1em",
                        marginBottom: "1em",
                      }}
                    >
                      <p
                        style={{
                          color: "#555",
                          fontSize: "0.8em",
                          fontWeight: "600",
                          margin: 0,
                          marginBottom: "0.3em",
                        }}
                      >
                        {patient.isActive ? "CURRENT DOCTOR" : "LAST DOCTOR"}
                      </p>
                      <p
                        style={{
                          fontSize: "1.15em",
                          fontWeight: "bold",
                          color: "#2c3e50",
                          margin: 0,
                          marginBottom: "0.2em",
                        }}
                      >
                        Dr. {patient.doctorName}
                      </p>
                      <p style={{ color: "#666", fontSize: "0.9em", margin: 0 }}>
                        {patient.doctorDept}
                      </p>
                    </div>
                  )}

                  {patient.doctorStatus === "removed" && patient.isActive && (
                    <button
                      onClick={() =>
                        setTransferModal({ open: true, patient: patient })
                      }
                      style={{
                        width: "100%",
                        backgroundColor: "#ff9800",
                        color: "white",
                        padding: "0.9em",
                        borderRadius: "8px",
                        fontWeight: "bold",
                        fontSize: "1em",
                        border: "none",
                        cursor: "pointer",
                      }}
                      onMouseOver={(e) =>
                        (e.target.style.backgroundColor = "#f57c00")
                      }
                      onMouseOut={(e) =>
                        (e.target.style.backgroundColor = "#ff9800")
                      }
                    >
                      Transfer to Available Doctor
                    </button>
                  )}

                  {!patient.isActive && (
                    <button
                      onClick={() =>
                        setTransferModal({ open: true, patient: patient })
                      }
                      style={{
                        width: "100%",
                        backgroundColor: "#4caf50",
                        color: "white",
                        padding: "0.9em",
                        borderRadius: "8px",
                        fontWeight: "bold",
                        fontSize: "1em",
                        border: "none",
                        cursor: "pointer",
                      }}
                      onMouseOver={(e) =>
                        (e.target.style.backgroundColor = "#388e3c")
                      }
                      onMouseOut={(e) =>
                        (e.target.style.backgroundColor = "#4caf50")
                      }
                    >
                      Reactivate Patient
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {transferModal.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1em",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
              maxWidth: "450px",
              width: "100%",
              padding: "1.5em",
            }}
          >
            <h2 style={{ fontSize: "1.5em", fontWeight: "bold", marginBottom: "1em" }}>
              {transferModal.patient?.isActive
                ? "Transfer Patient"
                : "Reactivate Patient"}
            </h2>

            <div
              style={{
                backgroundColor: "#e3f2fd",
                borderLeft: "4px solid #2196F3",
                padding: "0.8em",
                borderRadius: "6px",
                marginBottom: "1em",
              }}
            >
              <p style={{ fontWeight: "bold", color: "#1565C0", margin: 0 }}>
                {transferModal.patient?.fullName}
              </p>
              <p style={{ fontSize: "0.85em", color: "#1976D2", margin: 0 }}>
                Patient ID: {transferModal.patient?.patientId}
              </p>
            </div>

            <div style={{ marginBottom: "1em" }}>
              <label
                style={{
                  display: "block",
                  fontWeight: "600",
                  marginBottom: "0.5em",
                  color: "#555",
                }}
              >
                Select Doctor
              </label>
              <select
                value={selectedDoctor}
                onChange={(e) => setSelectedDoctor(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.7em",
                  border: "2px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1em",
                }}
              >
                <option value="">Choose a doctor</option>
                {doctors.map((doc) => (
                  <option key={doc.walletAddress} value={doc.walletAddress}>
                    Dr. {doc.fullName} - {doc.department}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: "0.8em" }}>
              <button
                onClick={() => {
                  setTransferModal({ open: false, patient: null });
                  setSelectedDoctor("");
                }}
                disabled={actionLoading}
                style={{
                  flex: 1,
                  backgroundColor: "#e0e0e0",
                  color: "#555",
                  padding: "0.8em",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleTransferPatient}
                disabled={actionLoading || !selectedDoctor}
                style={{
                  flex: 1,
                  backgroundColor:
                    actionLoading || !selectedDoctor ? "#bdbdbd" : "#009688",
                  color: "white",
                  padding: "0.8em",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  border: "none",
                  cursor:
                    actionLoading || !selectedDoctor ? "not-allowed" : "pointer",
                }}
              >
                {actionLoading ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}