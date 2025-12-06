import { useEffect, useState } from "react";
import {
  Form,
  Button,
  Message,
  Dropdown,
  Header,
  Icon,
  TextArea,
} from "semantic-ui-react";
import { ethers } from "ethers";
import DoctorLayout from "../../components/DoctorLayout";
import HealthRecordSecure from "../../artifacts/contracts/HealthRecordSecure.sol/HealthRecordSecure.json";
import { HealthRecordAddress } from "../../config";
import { prepareSecureRecord, generateSharedKey } from "../../utils/secureEncryption";
import { uploadToIPFS, uploadFileToIPFS } from "../../utils/ipfs";

export default function AddRecord() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [description, setDescription] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [prescription, setPrescription] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [signingStatus, setSigningStatus] = useState("");

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      if (!window.ethereum) throw new Error("MetaMask not detected");

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      const contract = new ethers.Contract(
        HealthRecordAddress,
        HealthRecordSecure.abi,
        signer
      );

      const allPatients = await contract.getMyPatients();

      const formatted = allPatients
        .filter((p) => p.isActive)
        .map((p) => ({
          key: p.walletAddress,
          text: p.fullName,
          value: p.walletAddress,
        }));

      setPatients(formatted);

      if (formatted.length === 0) {
        setError("No active patients found. Please register patients first.");
      }
    } catch (err) {
      setError("Failed to load patients. " + (err.reason || err.message));
    }
  };

  const handleAddRecord = async () => {
    if (!selectedPatient || !description) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");
      setSigningStatus("");

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      const doctorAddress = await signer.getAddress();
      const encryptionKey = generateSharedKey(doctorAddress, selectedPatient);

      const recordData = {
        diagnosis: diagnosis || description,
        prescription,
        notes,
        timestamp: new Date().toISOString(),
      };

      if (file) {
        setSigningStatus("Encrypting and uploading file to Pinata IPFS...");
        const fileCid = await uploadFileToIPFS(file, encryptionKey);
        recordData.fileCid = fileCid;
        recordData.fileName = file.name;
        recordData.fileEncrypted = true;
      }

      setSigningStatus("Please sign the message in MetaMask to generate encryption key...");

      const { encryptedData, integrityHash } = await prepareSecureRecord(
        recordData,
        selectedPatient,
        signer
      );

      setSigningStatus("Uploading encrypted record to Pinata IPFS...");
      const ipfsHash = await uploadToIPFS(encryptedData);

      const contract = new ethers.Contract(
        HealthRecordAddress,
        HealthRecordSecure.abi,
        signer
      );

      setSigningStatus("Confirming transaction in MetaMask...");
      const tx = await contract.addRecordSecure(
        selectedPatient,
        description,
        ipfsHash,
        integrityHash,
        "AES-256-WALLET-DERIVED"
      );

      setSigningStatus("Waiting for transaction confirmation...");
      await tx.wait();

      setDescription("");
      setDiagnosis("");
      setPrescription("");
      setNotes("");
      setFile(null);
      setSelectedPatient("");
      setSigningStatus("");
    } catch (err) {
      if (err.code === 4001) {
        setError("You cancelled the signature request. Please sign to encrypt the record.");
      } else {
        setError(err.reason || err.message);
      }
      setSigningStatus("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DoctorLayout>
      <Header as="h2" color="black">
        <Icon name="plus square" /> Add Medical Record
      </Header>

      <Form loading={loading} success={!!success} error={!!error}>
        <Form.Field required>
          <label>Patient</label>
          <Dropdown
            placeholder="Select Patient"
            fluid
            search
            selection
            options={patients}
            value={selectedPatient}
            onChange={(e, { value }) => setSelectedPatient(value)}
            disabled={patients.length === 0}
            noResultsMessage="No patients available. Please register patients first."
          />
          {patients.length === 0 && (
            <Message warning>
              <Icon name="warning sign" />
              No patients registered yet. Please register patients before adding records.
            </Message>
          )}
        </Form.Field>

        <Form.Field required>
          <label>Description / Summary</label>
          <input
            placeholder="Brief description of the visit/record"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Form.Field>

        <Form.Field>
          <label>Diagnosis</label>
          <input
            placeholder="Medical diagnosis"
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
          />
        </Form.Field>

        <Form.Field>
          <label>Prescription</label>
          <TextArea
            placeholder="Medications, dosage, frequency..."
            value={prescription}
            onChange={(e) => setPrescription(e.target.value)}
          />
        </Form.Field>

        <Form.Field>
          <label>Additional Notes</label>
          <TextArea
            placeholder="Additional observations, recommendations, follow-up instructions..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Form.Field>

        <Form.Field>
          <label>Upload Report / Attachment (Optional)</label>
          <input type="file" onChange={(e) => setFile(e.target.files[0])} />
          {file && (
            <Message size="small">
              <Icon name="file" /> {file.name}
            </Message>
          )}
        </Form.Field>

        {signingStatus && (
          <Message info>
            <Icon name="spinner" loading />
            {signingStatus}
          </Message>
        )}

        <Message success>
          <Message.Header>Success!</Message.Header>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {success}
          </pre>
        </Message>
        <Message error header="Error" content={error} />

        <Button
          color="teal"
          size="large"
          onClick={handleAddRecord}
          disabled={loading || patients.length === 0}
        >
          <Icon name="lock" /> Encrypt & Save Record
        </Button>
      </Form>
    </DoctorLayout>
  );
}
