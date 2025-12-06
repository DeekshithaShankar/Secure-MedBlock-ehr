import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { ethers } from "ethers";
import DoctorLayout from "../../components/DoctorLayout";
import HealthRecordSecure from "../../artifacts/contracts/HealthRecordSecure.sol/HealthRecordSecure.json";
import DoctorRegistry from "../../artifacts/contracts/DoctorRegistry.sol/DoctorRegistry.json";
import { HealthRecordAddress, ContractAddress } from "../../config";
import { downloadFromIPFS } from "../../utils/ipfs";
import CryptoJS from "crypto-js";

export default function PatientDetails() {
  const router = useRouter();
  const { wallet } = router.query;

  const [patient, setPatient] = useState(null);
  const [records, setRecords] = useState([]);
  const [currentDoctorName, setCurrentDoctorName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (wallet) {
      loadPatientData();
    }
  }, [wallet]);

  const decryptData = (encryptedText) => {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, "medblock-key");
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      return JSON.parse(decrypted);
    } catch {
      return {};
    }
  };

  const loadPatientData = async () => {
    try {
      if (!window.ethereum) throw new Error("MetaMask not detected");

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

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

      const patientDetails = await healthContract.getPatientDetails(wallet);

      let doctorName = "Unknown Doctor";
      try {
        const doctorData = await doctorContract.getDoctorByAddress(
          patientDetails[5]
        );
        doctorName = doctorData[1] || "Unknown Doctor";
      } catch {
      }

      setCurrentDoctorName(doctorName);

      setPatient({
        patientId: patientDetails[0].toString(),
        fullName: patientDetails[1],
        age: patientDetails[2].toString(),
        bloodGroup: patientDetails[3],
        phone: patientDetails[4],
        currentDoctor: patientDetails[5],
        isActive: patientDetails[6],
      });

      await loadMedicalRecords(wallet, healthContract, provider, doctorContract);
    } catch (err) {
      setError(err.reason || err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMedicalRecords = async (
    patientWallet,
    healthContract,
    provider,
    doctorContract
  ) => {
    try {
      const recs = await healthContract.getPatientRecords(patientWallet);

      try {
        const tx = await healthContract.getPatientRecordsWithLogging(patientWallet);
        await tx.wait();
      } catch {
      }

      const formatted = await Promise.all(
        recs.map(async (r) => {
          let doctorName = "Unknown Doctor";
          let notes = "No additional notes";
          let fileName = "";
          let fileUrl = "";

          try {
            const doctorData = await doctorContract.getDoctorByAddress(
              r.addedBy
            );
            doctorName = doctorData[1] || "Unknown Doctor";
          } catch {
          }

          try {
            const encryptedData = await downloadFromIPFS(r.ipfsHash);
            const decrypted = decryptData(encryptedData);
            notes = decrypted.notes || notes;
            fileName = decrypted.fileName || "";
            fileUrl = decrypted.fileUrl || "";
          } catch {
          }

          return {
            id: r.id.toString(),
            description: r.description,
            ipfsHash: r.ipfsHash,
            date: new Date(r.date.toNumber() * 1000).toLocaleString(),
            addedBy: r.addedBy,
            doctorName: doctorName,
            notes: notes,
            fileName: fileName,
            fileUrl: fileUrl,
          };
        })
      );

      setRecords(formatted);
    } catch {
    }
  };

  if (loading) {
    return (
      <DoctorLayout>
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-4 border-teal-600"></div>
        </div>
      </DoctorLayout>
    );
  }

  if (error) {
    return (
      <DoctorLayout>
        <div className="max-w-4xl mx-auto mt-10">
          <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg">
            <h2 className="text-2xl font-bold text-red-800 mb-2">
              Error Loading Patient
            </h2>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={() => router.push("/doctor/view-patients")}
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold"
            >
              ← Back to Patients
            </button>
          </div>
        </div>
      </DoctorLayout>
    );
  }

  if (!patient) {
    return (
      <DoctorLayout>
        <div className="max-w-4xl mx-auto mt-10">
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-lg">
            <h2 className="text-2xl font-bold text-yellow-800 mb-2">
              Patient Not Found
            </h2>
            <p className="text-yellow-700 mb-4">
              The requested patient could not be found.
            </p>
            <button
              onClick={() => router.push("/doctor/view-patients")}
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold"
            >
              ← Back to Patients
            </button>
          </div>
        </div>
      </DoctorLayout>
    );
  }

  return (
    <DoctorLayout>
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "2em" }}>
        <button
          onClick={() => router.push("/doctor/view-patients")}
          style={{
            marginBottom: "2em",
            backgroundColor: "white",
            border: "2px solid #009688",
            color: "#009688",
            padding: "0.8em 1.5em",
            borderRadius: "10px",
            fontWeight: "bold",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseOver={(e) => (e.target.style.backgroundColor = "#e0f2f1")}
          onMouseOut={(e) => (e.target.style.backgroundColor = "white")}
        >
          ← Back to Patients
        </button>

        <div
          style={{
            background: "linear-gradient(135deg, #009688 0%, #00bfa5 100%)",
            borderRadius: "18px",
            padding: "2em",
            marginBottom: "2em",
            color: "white",
            boxShadow: "0 6px 25px rgba(0,0,0,0.12)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "2em" }}>
            <div
              style={{
                width: "100px",
                height: "100px",
                backgroundColor: "white",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#009688",
                fontSize: "3em",
                fontWeight: "bold",
              }}
            >
              {patient.fullName.charAt(0)}
            </div>
            <div>
              <h1 style={{ fontSize: "2.5em", fontWeight: "bold", margin: 0 }}>
                {patient.fullName}
              </h1>
              <p style={{ color: "#b2dfdb", fontSize: "1.2em", margin: 0 }}>
                Patient ID: {patient.patientId}
              </p>
            </div>
          </div>
        </div>

        {!patient.isActive && (
          <div
            style={{
              backgroundColor: "#fff3cd",
              borderLeft: "4px solid #ffc107",
              padding: "1.5em",
              borderRadius: "8px",
              marginBottom: "2em",
            }}
          >
            <p style={{ color: "#856404", fontSize: "1.1em", margin: 0 }}>
              This patient is currently inactive. You can view their records but
              cannot add new ones.
            </p>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: "2em" }}>
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "18px",
              boxShadow: "0 6px 25px rgba(0,0,0,0.12)",
              border: "2px solid #e8e8e8",
              overflow: "hidden",
              alignSelf: "start",
              position: "sticky",
              top: "2em",
            }}
          >
            <div
              style={{
                background: "linear-gradient(135deg, #009688 0%, #00bfa5 100%)",
                padding: "1.2em",
                color: "white",
              }}
            >
              <h2 style={{ fontSize: "1.3em", fontWeight: "bold", margin: 0 }}>
                Patient Information
              </h2>
            </div>

            <div style={{ padding: "1.2em" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.8em",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#f5f5f5",
                    padding: "0.8em",
                    borderRadius: "10px",
                    border: "1px solid #e0e0e0",
                  }}
                >
                  <p
                    style={{
                      color: "#555",
                      fontSize: "0.75em",
                      fontWeight: "600",
                      margin: 0,
                      marginBottom: "0.3em",
                    }}
                  >
                    AGE
                  </p>
                  <p
                    style={{
                      fontSize: "1.4em",
                      fontWeight: "bold",
                      color: "#2c3e50",
                      margin: 0,
                    }}
                  >
                    {patient.age}
                  </p>
                </div>

                <div
                  style={{
                    backgroundColor: "#f5f5f5",
                    padding: "0.8em",
                    borderRadius: "10px",
                    border: "1px solid #e0e0e0",
                  }}
                >
                  <p
                    style={{
                      color: "#555",
                      fontSize: "0.75em",
                      fontWeight: "600",
                      margin: 0,
                      marginBottom: "0.3em",
                    }}
                  >
                    BLOOD
                  </p>
                  <p
                    style={{
                      fontSize: "1.5em",
                      fontWeight: "bold",
                      color: "#d32f2f",
                      margin: 0,
                    }}
                  >
                    {patient.bloodGroup}
                  </p>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: "#f5f5f5",
                  padding: "0.8em",
                  borderRadius: "10px",
                  border: "1px solid #e0e0e0",
                  marginTop: "0.8em",
                }}
              >
                <p
                  style={{
                    color: "#555",
                    fontSize: "0.75em",
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
                    fontWeight: "bold",
                    color: "#2c3e50",
                    margin: 0,
                  }}
                >
                  {patient.phone}
                </p>
              </div>

              <div
                style={{
                  backgroundColor: "#f5f5f5",
                  padding: "0.8em",
                  borderRadius: "10px",
                  border: "1px solid #e0e0e0",
                  marginTop: "0.8em",
                }}
              >
                <p
                  style={{
                    color: "#555",
                    fontSize: "0.75em",
                    fontWeight: "600",
                    margin: 0,
                    marginBottom: "0.3em",
                  }}
                >
                  REGISTERED BY
                </p>
                <p
                  style={{
                    fontSize: "1.1em",
                    fontWeight: "bold",
                    color: "#2c3e50",
                    margin: 0,
                  }}
                >
                  Dr. {currentDoctorName}
                </p>
              </div>

              <div
                style={{
                  backgroundColor: patient.isActive ? "#e8f5e9" : "#ffebee",
                  padding: "0.8em",
                  borderRadius: "10px",
                  border: `2px solid ${
                    patient.isActive ? "#4caf50" : "#f44336"
                  }`,
                  marginTop: "0.8em",
                }}
              >
                <p
                  style={{
                    color: patient.isActive ? "#2e7d32" : "#c62828",
                    fontSize: "0.75em",
                    fontWeight: "600",
                    margin: 0,
                    marginBottom: "0.3em",
                  }}
                >
                  STATUS
                </p>
                <p
                  style={{
                    fontSize: "1.4em",
                    fontWeight: "bold",
                    color: patient.isActive ? "#1b5e20" : "#b71c1c",
                    margin: 0,
                  }}
                >
                  {patient.isActive ? "Active" : "Inactive"}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h2
              style={{
                fontSize: "2em",
                fontWeight: "bold",
                marginBottom: "1em",
              }}
            >
              Medical Records ({records.length})
            </h2>

            {records.length === 0 ? (
              <div
                style={{
                  backgroundColor: "#e3f2fd",
                  borderLeft: "4px solid #2196F3",
                  padding: "3em",
                  borderRadius: "8px",
                  textAlign: "center",
                }}
              >
                <h3
                  style={{
                    fontSize: "1.8em",
                    fontWeight: "bold",
                    color: "#1565C0",
                    marginBottom: "0.5em",
                  }}
                >
                  No Medical Records
                </h3>
                <p style={{ color: "#1976D2", fontSize: "1.1em", margin: 0 }}>
                  This patient has no medical records yet.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5em" }}>
                {records.map((rec, idx) => (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: "white",
                      borderRadius: "18px",
                      boxShadow: "0 6px 25px rgba(0,0,0,0.12)",
                      border: "2px solid #e8e8e8",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        background:
                          "linear-gradient(135deg, #009688 0%, #00bfa5 100%)",
                        padding: "1.5em",
                        color: "white",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "start",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <h3
                            style={{
                              fontSize: "1.5em",
                              fontWeight: "bold",
                              margin: 0,
                              marginBottom: "0.5em",
                            }}
                          >
                            {rec.description}
                          </h3>
                          <p style={{ margin: 0, color: "#b2dfdb" }}>{rec.date}</p>
                        </div>
                        <span
                          style={{
                            backgroundColor: "white",
                            color: "#009688",
                            padding: "0.4em 0.9em",
                            borderRadius: "20px",
                            fontWeight: "bold",
                            fontSize: "0.95em",
                          }}
                        >
                          ID: {rec.id}
                        </span>
                      </div>
                    </div>

                    <div style={{ padding: "1.5em" }}>
                      <div style={{ marginBottom: "1.5em" }}>
                        <p
                          style={{
                            fontWeight: "600",
                            color: "#555",
                            fontSize: "0.95em",
                            marginBottom: "0.5em",
                          }}
                        >
                          MEDICAL NOTES
                        </p>
                        <div
                          style={{
                            backgroundColor: "#f5f5f5",
                            padding: "1em",
                            borderRadius: "8px",
                            border: "1px solid #e0e0e0",
                          }}
                        >
                          <p
                            style={{
                              margin: 0,
                              color: "#2c3e50",
                              fontSize: "1.05em",
                              lineHeight: "1.6",
                            }}
                          >
                            {rec.notes}
                          </p>
                        </div>
                      </div>

                      {rec.fileName && (
                        <div style={{ marginBottom: "1.5em" }}>
                          <p
                            style={{
                              fontWeight: "600",
                              color: "#555",
                              fontSize: "0.95em",
                              marginBottom: "0.5em",
                            }}
                          >
                            ATTACHED DOCUMENT
                          </p>
                          <p
                            style={{
                              margin: 0,
                              color: "#2c3e50",
                              fontSize: "1.05em",
                              backgroundColor: "#f5f5f5",
                              padding: "0.8em",
                              borderRadius: "8px",
                              border: "1px solid #e0e0e0",
                            }}
                          >
                            {rec.fileName}
                          </p>
                        </div>
                      )}

                      <div style={{ marginBottom: "1.5em" }}>
                        <p
                          style={{
                            fontWeight: "600",
                            color: "#555",
                            fontSize: "0.95em",
                            marginBottom: "0.5em",
                          }}
                        >
                          ADDED BY
                        </p>
                        <p
                          style={{
                            fontSize: "1.3em",
                            fontWeight: "bold",
                            color: "#2c3e50",
                            margin: 0,
                          }}
                        >
                          Dr. {rec.doctorName}
                        </p>
                      </div>

                      <div style={{ display: "flex", gap: "1em" }}>
                        
                         <a href={rec.fileUrl || `https://ipfs.io/ipfs/${rec.ipfsHash}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            flex: 1,
                            backgroundColor: "#009688",
                            color: "white",
                            padding: "1em",
                            borderRadius: "10px",
                            fontWeight: "bold",
                            textAlign: "center",
                            textDecoration: "none",
                            fontSize: "1.1em",
                            transition: "background-color 0.2s",
                            boxShadow: "0 3px 10px rgba(0,150,136,0.3)",
                          }}
                          onMouseOver={(e) =>
                            (e.currentTarget.style.backgroundColor = "#00796b")
                          }
                          onMouseOut={(e) =>
                            (e.currentTarget.style.backgroundColor = "#009688")
                          }
                        >
                          View Document
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DoctorLayout>
  );
}
