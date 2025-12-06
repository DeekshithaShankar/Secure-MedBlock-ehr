import { useEffect, useState } from "react";
import {
  Card,
  Header,
  Icon,
  Message,
  Loader,
  Button,
  Confirm,
  Label,
  Grid,
  Tab,
  Statistic,
  Modal,
  Form,
  Dropdown,
} from "semantic-ui-react";
import { ethers } from "ethers";
import DoctorLayout from "../../components/DoctorLayout";
import HealthRecordSecure from "../../artifacts/contracts/HealthRecordSecure.sol/HealthRecordSecure.json";
import DoctorRegistry from "../../artifacts/contracts/DoctorRegistry.sol/DoctorRegistry.json";
import { HealthRecordAddress, ContractAddress } from "../../config";

export default function ViewPatients() {
  const [currentPatients, setCurrentPatients] = useState([]);
  const [transferredPatients, setTransferredPatients] = useState([]);
  const [inactivePatients, setInactivePatients] = useState([]);
  const [allDoctors, setAllDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [transferModal, setTransferModal] = useState({
    open: false,
    patient: null,
  });
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [removeConfirm, setRemoveConfirm] = useState({
    open: false,
    patient: null,
  });
  const [reactivateConfirm, setReactivateConfirm] = useState({
    open: false,
    patient: null,
  });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      if (!window.ethereum) throw new Error("MetaMask not detected");

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const doctorAddress = await signer.getAddress();

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

      const doctors = await doctorContract.getAllDoctors();
      const activeDoctors = doctors
        .filter(d => d.isActive && d.walletAddress.toLowerCase() !== doctorAddress.toLowerCase())
        .map(d => ({
          key: d.walletAddress,
          text: `Dr. ${d.fullName} - ${d.department}`,
          value: d.walletAddress,
        }));
      setAllDoctors(activeDoctors);

      const allPatients = await healthContract.getAllPatientsHistory();

      if (!allPatients || allPatients.length === 0) {
        setCurrentPatients([]);
        setTransferredPatients([]);
        setInactivePatients([]);
        setLoading(false);
        return;
      }

      const formatted = await Promise.all(
        allPatients.map(async (p) => {
          let currentDoctorName = "Unknown";
          
          if (p.currentDoctor && p.currentDoctor !== ethers.constants.AddressZero) {
            try {
              const docDetails = await doctorContract.getDoctorByAddress(p.currentDoctor);
              currentDoctorName = docDetails.fullName;
            } catch {
            }
          }

          return {
            wallet: p.walletAddress,
            fullName: p.fullName,
            age: p.age.toString(),
            bloodGroup: p.bloodGroup,
            phone: p.phone,
            patientId: p.patientId.toString(),
            currentDoctor: p.currentDoctor,
            currentDoctorName: currentDoctorName,
            isActive: p.isActive,
            exists: p.exists,
          };
        })
      );

      const current = formatted.filter(
        (p) =>
          p.currentDoctor.toLowerCase() === doctorAddress.toLowerCase() &&
          p.isActive === true &&
          p.exists === true
      );

      const transferred = formatted.filter(
        (p) =>
          p.currentDoctor.toLowerCase() !== doctorAddress.toLowerCase() &&
          p.isActive === true &&
          p.exists === true
      );

      const inactive = formatted.filter(
        (p) =>
          p.currentDoctor.toLowerCase() === doctorAddress.toLowerCase() &&
          p.isActive === false &&
          p.exists === true
      );

      setCurrentPatients(current);
      setTransferredPatients(transferred);
      setInactivePatients(inactive);

    } catch (err) {
      setError(err.reason || err.message || "Failed to load patients");
    } finally {
      setLoading(false);
    }
  };

  const handleTransferPatient = async () => {
    if (!transferModal.patient || !selectedDoctor) {
      alert("Please select a doctor");
      return;
    }

    if (!transferReason.trim()) {
      alert("Please provide a reason for transfer");
      return;
    }

    try {
      setActionLoading(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        HealthRecordAddress,
        HealthRecordSecure.abi,
        signer
      );

      const tx = await contract.transferPatient(
        transferModal.patient.wallet,
        selectedDoctor,
        transferReason
      );

      await tx.wait();

      setSuccess(`Patient ${transferModal.patient.fullName} transferred successfully!`);
      setTransferModal({ open: false, patient: null });
      setSelectedDoctor("");
      setTransferReason("");
      
      setTimeout(() => {
        loadPatients();
      }, 1000);
    } catch (err) {
      setError(err.reason || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemovePatient = async () => {
    if (!removeConfirm.patient) return;

    try {
      setActionLoading(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        HealthRecordAddress,
        HealthRecordSecure.abi,
        signer
      );

      const tx = await contract.removePatient(removeConfirm.patient.wallet);
      await tx.wait();

      setSuccess(`${removeConfirm.patient.fullName} has been removed successfully!`);
      setRemoveConfirm({ open: false, patient: null });
      
      setTimeout(() => {
        loadPatients();
      }, 1000);
    } catch (err) {
      setError(err.reason || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivatePatient = async () => {
    if (!reactivateConfirm.patient) return;

    try {
      setActionLoading(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const doctorAddress = await signer.getAddress();

      const contract = new ethers.Contract(
        HealthRecordAddress,
        HealthRecordSecure.abi,
        signer
      );

      const tx = await contract.reactivatePatient(
        reactivateConfirm.patient.wallet,
        doctorAddress
      );
      await tx.wait();

      setSuccess(`${reactivateConfirm.patient.fullName} has been reactivated successfully!`);
      setReactivateConfirm({ open: false, patient: null });
      
      setTimeout(() => {
        loadPatients();
      }, 1000);
    } catch (err) {
      setError(err.reason || err.message);
    } finally {
      setActionLoading(false);
    }
  };
const renderPatientCard = (p, type = "current") => (
  <Grid.Column key={p.wallet}>
    <Card
      fluid
      style={{
        borderRadius: "18px",
        boxShadow: "0 6px 25px rgba(0,0,0,0.12)",
        overflow: "hidden",
        minHeight: "380px",
        border: "1px solid #e8e8e8",
      }}
    >
      <Card.Content
        style={{
          background: type === "inactive" 
            ? "linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)" 
            : "linear-gradient(135deg, #009688 0%, #00bfa5 100%)",
          padding: "2em 1.8em",
          color: "white",
        }}
      >
        <Card.Header
          style={{
            fontSize: "1.9em",
            fontWeight: "bold",
            color: "white",
            marginBottom: "0.5em",
          }}
        >
          {p.fullName}
        </Card.Header>

        <div style={{ display: "flex", gap: "0.6em", flexWrap: "wrap" }}>
          <Label
            style={{
              background: "#d32f2f",
              color: "white",
              fontSize: "1.1em",
              padding: "0.6em 1em",
            }}
          >
            {p.bloodGroup}
          </Label>

          {type === "transferred" && (
            <Label
              style={{
                background: "#ff9800",
                color: "white",
                fontSize: "1.1em",
                padding: "0.6em 1em",
                marginLeft: "17em"
              }}
            >
              <Icon name="exchange" /> Transferred
            </Label>
          )}

          {type === "inactive" && (
            <Label
              style={{
                background: "#e74c3c",
                color: "white",
                fontSize: "1.1em",
                padding: "0.6em 1em",
                marginLeft: "18em"
              }}
            >
              <Icon name="ban" /> Removed
            </Label>
          )}
        </div>
      </Card.Content>

      <Card.Content style={{ padding: "2em", fontSize: "1.1em" }}>
        <div style={{ lineHeight: "1.5em" }}>
          <div style={{ display: "flex", marginBottom: "0.5em" }}>
            <span style={{ fontWeight: "600", minWidth: "130px", color: "#555" }}>
              Patient ID:
            </span>
            <span style={{ color: "#2c3e50", fontWeight: "500" }}>
              {p.patientId}
            </span>
          </div>

          <div style={{ display: "flex", marginBottom: "0.6em" }}>
            <span style={{ fontWeight: "600", minWidth: "130px", color: "#555" }}>
              Age:
            </span>
            <span style={{ color: "#2c3e50", fontWeight: "500" }}>
              {p.age} years
            </span>
          </div>

          <div style={{ display: "flex", marginBottom: "0.6em" }}>
            <span style={{ fontWeight: "600", minWidth: "130px", color: "#555" }}>
              Phone:
            </span>
            <span style={{ color: "#2c3e50", fontWeight: "500" }}>
              {p.phone}
            </span>
          </div>

        </div>

        {type === "transferred" && (
          <div
            style={{
              background: "linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)",
              border: "2px solid #ffb74d",
              borderRadius: "12px",
              padding: "1.2em",
              marginTop: "1.2em",
            }}
          >
            <div style={{ marginBottom: "0.6em" }}>
              <span style={{ color: "#e65100", fontWeight: "bold", fontSize: "1em" }}>
                Previously Under:
              </span>
              <span style={{ color: "#424242", fontWeight: "600", marginLeft: "0.5em" }}>
                You
              </span>
            </div>

            <div>
              <span style={{ color: "#e65100", fontWeight: "bold", fontSize: "1em" }}>
                Currently Under:
              </span>
              <span style={{ color: "#424242", fontWeight: "600", marginLeft: "0.5em" }}>
                Dr. {p.currentDoctorName}
              </span>
            </div>
          </div>
        )}

        {type === "inactive" && (
          <div
            style={{
              background: "linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)",
              border: "2px solid #ef5350",
              borderRadius: "12px",
              padding: "1.2em",
              marginTop: "1.2em",
            }}
          >
            <p style={{ color: "#c62828", fontWeight: "bold", fontSize: "1em", marginBottom: "0.4em" }}>
              <Icon name="ban" /> Status: Removed by You
            </p>
            <p style={{ color: "#555", margin: 0, fontSize: "0.95em" }}>
              You can reactivate this patient anytime.
            </p>
          </div>
        )}

        {type === "current" && (
          <div
            style={{
              background: "linear-gradient(135deg, #e0f2f1 0%, #b2dfdb 100%)",
              border: "2px solid #4db6ac",
              borderRadius: "12px",
              padding: "1.2em",
              marginTop: "1.2em",
            }}
          >
            <p style={{ color: "#00695c", fontWeight: "bold", fontSize: "1em", margin: 0 }}>
              <Icon name="check circle" /> Under Your Care
            </p>
          </div>
        )}
      </Card.Content>

      <Card.Content
        extra
        style={{
          padding: "1.3em",
          display: "flex",
          justifyContent: "space-between",
          gap: "0.7em",
          background: "#fafafa",
        }}
      >
        {type === "current" && (
          <>
            <Button
              color="blue"
              size="large"
              icon
              labelPosition="left"
              onClick={() =>
                (window.location.href = `/doctor/patient-details?wallet=${p.wallet}`)
              }
              style={{ flex: 1 }}
            >
              <Icon name="eye" /> View Records
            </Button>

            <div style={{ display: "flex", gap: "0.6em" }}>
              <Button
                color="teal"
                icon
                size="large"
                onClick={() => setTransferModal({ open: true, patient: p })}
                title="Transfer Patient"
              >
                <Icon name="exchange" />
              </Button>

              <Button
                color="red"
                icon
                size="large"
                onClick={() => setRemoveConfirm({ open: true, patient: p })}
                title="Remove Patient"
              >
                <Icon name="trash" />
              </Button>
            </div>
          </>
        )}

        {type === "transferred" && (
          <Button
            color="blue"
            fluid
            size="large"
            icon
            labelPosition="left"
            onClick={() =>
              (window.location.href = `/doctor/patient-details?wallet=${p.wallet}`)
            }
          >
            <Icon name="eye" /> View Records Only
          </Button>
        )}

        {type === "inactive" && (
          <>
            <Button
              color="blue"
              size="large"
              icon
              labelPosition="left"
              onClick={() =>
                (window.location.href = `/doctor/patient-details?wallet=${p.wallet}`)
              }
            >
              <Icon name="eye" /> View Records
            </Button>

            <Button
              color="teal"
              size="large"
              icon
              labelPosition="left"
              onClick={() => setReactivateConfirm({ open: true, patient: p })}
            >
              <Icon name="redo" /> Reactivate
            </Button>
          </>
        )}
      </Card.Content>
    </Card>
  </Grid.Column>
);

  const panes = [
    {
      menuItem: {
        key: "current",
        icon: "users",
        content: `Current Patients (${currentPatients.length})`,
      },
      render: () => (
        <Tab.Pane>
          {currentPatients.length === 0 ? (
            <Message
              info
              icon="inbox"
              header="No Current Patients"
              content="You have no patients currently assigned to you."
            />
          ) : (
            <Grid stackable columns={2} style={{ marginTop: "20px" }}>
              {currentPatients.map((p) => renderPatientCard(p, "current"))}
            </Grid>
          )}
        </Tab.Pane>
      ),
    },
    {
      menuItem: {
        key: "transferred",
        icon: "exchange",
        content: `Transferred Patients (${transferredPatients.length})`,
      },
      render: () => (
        <Tab.Pane>
          <Message info>
            <Icon name="info circle" />
            These patients were previously under your care but have been transferred
            to other doctors. You can still view their medical records.
          </Message>
          {transferredPatients.length === 0 ? (
            <Message
              icon="inbox"
              header="No Transferred Patients"
              content="You haven't transferred any patients yet."
            />
          ) : (
            <Grid stackable columns={2} style={{ marginTop: "20px" }}>
              {transferredPatients.map((p) => renderPatientCard(p, "transferred"))}
            </Grid>
          )}
        </Tab.Pane>
      ),
    },
    {
      menuItem: {
        key: "inactive",
        icon: "ban",
        content: `Removed Patients (${inactivePatients.length})`,
      },
      render: () => (
        <Tab.Pane>
          <Message warning>
            <Icon name="info circle" />
            These patients were removed from your active list. You can reactivate them
            to continue their treatment under your care.
          </Message>
          {inactivePatients.length === 0 ? (
            <Message
              icon="inbox"
              header="No Removed Patients"
              content="You haven't removed any patients yet."
            />
          ) : (
            <Grid stackable columns={2} style={{ marginTop: "20px" }}>
              {inactivePatients.map((p) => renderPatientCard(p, "inactive"))}
            </Grid>
          )}
        </Tab.Pane>
      ),
    },
  ];

  if (loading) {
    return (
      <DoctorLayout>
        <Loader active inline="centered" content="Loading patients..." size="large" />
      </DoctorLayout>
    );
  }

  return (
    <DoctorLayout>
      <Header as="h1" color="black" textAlign="center" style={{ fontSize: "2.5em", marginBottom: "1em" }}>
        <Icon name="users" /> My Patients
      </Header>

      <div style={{ textAlign: "center", marginBottom: "2.5em" }}>
        <Statistic.Group widths="three" size="small">
          <Statistic color="teal">
            <Statistic.Value>{currentPatients.length}</Statistic.Value>
            <Statistic.Label>Current Patients</Statistic.Label>
          </Statistic>
          <Statistic color="grey">
            <Statistic.Value>{transferredPatients.length}</Statistic.Value>
            <Statistic.Label>Transferred</Statistic.Label>
          </Statistic>
          <Statistic color="orange">
            <Statistic.Value>{inactivePatients.length}</Statistic.Value>
            <Statistic.Label>Removed</Statistic.Label>
          </Statistic>
        </Statistic.Group>
      </div>

      {error && <Message negative content={error} onDismiss={() => setError("")} />}
      {success && (
        <Message positive content={success} onDismiss={() => setSuccess("")} />
      )}

      <Tab panes={panes} />

      <Modal
        open={transferModal.open}
        onClose={() => {
          setTransferModal({ open: false, patient: null });
          setSelectedDoctor("");
          setTransferReason("");
        }}
        size="small"
      >
        <Modal.Header>
          <Icon name="exchange" /> Transfer Patient
        </Modal.Header>
        <Modal.Content>
          {transferModal.patient && (
            <>
              <Message info>
                <Message.Header>Transferring: {transferModal.patient.fullName}</Message.Header>
                <p>Patient ID: {transferModal.patient.patientId}</p>
              </Message>

              <Form>
                <Form.Field required>
                  <label>Select New Doctor</label>
                  <Dropdown
                    placeholder="Select a doctor"
                    fluid
                    selection
                    options={allDoctors}
                    value={selectedDoctor}
                    onChange={(_, { value }) => setSelectedDoctor(value)}
                  />
                </Form.Field>

                <Form.Field required>
                  <label>Reason for Transfer</label>
                  <Form.TextArea
                    placeholder="Enter reason for transfer (e.g., Specialist consultation, Relocation, etc.)"
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    rows={3}
                  />
                </Form.Field>
              </Form>

              <Message warning>
                <Message.Header>Important</Message.Header>
                <p>After transfer, the patient will be under the care of the selected doctor.</p>
              </Message>
            </>
          )}
        </Modal.Content>
        <Modal.Actions>
          <Button
            onClick={() => {
              setTransferModal({ open: false, patient: null });
              setSelectedDoctor("");
              setTransferReason("");
            }}
          >
            <Icon name="close" /> Cancel
          </Button>
          <Button
            primary
            onClick={handleTransferPatient}
            loading={actionLoading}
            disabled={!selectedDoctor || !transferReason.trim() || actionLoading}
          >
            <Icon name="check" /> Transfer Patient
          </Button>
        </Modal.Actions>
      </Modal>

      <Confirm
        open={removeConfirm.open}
        size="small"
        header={
          <div style={{ fontSize: "1.5em" }}>
            <Icon name="warning sign" color="red" /> Remove Patient?
          </div>
        }
        content={
          <div style={{ padding: "1.5em", fontSize: "1.05em" }}>
            <p style={{ marginBottom: "1em" }}>
              Are you sure you want to remove{" "}
              <strong style={{ color: "#009688" }}>{removeConfirm.patient?.fullName}</strong>?
            </p>
            <p style={{ color: "#e74c3c", marginTop: "1em", fontWeight: "600" }}>
              <Icon name="warning sign" /> This will:
            </p>
            <ul style={{ color: "#666", lineHeight: "1.9em", marginTop: "0.8em" }}>
              <li>Mark the patient as inactive</li>
              <li>Move them to the "Removed Patients" tab</li>
              <li>You can reactivate them later if needed</li>
              <li>All medical records will be preserved</li>
            </ul>
          </div>
        }
        confirmButton={
          <Button color="red" loading={actionLoading} size="large">
            <Icon name="trash" /> Yes, Remove Patient
          </Button>
        }
        cancelButton={<Button size="large">Cancel</Button>}
        onCancel={() => setRemoveConfirm({ open: false, patient: null })}
        onConfirm={handleRemovePatient}
      />

      <Confirm
        open={reactivateConfirm.open}
        size="small"
        header={
          <div style={{ fontSize: "1.5em" }}>
            <Icon name="check circle" color="green" /> Reactivate Patient?
          </div>
        }
        content={
          <div style={{ padding: "1.5em", fontSize: "1.05em" }}>
            <p style={{ marginBottom: "1em" }}>
              Are you sure you want to reactivate{" "}
              <strong style={{ color: "#009688" }}>{reactivateConfirm.patient?.fullName}</strong>?
            </p>
            <p style={{ color: "#009688", marginTop: "1em", fontWeight: "600" }}>
              <Icon name="check circle" /> This will:
            </p>
            <ul style={{ color: "#666", lineHeight: "1.9em", marginTop: "0.8em" }}>
              <li>Reactivate the patient in the system</li>
              <li>Move them back to your "Current Patients" tab</li>
              <li>Allow you to add new medical records</li>
              <li>Resume their treatment under your care</li>
            </ul>
          </div>
        }
        confirmButton={
          <Button color="green" loading={actionLoading} size="large">
            <Icon name="redo" /> Yes, Reactivate Patient
          </Button>
        }
        cancelButton={<Button size="large">Cancel</Button>}
        onCancel={() => setReactivateConfirm({ open: false, patient: null })}
        onConfirm={handleReactivatePatient}
      />
    </DoctorLayout>
  );
}