import { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Form,
  Dropdown,
  Message,
  Header,
  Icon,
  Divider,
  Loader,
} from "semantic-ui-react";
import { ethers } from "ethers";
import DoctorRegistry from "../artifacts/contracts/DoctorRegistry.sol/DoctorRegistry.json";
import HealthRecord from "../artifacts/contracts/HealthRecord.sol/HealthRecord.json";
import { ContractAddress, HealthRecordAddress } from "../config";

export default function TransferPatientModal({ patient, open, onClose, onSuccess }) {
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (open) {
      initializeModal();
    } else {
      resetModal();
    }
  }, [open]);

  useEffect(() => {
    if (selectedDepartment && !initializing) {
      loadDoctorsByDepartment(selectedDepartment);
    }
  }, [selectedDepartment]);

  const resetModal = () => {
    setSelectedDepartment("");
    setSelectedDoctor("");
    setDoctors([]);
    setReason("");
    setError("");
    setDepartments([]);
    setInitializing(true);
  };

  const initializeModal = async () => {
    try {
      setInitializing(true);
      setError("");
      
      if (!window.ethereum) {
        throw new Error("MetaMask not detected");
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const currentAddress = await signer.getAddress();
      
      const contract = new ethers.Contract(
        ContractAddress,
        DoctorRegistry.abi,
        provider
      );

      const allDoctors = await contract.getAllDoctors();

      const otherDoctors = allDoctors.filter(
        (d) => d.walletAddress.toLowerCase() !== currentAddress.toLowerCase()
      );

      if (otherDoctors.length === 0) {
        setError("Cannot transfer: No other doctors registered in the system. Please ask admin to register more doctors.");
        setDepartments([]);
        setInitializing(false);
        return;
      }
      
      const deptSet = new Set();
      otherDoctors.forEach((d) => {
        if (d.department && d.department.trim() !== "") {
          deptSet.add(d.department);
        }
      });
      
      const uniqueDepts = Array.from(deptSet);

      if (uniqueDepts.length === 0) {
        setError("No departments available for transfer.");
        setDepartments([]);
        setInitializing(false);
        return;
      }

      const departmentOptions = uniqueDepts.map((dept) => ({
        key: dept,
        text: dept,
        value: dept,
      }));

      setDepartments(departmentOptions);

    } catch (err) {
      setError("Failed to load: " + (err.reason || err.message));
    } finally {
      setInitializing(false);
    }
  };

  const loadDoctorsByDepartment = async (department) => {
    try {
      setLoadingDoctors(true);
      setError("");
      
      if (!window.ethereum) throw new Error("MetaMask not detected");
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const currentAddress = await signer.getAddress();

      const contract = new ethers.Contract(
        ContractAddress,
        DoctorRegistry.abi,
        provider
      );

      const allDoctors = await contract.getAllDoctors();
      
      const filteredDoctors = allDoctors.filter(
        (d) =>
          d.department === department &&
          d.walletAddress.toLowerCase() !== currentAddress.toLowerCase()
      );

      if (filteredDoctors.length === 0) {
        setError(`No other doctors available in ${department} department. Try selecting a different department.`);
        setDoctors([]);
        setSelectedDoctor("");
        return;
      }

      const doctorOptions = filteredDoctors.map((d) => ({
        key: d.walletAddress,
        text: `Dr. ${d.fullName} - ${d.specialization}`,
        value: d.walletAddress,
        description: `License: ${d.licenseId}`,
      }));

      setDoctors(doctorOptions);

    } catch (err) {
      setError("Failed to load doctors: " + (err.reason || err.message));
      setDoctors([]);
    } finally {
      setLoadingDoctors(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedDoctor || !reason.trim()) {
      setError("Please select a doctor and provide a reason for transfer");
      return;
    }

    try {
      setLoading(true);
      setError("");

      if (!window.ethereum) throw new Error("MetaMask not detected");
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        HealthRecordAddress,
        HealthRecord.abi,
        signer
      );

      const patientWallet = patient.walletAddress || patient.wallet;

      const tx = await contract.transferPatient(
        patientWallet,
        selectedDoctor,
        reason
      );

      await tx.wait();

      if (onSuccess) onSuccess();
      handleClose();
      
    } catch (err) {
      setError(err.reason || err.message || "Transfer failed");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} size="small">
      <Modal.Header>
        <Icon name="exchange" color="teal" />
        Transfer Patient: {patient && (patient.fullName || patient.name)}
      </Modal.Header>

      <Modal.Content>
        {initializing ? (
          <div style={{ textAlign: "center", padding: "2em" }}>
            <Loader active inline="centered" content="Loading available doctors..." />
          </div>
        ) : (
          <Form error={!!error}>
            <Header as="h4" color="teal">
              <Icon name="info circle" />
              Patient Information
            </Header>
            <p>
              <strong>Name:</strong> {patient && (patient.fullName || patient.name)}
            </p>
            <p>
              <strong>Wallet:</strong>{" "}
              {patient && (patient.walletAddress || patient.wallet) && 
                (patient.walletAddress || patient.wallet).slice(0, 20) + "..."}
            </p>

            <Divider />

            <Form.Field required>
              <label>
                <Icon name="building" /> Select Department
              </label>
              <Dropdown
                placeholder="Choose Department"
                fluid
                selection
                search
                options={departments}
                value={selectedDepartment}
                onChange={(_, { value }) => {
                  setSelectedDepartment(value);
                  setSelectedDoctor("");
                  setError("");
                }}
                disabled={departments.length === 0}
                noResultsMessage="No departments available"
              />
            </Form.Field>

            {selectedDepartment && (
              <Form.Field required>
                <label>
                  <Icon name="user md" /> Select Doctor
                </label>
                <Dropdown
                  placeholder={loadingDoctors ? "Loading doctors..." : "Choose Doctor"}
                  fluid
                  selection
                  search
                  options={doctors}
                  value={selectedDoctor}
                  onChange={(_, { value }) => {
                    setSelectedDoctor(value);
                  }}
                  disabled={loadingDoctors || doctors.length === 0}
                  loading={loadingDoctors}
                  noResultsMessage="No doctors available in this department"
                />
              </Form.Field>
            )}

            <Form.TextArea
              label="Reason for Transfer"
              placeholder="e.g., Specialist consultation required, Patient request, Second opinion needed, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={3}
            />

            {error && <Message error header="Transfer Error" content={error} />}
          </Form>
        )}
      </Modal.Content>

      <Modal.Actions>
        <Button onClick={handleClose} disabled={loading}>
          <Icon name="cancel" /> Cancel
        </Button>
        <Button
          color="teal"
          onClick={handleTransfer}
          loading={loading}
          disabled={loading || initializing || !selectedDoctor || !reason.trim()}
        >
          <Icon name="exchange" /> Transfer Patient
        </Button>
      </Modal.Actions>
    </Modal>
  );
}