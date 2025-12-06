import { useState, useEffect } from "react";
import {
  Table,
  Button,
  Header,
  Icon,
  Message,
  Loader,
  Confirm,
} from "semantic-ui-react";
import { ethers } from "ethers";
import DoctorLayout from "../../components/DoctorLayout";
import HealthRecordSecure from "../../artifacts/contracts/HealthRecordSecure.sol/HealthRecordSecure.json";
import { HealthRecordAddress } from "../../config";

export default function ReactivatePatient() {
  const [inactivePatients, setInactivePatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [reactivating, setReactivating] = useState(false);

  useEffect(() => {
    loadInactivePatients();
  }, []);

  const loadInactivePatients = async () => {
    try {
      if (!window.ethereum) throw new Error("MetaMask not detected");

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const doctorAddress = await signer.getAddress();

      const contract = new ethers.Contract(
        HealthRecordAddress,
        HealthRecordSecure.abi,
        signer
      );

      const allPatients = await contract.getAllPatientsHistory();

      const inactive = allPatients
        .filter((p) => {
          const wasMyPatient = p.currentDoctor.toLowerCase() === doctorAddress.toLowerCase();
          return !p.isActive && wasMyPatient;
        })
        .map((p) => ({
          wallet: p.walletAddress,
          fullName: p.fullName,
          age: p.age.toString(),
          bloodGroup: p.bloodGroup,
          phone: p.phone,
          patientId: p.patientId.toString(),
        }));

      setInactivePatients(inactive);
    } catch (err) {
      setError(err.reason || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!selectedPatient) return;

    try {
      setReactivating(true);
      setError("");

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const doctorAddress = await signer.getAddress();

      const contract = new ethers.Contract(
        HealthRecordAddress,
        HealthRecordSecure.abi,
        signer
      );

      const tx = await contract.reactivatePatient(
        selectedPatient.wallet,
        doctorAddress
      );
      await tx.wait();

      setSuccess(
        `✅ ${selectedPatient.fullName} has been reactivated and assigned back to you!`
      );
      setConfirmOpen(false);
      setSelectedPatient(null);
      loadInactivePatients();
    } catch (err) {
      setError(err.reason || err.message);
    } finally {
      setReactivating(false);
    }
  };

  if (loading) {
    return (
      <DoctorLayout>
        <Loader active inline="centered" content="Loading patients..." />
      </DoctorLayout>
    );
  }

  return (
    <DoctorLayout>
      <Header as="h2" color="teal">
        <Icon name="redo" /> Reactivate Removed Patients
      </Header>

      <Message info>
        <Icon name="info circle" />
        These are patients you previously removed. You can reactivate them to
        continue their treatment under your care.
      </Message>

      {error && (
        <Message negative content={error} onDismiss={() => setError("")} />
      )}
      {success && (
        <Message positive content={success} onDismiss={() => setSuccess("")} />
      )}

      {inactivePatients.length === 0 ? (
        <Message
          icon="inbox"
          header="No Removed Patients"
          content="You haven't removed any patients yet."
        />
      ) : (
        <Table celled striped>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>
                <Icon name="id badge" /> ID
              </Table.HeaderCell>
              <Table.HeaderCell>
                <Icon name="user" /> Name
              </Table.HeaderCell>
              <Table.HeaderCell>
                <Icon name="birthday cake" /> Age
              </Table.HeaderCell>
              <Table.HeaderCell>
                <Icon name="tint" /> Blood Group
              </Table.HeaderCell>
              <Table.HeaderCell>
                <Icon name="phone" /> Phone
              </Table.HeaderCell>
              <Table.HeaderCell>
                <Icon name="wallet" /> Wallet
              </Table.HeaderCell>
              <Table.HeaderCell>Action</Table.HeaderCell>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {inactivePatients.map((p, idx) => (
              <Table.Row key={idx}>
                <Table.Cell>{p.patientId}</Table.Cell>
                <Table.Cell>
                  <strong>{p.fullName}</strong>
                </Table.Cell>
                <Table.Cell>{p.age}</Table.Cell>
                <Table.Cell>{p.bloodGroup}</Table.Cell>
                <Table.Cell>{p.phone}</Table.Cell>
                <Table.Cell style={{ fontSize: "0.85em" }}>
                  {p.wallet.slice(0, 15)}...
                </Table.Cell>
                <Table.Cell>
                  <Button
                    color="green"
                    size="small"
                    icon
                    labelPosition="left"
                    onClick={() => {
                      setSelectedPatient(p);
                      setConfirmOpen(true);
                    }}
                  >
                    <Icon name="redo" />
                    Reactivate
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      <Confirm
        open={confirmOpen}
        header="Reactivate Patient?"
        content={
          <div style={{ padding: "1em" }}>
            <p>
              Are you sure you want to reactivate{" "}
              <strong>{selectedPatient?.fullName}</strong>?
            </p>
            <p style={{ color: "#009688", marginTop: "1em" }}>
              <Icon name="check circle" />
              This will:
            </p>
            <ul style={{ color: "#666" }}>
              <li>Reactivate the patient in the system</li>
              <li>Assign them back to you as their current doctor</li>
              <li>Allow you to add new medical records</li>
            </ul>
          </div>
        }
        confirmButton={
          <Button color="green" loading={reactivating}>
            <Icon name="redo" /> Yes, Reactivate Patient
          </Button>
        }
        cancelButton="Cancel"
        onCancel={() => {
          setConfirmOpen(false);
          setSelectedPatient(null);
        }}
        onConfirm={handleReactivate}
      />
    </DoctorLayout>
  );
}