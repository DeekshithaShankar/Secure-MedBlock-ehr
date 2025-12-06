import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { Icon, Button, Modal, Message, Label, Loader } from "semantic-ui-react";
import PatientLayout from "../../components/PatientLayout";
import { HealthRecordAddress, ContractAddress } from "../../config";
import HealthRecordSecure from "../../artifacts/contracts/HealthRecordSecure.sol/HealthRecordSecure.json";
import DoctorRegistry from "../../artifacts/contracts/DoctorRegistry.sol/DoctorRegistry.json";
import { smartDecrypt, generateSharedKey } from "../../utils/secureEncryption";
import { downloadEncryptedFile } from "../../utils/ipfs";

export default function ViewRecordsSecure() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [account, setAccount] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptedContent, setDecryptedContent] = useState(null);
  const [decryptError, setDecryptError] = useState("");
  const [showDecryptModal, setShowDecryptModal] = useState(false);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      setLoading(true);
      if (!window.ethereum) throw new Error("MetaMask not detected");

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      setAccount(address);

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

      const recs = await healthContract.getPatientRecords(address);

      const enrichedRecords = await Promise.all(
        recs.map(async (rec) => {
          let doctorName = "Unknown Doctor";
          let doctorSpecialization = "";
          let doctorDepartment = "";
          let doctorStatus = "unknown";
          let doctorRemovedDate = null;

          try {
            const doctorInfo = await doctorContract.getDoctorInfoSafe(rec.addedBy);

            if (doctorInfo.exists) {
              doctorName = doctorInfo.fullName || "Unknown Doctor";
              doctorSpecialization = doctorInfo.specialization || "";
              doctorDepartment = doctorInfo.department || "";
              doctorStatus = doctorInfo.isActive ? "active" : "removed";

              if (!doctorInfo.isActive && doctorInfo.removedDate.toNumber() > 0) {
                doctorRemovedDate = new Date(doctorInfo.removedDate.toNumber() * 1000);
              }
            }
          } catch {
            try {
              const oldDoctorData = await doctorContract.getDoctorByAddress(rec.addedBy);
              doctorName = oldDoctorData[1] || "Unknown Doctor";
              doctorSpecialization = oldDoctorData[3] || "";
              doctorDepartment = oldDoctorData[4] || "";
              doctorStatus = "active";
            } catch {
              doctorStatus = "unknown";
            }
          }

          return {
            id: rec.id ? rec.id.toString() : "N/A",
            description: rec.description || "No description",
            ipfsHash: rec.ipfsHash || "",
            integrityHash: rec.integrityHash || "",
            date: rec.date ? rec.date.toNumber() : Date.now() / 1000,
            addedBy: rec.addedBy || "",
            isEncrypted: rec.isEncrypted || false,
            encryptionVersion: rec.encryptionVersion || "legacy-1.0",
            doctorName,
            doctorSpecialization,
            doctorDepartment,
            doctorStatus,
            doctorRemovedDate,
          };
        })
      );

      setRecords(enrichedRecords);
    } catch (err) {
      setError(err.reason || err.message || "Failed to load records");
    } finally {
      setLoading(false);
    }
  };

  const handleDecryptRecord = async (record) => {
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

      const response = await fetch(`https://gateway.pinata.cloud/ipfs/${selectedRecord.ipfsHash}`);
      if (!response.ok) {
        throw new Error("Could not fetch record from IPFS.");
      }
      const encryptedData = await response.text();

      const result = await smartDecrypt(
        encryptedData,
        selectedRecord.integrityHash,
        signer
      );

      if (result.integrityVerified === false && !result.isLegacy) {
        setDecryptError("WARNING: Data integrity check failed. The record may have been tampered with.");
      }

      setDecryptedContent({
        ...result.data,
        integrityVerified: result.integrityVerified,
        isLegacy: result.isLegacy,
        warning: result.warning
      });

    } catch (err) {
      if (err.code === 4001) {
        setDecryptError("You cancelled the signature request. Please sign to decrypt your records.");
      } else {
        setDecryptError(err.message || "Failed to decrypt record");
      }
    } finally {
      setDecrypting(false);
    }
  };

  if (loading) {
    return (
      <PatientLayout activeTab="records" account={account}>
        <div className="flex justify-center items-center h-96">
          <Loader active size="large">Loading Medical Records...</Loader>
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout activeTab="records" account={account}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">My Health Records</h1>
          <p className="text-gray-600 text-lg">
            Securely encrypted medical records on the blockchain
          </p>
        </div>

        {error && (
          <Message negative>
            <Message.Header>Error Loading Records</Message.Header>
            <p>{error}</p>
          </Message>
        )}

        {records.length === 0 ? (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-8 rounded-lg text-center">
            <Icon name="folder open outline" size="huge" className="text-blue-400 mb-4" />
            <h3 className="text-2xl font-bold text-blue-800 mb-2">No Medical Records</h3>
            <p className="text-blue-700">
              You don't have any medical records yet. Your doctor will add records during consultations.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {records.map((rec, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 overflow-hidden hover:shadow-xl transition-shadow"
              >
                <div className="bg-gradient-to-r from-teal-600 to-teal-500 p-5 text-white">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold flex-1">{rec.description}</h3>
                    <span className="bg-white text-teal-600 px-3 py-1 rounded-full text-sm font-bold">
                      ID: {rec.id}
                    </span>
                  </div>
                  <p className="text-teal-100 text-sm">
                    {new Date(rec.date * 1000).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>

                <div className="p-5">
                  <div className="mb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-gray-500 text-sm font-semibold mb-1">PRESCRIBED BY</p>
                        <p className="text-xl font-bold text-gray-800">
                          Dr. {rec.doctorName}
                        </p>
                        {rec.doctorSpecialization && (
                          <p className="text-gray-600 text-sm">{rec.doctorSpecialization}</p>
                        )}
                        {rec.doctorDepartment && (
                          <p className="text-gray-500 text-sm">{rec.doctorDepartment}</p>
                        )}
                      </div>
                      <div>
                        {rec.doctorStatus === "active" ? (
                          <Label color="green" size="small">
                            Active
                          </Label>
                        ) : rec.doctorStatus === "removed" ? (
                          <Label color="red" size="small">
                            No Longer Working
                          </Label>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Icon name="lock" className="text-teal-600" />
                      <span className="font-semibold text-gray-700">Securely Encrypted</span>
                    </div>
                  </div>

                  <Button
                    color="teal"
                    fluid
                    size="large"
                    onClick={() => handleDecryptRecord(rec)}
                  >
                    <Icon name="eye" /> View Details
                  </Button>
                </div>
              </div>
            ))}
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
            {!decryptedContent && !decrypting && (
              <div className="text-center py-8">
                <Icon name="key" size="huge" className="text-teal-500 mb-4" />
                <h3 className="text-xl font-bold mb-4">Decrypt Record</h3>
                <p className="text-gray-600 mb-6">
                  To view this record, you need to sign a message with MetaMask to generate
                  your personal decryption key. This ensures only you can access your medical data.
                </p>
                <Button color="teal" size="large" onClick={performDecryption}>
                  <Icon name="sign-in" /> Sign to Decrypt
                </Button>
              </div>
            )}

            {decrypting && (
              <div className="text-center py-8">
                <Loader active size="large">Decrypting record...</Loader>
                <p className="text-gray-600 mt-4">Please sign the message in MetaMask</p>
              </div>
            )}

            {decryptError && (
              <Message negative>
                <Message.Header>Decryption Failed</Message.Header>
                <p>{decryptError}</p>
                <Button color="teal" className="mt-4" onClick={performDecryption}>
                  Try Again
                </Button>
              </Message>
            )}

            {decryptedContent && (
              <div>
                {decryptedContent.integrityVerified ? (
                  <Message positive>
                    <Icon name="check circle" />
                    Data integrity verified.
                  </Message>
                ) : decryptedContent.isLegacy ? (
                  <Message warning>
                    <Icon name="warning sign" />
                    {decryptedContent.warning || "This is a legacy record without integrity verification"}
                  </Message>
                ) : (
                  <Message negative>
                    <Icon name="warning circle" />
                    Data integrity check failed.
                  </Message>
                )}

                <div className="bg-gray-50 rounded-xl p-6 mt-4">
                  <h4 className="font-bold text-lg mb-4 text-gray-800">Record Details</h4>

                  {decryptedContent.diagnosis && (
                    <div className="mb-4">
                      <p className="font-semibold text-gray-600">Diagnosis:</p>
                      <p className="text-gray-800">{decryptedContent.diagnosis}</p>
                    </div>
                  )}

                  {decryptedContent.prescription && (
                    <div className="mb-4">
                      <p className="font-semibold text-gray-600">Prescription:</p>
                      <p className="text-gray-800 whitespace-pre-wrap">{decryptedContent.prescription}</p>
                    </div>
                  )}

                  {decryptedContent.notes && (
                    <div className="mb-4">
                      <p className="font-semibold text-gray-600">Notes:</p>
                      <p className="text-gray-800 whitespace-pre-wrap">{decryptedContent.notes}</p>
                    </div>
                  )}

                  {decryptedContent.fileName && decryptedContent.fileCid && (
                    <div className="mb-4">
                      <p className="font-semibold text-gray-600">Attached File:</p>
                      <p className="text-gray-800">{decryptedContent.fileName}</p>
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
                          className="text-teal-600 hover:underline"
                        >
                          Download Attachment (Legacy)
                        </a>
                      )}
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-500">
                    <p>Record created: {decryptedContent.timestamp || "N/A"}</p>
                    <p>Encryption version: {decryptedContent.version || "legacy"}</p>
                  </div>
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
      </div>
    </PatientLayout>
  );
}
