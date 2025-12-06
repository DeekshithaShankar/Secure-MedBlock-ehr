import { useEffect, useState } from "react";
import { ethers } from "ethers";
import {
  Header,
  Icon,
  Message,
  Dropdown,
  Button,
  Modal,
  Loader,
  Form,
  TextArea,
} from "semantic-ui-react";
import DoctorLayout from "../../components/DoctorLayout";
import HealthRecordSecure from "../../artifacts/contracts/HealthRecordSecure.sol/HealthRecordSecure.json";
import DoctorRegistry from "../../artifacts/contracts/DoctorRegistry.sol/DoctorRegistry.json";
import { HealthRecordAddress, ContractAddress } from "../../config";
import { smartDecrypt, decryptWithSharedKey, generateEncryptedDataHash, generateSharedKey } from "../../utils/secureEncryption";
import { downloadEncryptedFile } from "../../utils/ipfs";

export default function ViewRecords() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [patientInfo, setPatientInfo] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [doctorAddress, setDoctorAddress] = useState("");
  const [showDecryptModal, setShowDecryptModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptedContent, setDecryptedContent] = useState(null);
  const [decryptError, setDecryptError] = useState("");
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestPurpose, setRequestPurpose] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);

  useEffect(() => {
    loadPatients();
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", () => {
        clearAllData();
        loadPatients();
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners("accountsChanged");
      }
    };
  }, []);

  const clearAllData = () => {
    setPatients([]);
    setSelectedPatient("");
    setPatientInfo(null);
    setRecords([]);
    setError("");
    setDecryptedContent(null);

    if (typeof window !== "undefined") {
      localStorage.removeItem("cachedPatients");
      localStorage.removeItem("selectedPatient");
      sessionStorage.clear();
    }
  };

  const loadPatients = async () => {
    try {
      if (!window.ethereum) throw new Error("MetaMask not detected");

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      setDoctorAddress(address);

      const contract = new ethers.Contract(
        HealthRecordAddress,
        HealthRecordSecure.abi,
        signer
      );

      const allPatients = await contract.getMyPatients();

      const formatted = allPatients
        .filter((p) => {
          const isActive = p.isActive !== undefined ? p.isActive : true;
          return isActive;
        })
        .map((p) => {
          const wallet = p.walletAddress || p[1] || (Array.isArray(p) ? p[1] : undefined);
          const name = p.fullName || p[2] || "Unknown";
          const id = p.patientId || p[0];
          return {
            key: wallet,
            text: name, // Show only name, no wallet address
            value: wallet,
            details: { id, wallet, name },
          };
        });

      setPatients(formatted);
    } catch (err) {
      setError("Failed to load patients. Please reconnect MetaMask.");
    }
  };

  const handleLoadRecords = async () => {
    if (!selectedPatient) {
      setError("Please select a patient first.");
      return;
    }

    if (!ethers.utils.isAddress(selectedPatient)) {
      setError("Invalid patient address selected.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setRecords([]);
      setPatientInfo(null);

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        HealthRecordAddress,
        HealthRecordSecure.abi,
        signer
      );

      const patientDetails = await contract.getPatientDetails(selectedPatient);
      const isActive = patientDetails[6] !== undefined ? patientDetails[6] : true;

      if (!isActive) {
        setError("This patient has been removed and is no longer active.");
        setLoading(false);
        return;
      }

      const [name, age, blood, phone, doctor] = await contract.getPatient(
        selectedPatient
      );

      setPatientInfo({ name, age, blood, phone, doctor });

      let recordsList;
      try {
        recordsList = await contract.getPatientRecords(selectedPatient);

        try {
          const tx = await contract.getPatientRecordsWithLogging(selectedPatient);
          await tx.wait();
        } catch {
        }
      } catch (err1) {
        const selected = patients.find((p) => p.value === selectedPatient);
        const patientId = selected?.details?.id;
        if (patientId) {
          recordsList = await contract.getPatientRecordsByDoctor(patientId);
        } else {
          throw new Error("Could not resolve patient ID");
        }
      }

      const doctorContract = new ethers.Contract(
        ContractAddress,
        DoctorRegistry.abi,
        provider
      );

      const mappedRecords = await Promise.all(
        recordsList.map(async (r) => {
          let doctorName = "Unknown Doctor";
          try {
            const doctorInfo = await doctorContract.getDoctorInfoSafe(r.addedBy);
            if (doctorInfo.exists) {
              doctorName = doctorInfo.fullName || "Unknown Doctor";
            }
          } catch {
            try {
              const oldDoctorData = await doctorContract.getDoctorByAddress(r.addedBy);
              doctorName = oldDoctorData[1] || "Unknown Doctor";
            } catch {
              doctorName = "Unknown Doctor";
            }
          }

          const isCreator = r.addedBy?.toLowerCase() === doctorAddress.toLowerCase();
          let hasConsent = false;

          if (!isCreator) {
            try {
              hasConsent = await contract.hasConsent(selectedPatient, doctorAddress);
            } catch {
              hasConsent = false;
            }
          }

          return {
            id: r.id ? r.id.toString() : "N/A",
            description: r.description || "No description",
            ipfsHash: r.ipfsHash || "",
            integrityHash: r.integrityHash || "",
            date: r.date ? r.date.toNumber() : Date.now() / 1000,
            addedBy: r.addedBy || "",
            doctorName,
            isEncrypted: r.isEncrypted !== undefined ? r.isEncrypted : true,
            encryptionVersion: r.encryptionVersion || "AES-256-WALLET-DERIVED",
            canDecrypt: isCreator || hasConsent, // Doctor can decrypt if they created OR have consent
            isCreator,
            hasConsent,
          };
        })
      );

      setRecords(mappedRecords);

      try {
        const pendingReq = await contract.hasPendingRequest(selectedPatient, doctorAddress);
        setHasPendingRequest(pendingReq);
      } catch {
        setHasPendingRequest(false);
      }
    } catch (err) {
      setError(err.reason || err.message || "Failed to load records");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestConsent = async () => {
    if (!selectedPatient || !requestPurpose) {
      setError("Please provide a reason for your access request");
      return;
    }

    try {
      setRequestLoading(true);
      setError("");

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        HealthRecordAddress,
        HealthRecordSecure.abi,
        signer
      );

      const tx = await contract.requestConsent(selectedPatient, requestPurpose);
      await tx.wait();

      setSuccess("Access request sent successfully! The patient will review your request.");
      setShowRequestModal(false);
      setRequestPurpose("");
      setHasPendingRequest(true);

      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      setError(err.reason || err.message || "Failed to send request");
    } finally {
      setRequestLoading(false);
    }
  };

  const handleViewRecord = (record) => {
    setSelectedRecord(record);
    setDecryptedContent(null);
    setDecryptError("");
    setShowDecryptModal(true);
  };

  const performDecryption = async () => {
    if (!selectedRecord) return;

    setDecrypting(true);
    setDecryptError("");

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const currentAddress = await signer.getAddress();

      if (!selectedRecord.canDecrypt) {
        setDecryptError(
          "Access Denied: You need patient consent to view this record. " +
          "Please request access from the patient through the consent management system."
        );
        setDecrypting(false);
        return;
      }

      const response = await fetch(`https://gateway.pinata.cloud/ipfs/${selectedRecord.ipfsHash}`);
      if (!response.ok) {
        throw new Error("Could not fetch record from IPFS.");
      }
      const encryptedData = await response.text();

      let result;

      if (selectedRecord.isCreator) {
        result = await smartDecrypt(
          encryptedData,
          selectedRecord.integrityHash,
          signer
        );
      } else {
        const currentHash = generateEncryptedDataHash(encryptedData);
        const integrityOk = !selectedRecord.integrityHash || currentHash === selectedRecord.integrityHash;

        if (!integrityOk) {
          setDecryptError("Data integrity check failed - record may have been tampered with.");
          setDecrypting(false);
          return;
        }

        const payload = JSON.parse(encryptedData);

        if (payload.v === "2.0") {
          const sharedResult = decryptWithSharedKey(payload, currentAddress);
          result = {
            data: sharedResult.data,
            integrityVerified: true,
            isLegacy: false,
            accessType: "consent"
          };
        } else {
          throw new Error("Cannot decrypt: This record uses legacy encryption that doesn't support consent-based access.");
        }
      }

      if (result.integrityVerified === false && !result.isLegacy) {
        setDecryptError("WARNING: Data integrity check failed. The record may have been tampered with.");
      }

      setDecryptedContent({
        ...result.data,
        integrityVerified: result.integrityVerified,
        isLegacy: result.isLegacy,
        warning: result.warning,
        accessType: result.accessType || (selectedRecord.isCreator ? "creator" : "consent")
      });

    } catch (err) {
      if (err.code === 4001) {
        setDecryptError("You cancelled the signature request. Please sign to decrypt.");
      } else {
        setDecryptError(err.message || "Failed to decrypt record");
      }
    } finally {
      setDecrypting(false);
    }
  };

  const handleRefresh = () => {
    clearAllData();
    loadPatients();
  };

  return (
    <DoctorLayout>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2em" }}>
        <Header
          as="h1"
          style={{
            fontSize: "2.5em",
            marginBottom: "1em",
            textAlign: "center",
          }}
        >
          <Icon name="file alternate" /> View Medical Records
        </Header>

        <div
          style={{
            backgroundColor: "white",
            borderRadius: "18px",
            boxShadow: "0 6px 25px rgba(0,0,0,0.12)",
            border: "2px solid #e8e8e8",
            padding: "2em",
            marginBottom: "2em",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.5em",
            }}
          >
            <h2 style={{ fontSize: "1.5em", fontWeight: "bold", margin: 0 }}>
              Select Patient
            </h2>
            <Button
              icon
              labelPosition="left"
              onClick={handleRefresh}
              size="medium"
              color="grey"
            >
              <Icon name="refresh" />
              Refresh List
            </Button>
          </div>

          <Dropdown
            placeholder="Select Patient"
            fluid
            selection
            search
            options={patients}
            value={selectedPatient}
            onChange={(_, { value }) => setSelectedPatient(value)}
            style={{ marginBottom: "1.5em", fontSize: "1.1em" }}
          />

          <Button
            color="teal"
            icon
            labelPosition="left"
            onClick={handleLoadRecords}
            loading={loading}
            size="large"
            fluid
          >
            <Icon name="search" /> Load Medical Records
          </Button>
        </div>

        {error && (
          <Message
            negative
            size="large"
            style={{ fontSize: "1.1em", marginBottom: "2em" }}
            onDismiss={() => setError("")}
          >
            {error}
          </Message>
        )}

        {success && (
          <Message
            positive
            size="large"
            style={{ fontSize: "1.1em", marginBottom: "2em" }}
            onDismiss={() => setSuccess("")}
          >
            <Icon name="check circle" />
            {success}
          </Message>
        )}

        {patientInfo && records.length > 0 && !records.some(r => r.canDecrypt) && !hasPendingRequest && (
          <div
            style={{
              backgroundColor: "#fff3e0",
              border: "2px solid #ff9800",
              borderRadius: "12px",
              padding: "1.5em",
              marginBottom: "2em",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <h3 style={{ margin: 0, color: "#e65100", fontWeight: "bold" }}>
                <Icon name="lock" /> Access Required
              </h3>
              <p style={{ margin: "0.5em 0 0 0", color: "#f57c00" }}>
                You need patient consent to view these records. Click the button to request access.
              </p>
            </div>
            <Button
              color="teal"
              size="large"
              onClick={() => setShowRequestModal(true)}
            >
              <Icon name="hand paper" /> Request Access
            </Button>
          </div>
        )}

        {patientInfo && hasPendingRequest && (
          <div
            style={{
              backgroundColor: "#e3f2fd",
              border: "2px solid #2196f3",
              borderRadius: "12px",
              padding: "1.5em",
              marginBottom: "2em",
            }}
          >
            <h3 style={{ margin: 0, color: "#1565c0", fontWeight: "bold" }}>
              <Icon name="clock" /> Request Pending
            </h3>
            <p style={{ margin: "0.5em 0 0 0", color: "#1976d2" }}>
              Your access request is pending approval from the patient. You will be able to view records once approved.
            </p>
          </div>
        )}

        {patientInfo && (
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "18px",
              boxShadow: "0 6px 25px rgba(0,0,0,0.12)",
              border: "2px solid #e8e8e8",
              overflow: "hidden",
              marginBottom: "2em",
            }}
          >
            <div
              style={{
                background: "linear-gradient(135deg, #009688 0%, #00bfa5 100%)",
                padding: "2em",
                color: "white",
              }}
            >
              <h2 style={{ fontSize: "1.8em", fontWeight: "bold", margin: 0, marginBottom: "0.3em" }}>
                Patient Information
              </h2>
            </div>

            <div style={{ padding: "2em" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1.5em",
                  fontSize: "1.15em",
                }}
              >
                <div style={{ display: "flex" }}>
                  <span style={{ fontWeight: "600", minWidth: "140px", color: "#555" }}>
                    Patient Name:
                  </span>
                  <span style={{ color: "#2c3e50", fontWeight: "bold" }}>
                    {patientInfo.name}
                  </span>
                </div>

                <div style={{ display: "flex" }}>
                  <span style={{ fontWeight: "600", minWidth: "140px", color: "#555" }}>
                    Age:
                  </span>
                  <span style={{ color: "#2c3e50" }}>
                    {patientInfo.age.toString()} years
                  </span>
                </div>

                <div style={{ display: "flex" }}>
                  <span style={{ fontWeight: "600", minWidth: "140px", color: "#555" }}>
                    Blood Group:
                  </span>
                  <span style={{ color: "#d32f2f", fontWeight: "bold", fontSize: "1.1em" }}>
                    {patientInfo.blood}
                  </span>
                </div>

                <div style={{ display: "flex" }}>
                  <span style={{ fontWeight: "600", minWidth: "140px", color: "#555" }}>
                    Phone:
                  </span>
                  <span style={{ color: "#2c3e50" }}>{patientInfo.phone}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {records.length > 0 && (
          <div>
            <h2 style={{ fontSize: "1.8em", fontWeight: "bold", marginBottom: "1em" }}>
              Medical Records ({records.length})
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(500px, 1fr))",
                gap: "2em",
              }}
            >
              {records.map((rec, i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: "white",
                    borderRadius: "18px",
                    boxShadow: "0 6px 25px rgba(0,0,0,0.12)",
                    border: "2px solid #009688",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      background: "linear-gradient(135deg, #009688 0%, #00bfa5 100%)",
                      padding: "1.5em",
                      color: "white",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                      <h3 style={{ fontSize: "1.4em", fontWeight: "bold", margin: 0, flex: 1 }}>
                        {rec.description}
                      </h3>
                      <span
                        style={{
                          backgroundColor: "white",
                          color: "#009688",
                          padding: "0.3em 0.8em",
                          borderRadius: "15px",
                          fontWeight: "bold",
                          fontSize: "0.9em",
                        }}
                      >
                        ID: {rec.id}
                      </span>
                    </div>
                    <p style={{ margin: 0, color: "rgba(255,255,255,0.8)", fontSize: "0.9em", marginTop: "0.5em" }}>
                      {new Date(rec.date * 1000).toLocaleString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  <div style={{ padding: "1.5em" }}>
                    <div style={{ marginBottom: "1em" }}>
                      {rec.isCreator ? (
                        <span
                          style={{
                            backgroundColor: "#e0f2f1",
                            color: "#00796b",
                            padding: "0.5em 1em",
                            borderRadius: "20px",
                            fontWeight: "600",
                            fontSize: "0.9em",
                          }}
                        >
                          <Icon name="check circle" /> You created this record
                        </span>
                      ) : rec.hasConsent ? (
                        <span
                          style={{
                            backgroundColor: "#e0f2f1",
                            color: "#00796b",
                            padding: "0.5em 1em",
                            borderRadius: "20px",
                            fontWeight: "600",
                            fontSize: "0.9em",
                          }}
                        >
                          <Icon name="handshake" /> Patient granted access
                        </span>
                      ) : (
                        <span
                          style={{
                            backgroundColor: "#fff3e0",
                            color: "#e65100",
                            padding: "0.5em 1em",
                            borderRadius: "20px",
                            fontWeight: "600",
                            fontSize: "0.9em",
                          }}
                        >
                          <Icon name="lock" /> Consent required
                        </span>
                      )}
                    </div>

                    <div style={{ marginBottom: "1em" }}>
                      <p style={{ fontWeight: "600", color: "#555", marginBottom: "0.3em", fontSize: "0.9em" }}>
                        Added By:
                      </p>
                      <p style={{ margin: 0, fontSize: "1em", color: "#2c3e50", fontWeight: "bold" }}>
                        Dr. {rec.doctorName}
                      </p>
                    </div>

                    <Button
                      color="teal"
                      fluid
                      onClick={() => handleViewRecord(rec)}
                    >
                      <Icon name="eye" /> View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && records.length === 0 && patientInfo && (
          <div
            style={{
              backgroundColor: "#e3f2fd",
              borderLeft: "4px solid #2196F3",
              padding: "2em",
              borderRadius: "8px",
              textAlign: "center",
            }}
          >
            <Icon name="inbox" size="huge" style={{ color: "#2196F3" }} />
            <h3 style={{ fontSize: "1.8em", fontWeight: "bold", color: "#1565C0", marginTop: "1em" }}>
              No Records Found
            </h3>
            <p style={{ color: "#1976D2", fontSize: "1.1em", margin: 0 }}>
              This patient doesn't have any medical records yet.
            </p>
          </div>
        )}

        <Modal
          open={showDecryptModal}
          onClose={() => setShowDecryptModal(false)}
          size="large"
        >
          <Modal.Header>
            <Icon name="lock open" /> View Medical Record
          </Modal.Header>
          <Modal.Content>
            {!decryptedContent && !decrypting && !decryptError && (
              <div style={{ textAlign: "center", padding: "2em" }}>
                <Icon name="key" size="huge" style={{ color: "#009688", marginBottom: "1em" }} />
                <h3 style={{ fontSize: "1.3em", marginBottom: "1em" }}>Decrypt Record</h3>
                {selectedRecord?.isCreator ? (
                  <p style={{ color: "#666", marginBottom: "1.5em" }}>
                    You created this record. Click below to decrypt and view the contents.
                  </p>
                ) : selectedRecord?.hasConsent ? (
                  <p style={{ color: "#666", marginBottom: "1.5em" }}>
                    The patient has granted you access to view this record.
                    Click below to decrypt and view the contents.
                  </p>
                ) : (
                  <Message warning>
                    <p>
                      This record was created by another doctor. You need patient consent
                      to view it. The patient can grant you access from their consent management page.
                    </p>
                  </Message>
                )}
                <Button
                  color="teal"
                  size="large"
                  onClick={performDecryption}
                  disabled={!selectedRecord?.canDecrypt}
                >
                  <Icon name="eye" />
                  View Record
                </Button>
              </div>
            )}

            {decrypting && (
              <div style={{ textAlign: "center", padding: "3em" }}>
                <Loader active size="large">Decrypting record...</Loader>
                <p style={{ color: "#666", marginTop: "1em" }}>
                  Processing...
                </p>
              </div>
            )}

            {decryptError && (
              <Message negative>
                <Message.Header>Cannot Decrypt</Message.Header>
                <p>{decryptError}</p>
              </Message>
            )}

            {decryptedContent && (
              <div>
                {decryptedContent.integrityVerified ? (
                  <Message positive>
                    <Icon name="check circle" />
                    Data integrity verified
                  </Message>
                ) : decryptedContent.isLegacy ? (
                  <Message warning>
                    <Icon name="warning sign" />
                    {decryptedContent.warning || "This is a legacy record"}
                  </Message>
                ) : null}

                <div style={{ backgroundColor: "#f9f9f9", borderRadius: "12px", padding: "1.5em", marginTop: "1em" }}>
                  <h4 style={{ fontWeight: "bold", fontSize: "1.2em", marginBottom: "1em" }}>Record Details</h4>

                  {decryptedContent.diagnosis && (
                    <div style={{ marginBottom: "1em" }}>
                      <p style={{ fontWeight: "600", color: "#555" }}>Diagnosis:</p>
                      <p style={{ color: "#2c3e50" }}>{decryptedContent.diagnosis}</p>
                    </div>
                  )}

                  {decryptedContent.prescription && (
                    <div style={{ marginBottom: "1em" }}>
                      <p style={{ fontWeight: "600", color: "#555" }}>Prescription:</p>
                      <p style={{ color: "#2c3e50", whiteSpace: "pre-wrap" }}>{decryptedContent.prescription}</p>
                    </div>
                  )}

                  {decryptedContent.notes && (
                    <div style={{ marginBottom: "1em" }}>
                      <p style={{ fontWeight: "600", color: "#555" }}>Notes:</p>
                      <p style={{ color: "#2c3e50", whiteSpace: "pre-wrap" }}>{decryptedContent.notes}</p>
                    </div>
                  )}

                  {decryptedContent.fileName && decryptedContent.fileCid && (
                    <div style={{ marginBottom: "1em" }}>
                      <p style={{ fontWeight: "600", color: "#555" }}>Attached File:</p>
                      <p style={{ color: "#2c3e50" }}>{decryptedContent.fileName}</p>
                      {decryptedContent.fileEncrypted ? (
                        <Button
                          size="small"
                          color="teal"
                          onClick={async () => {
                            try {
                              const encryptionKey = generateSharedKey(
                                decryptedContent.encryptedBy,
                                decryptedContent.forPatient
                              );
                              const fileData = await downloadEncryptedFile(
                                decryptedContent.fileCid,
                                encryptionKey
                              );
                              const newWindow = window.open();
                              newWindow.document.write(`
                                <html>
                                  <head><title>${fileData.fileName}</title></head>
                                  <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f0f0f0;">
                                    ${fileData.fileType.startsWith('image/')
                                      ? `<img src="${fileData.dataUrl}" style="max-width:100%;max-height:100vh;" />`
                                      : `<iframe src="${fileData.dataUrl}" style="width:100%;height:100vh;border:none;"></iframe>`
                                    }
                                  </body>
                                </html>
                              `);
                            } catch (err) {
                              alert("Failed to decrypt file: " + err.message);
                            }
                          }}
                        >
                          <Icon name="lock open" /> Decrypt & View
                        </Button>
                      ) : (
                        <a
                          href={`https://gateway.pinata.cloud/ipfs/${decryptedContent.fileCid}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "#009688" }}
                        >
                          View Attachment (Legacy)
                        </a>
                      )}
                    </div>
                  )}

                  {decryptedContent.timestamp && (
                    <div style={{ marginTop: "1em", paddingTop: "1em", borderTop: "1px solid #e0e0e0" }}>
                      <p style={{ fontSize: "0.9em", color: "#888" }}>
                        Created: {decryptedContent.timestamp}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Modal.Content>
          <Modal.Actions>
            <Button onClick={() => {
              setShowDecryptModal(false);
              setDecryptedContent(null);
              setDecryptError("");
            }}>
              Close
            </Button>
          </Modal.Actions>
        </Modal>

        <Modal
          open={showRequestModal}
          onClose={() => setShowRequestModal(false)}
          size="small"
        >
          <Modal.Header style={{ background: "linear-gradient(135deg, #009688 0%, #00bfa5 100%)", color: "white" }}>
            <Icon name="hand paper" /> Request Record Access
          </Modal.Header>
          <Modal.Content>
            <p style={{ marginBottom: "1.5em", color: "#555" }}>
              You are requesting access to view medical records for{" "}
              <strong>{patientInfo?.name}</strong>. Please provide a reason for your request.
              The patient will be notified and can approve or reject your request.
            </p>
            <Form>
              <Form.Field required>
                <label>Purpose of Access</label>
                <TextArea
                  placeholder="e.g., Second opinion consultation, Follow-up care, Specialist review..."
                  value={requestPurpose}
                  onChange={(e) => setRequestPurpose(e.target.value)}
                  style={{ minHeight: "100px" }}
                />
              </Form.Field>
            </Form>
          </Modal.Content>
          <Modal.Actions>
            <Button onClick={() => {
              setShowRequestModal(false);
              setRequestPurpose("");
            }}>
              Cancel
            </Button>
            <Button
              color="teal"
              onClick={handleRequestConsent}
              loading={requestLoading}
              disabled={!requestPurpose.trim()}
            >
              <Icon name="paper plane" /> Send Request
            </Button>
          </Modal.Actions>
        </Modal>
      </div>
    </DoctorLayout>
  );
}
