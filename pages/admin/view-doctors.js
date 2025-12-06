import { useState, useEffect } from "react";
import {
  Card,
  Icon,
  Header,
  Message,
  Grid,
  Button,
  Confirm,
  Label,
  Loader,
  Divider,
} from "semantic-ui-react";
import { ethers } from "ethers";
import { useRouter } from "next/router";
import AdminLayout from "../../components/AdminLayout";
import DoctorRegistry from "../../artifacts/contracts/DoctorRegistry.sol/DoctorRegistry.json";
import { ContractAddress } from "../../config";

export default function ViewDoctors() {
  const router = useRouter();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", msg: "" });
  const [deactivateConfirm, setDeactivateConfirm] = useState({
    open: false,
    doctor: null,
  });
  const [reactivateConfirm, setReactivateConfirm] = useState({
    open: false,
    doctor: null,
  });
  const [deleteConfirm, setDeleteConfirm] = useState({
    open: false,
    doctor: null,
  });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadDoctors();
  }, []);

  const loadDoctors = async () => {
    try {
      if (!window.ethereum) throw new Error("MetaMask not detected");

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const doctorContract = new ethers.Contract(ContractAddress, DoctorRegistry.abi, signer);
      const doctorList = await doctorContract.getAllDoctorsIncludingInactive();

      if (!doctorList.length) {
        setStatus({ type: "info", msg: "No doctors registered yet." });
        setDoctors([]);
        setLoading(false);
        return;
      }

      const formatted = doctorList.map((doc) => ({
        wallet: doc.walletAddress,
        fullName: doc.fullName,
        age: doc.age.toString(),
        specialization: doc.specialization,
        department: doc.department,
        licenseId: doc.licenseId,
        isActive: doc.isActive,
        registeredDate: doc.registeredDate 
          ? new Date(doc.registeredDate.toNumber() * 1000).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "N/A",
      }));

      setDoctors(formatted);
      setStatus({ type: "success" });
    } catch (err) {
      setStatus({ type: "error", msg: err.reason || err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivateDoctor = async () => {
    if (!deactivateConfirm.doctor) return;

    try {
      setActionLoading(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(ContractAddress, DoctorRegistry.abi, signer);
      const tx = await contract.removeDoctor(deactivateConfirm.doctor.wallet);
      await tx.wait();

      setStatus({
        type: "success",
        msg: ` Dr. ${deactivateConfirm.doctor.fullName} has been deactivated!`,
      });
      setDeactivateConfirm({ open: false, doctor: null });
      loadDoctors();
    } catch (err) {
      setStatus({ type: "error", msg: err.reason || err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivateDoctor = async () => {
    if (!reactivateConfirm.doctor) return;

    try {
      setActionLoading(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(ContractAddress, DoctorRegistry.abi, signer);
      const tx = await contract.reactivateDoctor(reactivateConfirm.doctor.wallet);
      await tx.wait();

      setStatus({
        type: "success",
        msg: ` Dr. ${reactivateConfirm.doctor.fullName} has been reactivated!`,
      });
      setReactivateConfirm({ open: false, doctor: null });
      loadDoctors();
    } catch (err) {
      setStatus({ type: "error", msg: err.reason || err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!deleteConfirm.doctor) return;

    try {
      setActionLoading(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(ContractAddress, DoctorRegistry.abi, signer);
      const tx = await contract.permanentlyRemoveDoctor(deleteConfirm.doctor.wallet);
      await tx.wait();

      setStatus({
        type: "success",
        msg: `Dr. ${deleteConfirm.doctor.fullName} has been permanently removed!`,
      });
      setDeleteConfirm({ open: false, doctor: null });
      loadDoctors();
    } catch (err) {
      setStatus({ type: "error", msg: err.reason || err.message });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AdminLayout>
      <Header as="h1" color="black" textAlign="center" style={{ fontSize: "2.5em", marginBottom: "1em" }}>
        Registered Doctors
      </Header>

      {status.msg && (
        <Message
          positive={status.type === "success"}
          negative={status.type === "error"}
          info={status.type === "info"}
          onDismiss={() => setStatus({ type: "", msg: "" })}
        >
          {status.msg}
        </Message>
      )}

      {loading ? (
        <Loader active inline="centered" content="Loading doctors..." size="large" />
      ) : doctors.length === 0 ? (
        <Message info content="No doctors found." size="large" />
      ) : (
        <Grid columns={2} stackable doubling>
          {doctors.map((doc, idx) => (
            <Grid.Column key={idx}>
              <Card
                fluid
                style={{
                  borderRadius: "15px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                  border: doc.isActive ? "2px solid #f0f0f0" : "2px solid #efe6e6ff",
                  minHeight: "400px",
                  opacity: doc.isActive ? 1 : 0.8,
                }}
              >
                  <Card.Content 
                  style={{ 
                    background: doc.isActive 
                      ? "linear-gradient(135deg, #009688 0%, #009688 100%)" 
                      : "linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)",
                    padding: "1.6em" 
                  }}
                >
                  <Card.Header style={{ color: "white", fontSize: "1.7em", marginBottom: "0.1em" }}>
                    Dr. {doc.fullName}
                  </Card.Header>
                </Card.Content>

                <Card.Content style={{ padding: "1.00em", fontSize: "1.2em", lineHeight: "1.5em" }}>
  <div style={{ marginBottom: "0.7em" }}>
    <Label 
      color="blue" 
      size="large" 
      style={{ 
        marginBottom: "1em", 
        fontSize: "1.1em", 
        padding: "0.4em 1.0em" 
      }}
    >
      {doc.department}
    </Label>

    {doc.isActive ? (
      <Label 
        color="green" 
        size="large" 
        style={{ 
          float: "right",
          fontSize: "1.0em",
          padding: "0.4em 1.1em"
        }}
      >
        Active
      </Label>
    ) : (
      <Label 
        color="grey" 
        size="large" 
        style={{ 
          float: "right",
          fontSize: "1.0em",
          padding: "0.4em 1.1em"
        }}
      >
        Inactive
      </Label>
    )}
  </div>

  <Divider style={{ margin: "1em 0" }} />

  <div style={{ lineHeight: "1.6em", fontSize: "1.15em" }}>
    <div style={{ display: "flex" }}>
      <strong style={{ width: "150px" }}>Specialization:</strong>
      <span>{doc.specialization}</span>
    </div>

    <div style={{ display: "flex" }}>
      <strong style={{ width: "150px" }}>Age:</strong>
      <span>{doc.age} years</span>
    </div>

    <div style={{ display: "flex" }}>
      <strong style={{ width: "150px" }}>License ID:</strong>
      <span>{doc.licenseId}</span>
    </div>

    <div style={{ display: "flex" }}>
      <strong style={{ width: "150px" }}>Registered:</strong>
      <span>{doc.registeredDate}</span>
    </div>

  </div>
</Card.Content>

                <Card.Content extra style={{ padding: "1.2em" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5em" }}>
                {doc.isActive ? (
                  <Button
                    color="grey"
                    size="large"
                    icon
                    labelPosition="left"
                    onClick={() => setDeactivateConfirm({ open: true, doctor: doc })}
                  >
                    <Icon name="pause" />
                  Deactivate
                  </Button>
                ) : (
                  <Button
                    color="green"
                    size="large"
                    icon
                    labelPosition="right"
                    onClick={() => setReactivateConfirm({ open: true, doctor: doc })}
                  >
                    <Icon name="check circle" />
                    Reactivate
                  </Button>
                )}

                <Button
                  color="red"
                  size="large"
                  icon
                  labelPosition="left"
                  onClick={() => setDeleteConfirm({ open: true, doctor: doc })}
                >
                  <Icon name="trash" />
                  Delete
                </Button>
              </div>

                </Card.Content>
              </Card>
            </Grid.Column>
          ))}
        </Grid>
      )}

      <Confirm
        open={deactivateConfirm.open}
        size="small"
        header={
          <div style={{ fontSize: "1.5em" }}>
            <Icon name="pause circle" color="orange" /> Deactivate Doctor?
          </div>
        }
        content={
          <div style={{ padding: "1.5em", fontSize: "1.1em" }}>
            <p>
              Temporarily deactivate <strong style={{ color: "#009688" }}>Dr. {deactivateConfirm.doctor?.fullName}</strong>?
            </p>
            <Divider />
            <p style={{ color: "#f39c12", marginTop: "1em" }}>
              <Icon name="info circle" /> <strong>This will:</strong>
            </p>
            <ul style={{ color: "#666", lineHeight: "1.8em", marginTop: "0.5em" }}>
              <li>Block login access temporarily</li>
              <li>Prevent adding patients/prescriptions</li>
              <li>Keep all records intact</li>
              <li>Can be reactivated anytime</li>
            </ul>
          </div>
        }
        confirmButton={
          <Button color="orange" loading={actionLoading} size="large">
            <Icon name="pause" /> Yes, Deactivate
          </Button>
        }
        cancelButton={<Button size="large">Cancel</Button>}
        onCancel={() => setDeactivateConfirm({ open: false, doctor: null })}
        onConfirm={handleDeactivateDoctor}
      />

      <Confirm
        open={reactivateConfirm.open}
        size="small"
        header={
          <div style={{ fontSize: "1.5em" }}>
            <Icon name="check circle" color="green" /> Reactivate Doctor?
          </div>
        }
        content={
          <div style={{ padding: "1.5em", fontSize: "1.1em" }}>
            <p>
              Reactivate <strong style={{ color: "#009688" }}>Dr. {reactivateConfirm.doctor?.fullName}</strong>?
            </p>
            <Divider />
            <p style={{ color: "#27ae60", marginTop: "1em" }}>
              <Icon name="check" /> <strong>This will:</strong>
            </p>
            <ul style={{ color: "#666", lineHeight: "1.8em", marginTop: "0.5em" }}>
              <li>Restore login access</li>
              <li>Allow adding patients/prescriptions</li>
              <li>Restore access to their patients</li>
              <li>Reactivate immediately</li>
            </ul>
          </div>
        }
        confirmButton={
          <Button color="green" loading={actionLoading} size="large">
            <Icon name="check circle" /> Yes, Reactivate
          </Button>
        }
        cancelButton={<Button size="large">Cancel</Button>}
        onCancel={() => setReactivateConfirm({ open: false, doctor: null })}
        onConfirm={handleReactivateDoctor}
      />

      <Confirm
        open={deleteConfirm.open}
        size="small"
        header={
          <div style={{ fontSize: "1.5em" }}>
            <Icon name="warning sign" color="red" /> Permanently Delete Doctor?
          </div>
        }
        content={
          <div style={{ padding: "1.5em", fontSize: "1.1em" }}>
            <p style={{ color: "#e74c3c", fontWeight: "bold", fontSize: "1.2em", marginBottom: "1em" }}>
              WARNING: This action CANNOT be undone!
            </p>
            
            <p>
              Permanently delete <strong style={{ color: "#009688" }}>Dr. {deleteConfirm.doctor?.fullName}</strong>?
            </p>
            
            <Divider />
            
            <p style={{ color: "#e74c3c", marginTop: "1em" }}>
              <Icon name="exclamation triangle" /> <strong>This will:</strong>
            </p>
            <ul style={{ color: "#666", lineHeight: "1.8em", marginTop: "0.5em" }}>
              <li><strong>Permanently remove</strong> doctor from system</li>
              <li><strong>Cannot be reactivated</strong> (must re-register)</li>
              <li>Lose connection to their patients</li>
              <li>Existing patient records remain but unlinked</li>
            </ul>

            <Message warning style={{ marginTop: "1em" }}>
              <Message.Header> Consider Deactivation Instead</Message.Header>
              <p>If you might need this doctor later, use "Deactivate" instead. You can reactivate them anytime.</p>
            </Message>
          </div>
        }
        confirmButton={
          <Button color="red" loading={actionLoading} size="large">
            <Icon name="trash" /> Yes, Delete Permanently
          </Button>
        }
        cancelButton={
          <Button primary size="large">
            <Icon name="close" /> Cancel (Recommended)
          </Button>
        }
        onCancel={() => setDeleteConfirm({ open: false, doctor: null })}
        onConfirm={handlePermanentDelete}
      />
    </AdminLayout>
  );
}
