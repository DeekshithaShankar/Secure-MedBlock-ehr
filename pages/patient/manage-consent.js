import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { useRouter } from "next/router";
import {
  Icon,
  Message,
  Loader,
  Button,
  Modal,
  Form,
  Dropdown
} from "semantic-ui-react";
import PatientLayout from "../../components/PatientLayout";
import HealthRecordSecure from "../../artifacts/contracts/HealthRecordSecure.sol/HealthRecordSecure.json";
import DoctorRegistry from "../../artifacts/contracts/DoctorRegistry.sol/DoctorRegistry.json";
import { HealthRecordAddress, ContractAddress } from "../../config";

export default function ManageConsent() {
  const router = useRouter();
  const [account, setAccount] = useState("");
  const [consents, setConsents] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [doctorToRevoke, setDoctorToRevoke] = useState(null);
  const [requestToApprove, setRequestToApprove] = useState(null);
  const [approvalExpiryDays, setApprovalExpiryDays] = useState(0);

  useEffect(() => {
    loadConsentData();
  }, []);

  const loadConsentData = async () => {
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

      const isPatient = await healthContract.isPatient(address);
      if (!isPatient) {
        setError("Access denied. Only registered patients can manage consents.");
        setLoading(false);
        return;
      }

      const patientData = await healthContract.getPatient(address);

      let consentedDoctors = [];
      let activeStatus = [];

      try {
        const consentData = await healthContract.getConsentedDoctors(address);
        consentedDoctors = consentData[0];
        activeStatus = consentData[1];
      } catch {
      }

      const enrichedConsents = await Promise.all(
        consentedDoctors.map(async (doctorAddr, idx) => {
          try {
            const doctorInfo = await doctorContract.getDoctorByAddress(doctorAddr);
            const consentDetails = await healthContract.getConsentDetails(address, doctorAddr);

            return {
              address: doctorAddr,
              name: doctorInfo[1],
              specialization: doctorInfo[3],
              department: doctorInfo[4],
              isActive: activeStatus[idx],
              grantedDate: new Date(consentDetails[1].toNumber() * 1000),
              revokedDate: consentDetails[2].toNumber() > 0
                ? new Date(consentDetails[2].toNumber() * 1000)
                : null,
              expiryDate: consentDetails[3].toNumber() > 0
                ? new Date(consentDetails[3].toNumber() * 1000)
                : null,
              purpose: consentDetails[4],
              isPrimaryDoctor: doctorAddr.toLowerCase() === patientData[4].toLowerCase()
            };
          } catch (err) {
            return {
              address: doctorAddr,
              name: "Unknown Doctor",
              specialization: "N/A",
              department: "N/A",
              isActive: activeStatus[idx],
              grantedDate: null,
              expiryDate: null,
              purpose: "Unknown",
              isPrimaryDoctor: false
            };
          }
        })
      );

      setConsents(enrichedConsents);

      try {
        const requests = await healthContract.getPendingConsentRequests(address);
        const enrichedRequests = await Promise.all(
          requests.map(async (req) => {
            try {
              const doctorInfo = await doctorContract.getDoctorByAddress(req.doctor);
              return {
                doctor: req.doctor,
                doctorName: doctorInfo[1] || "Unknown Doctor",
                doctorSpecialization: doctorInfo[3] || "",
                doctorDepartment: doctorInfo[4] || "",
                purpose: req.purpose,
                requestDate: new Date(req.requestDate.toNumber() * 1000),
              };
            } catch {
              return {
                doctor: req.doctor,
                doctorName: "Unknown Doctor",
                doctorSpecialization: "",
                doctorDepartment: "",
                purpose: req.purpose,
                requestDate: new Date(req.requestDate.toNumber() * 1000),
              };
            }
          })
        );
        setPendingRequests(enrichedRequests);
      } catch {
        setPendingRequests([]);
      }
    } catch (err) {
      setError(err.reason || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeConsent = async () => {
    if (!doctorToRevoke) return;

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      const healthContract = new ethers.Contract(
        HealthRecordAddress,
        HealthRecordSecure.abi,
        signer
      );

      const tx = await healthContract.revokeConsent(doctorToRevoke.address);
      await tx.wait();

      setSuccess("Consent revoked successfully!");
      setRevokeModalOpen(false);
      setDoctorToRevoke(null);

      await loadConsentData();
    } catch (err) {
      setError(err.reason || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveRequest = async () => {
    if (!requestToApprove) return;

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      const healthContract = new ethers.Contract(
        HealthRecordAddress,
        HealthRecordSecure.abi,
        signer
      );

      let expiryTimestamp = 0;
      if (approvalExpiryDays > 0) {
        expiryTimestamp = Math.floor(Date.now() / 1000) + (approvalExpiryDays * 24 * 60 * 60);
      }

      const tx = await healthContract.approveConsentRequest(requestToApprove.doctor, expiryTimestamp);
      await tx.wait();

      setSuccess(`Access granted to Dr. ${requestToApprove.doctorName}!`);
      setApproveModalOpen(false);
      setRequestToApprove(null);
      setApprovalExpiryDays(0);

      await loadConsentData();
    } catch (err) {
      setError(err.reason || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectRequest = async (request) => {
    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      const healthContract = new ethers.Contract(
        HealthRecordAddress,
        HealthRecordSecure.abi,
        signer
      );

      const tx = await healthContract.rejectConsentRequest(request.doctor);
      await tx.wait();

      setSuccess(`Request from Dr. ${request.doctorName} has been rejected.`);

      await loadConsentData();
    } catch (err) {
      setError(err.reason || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const expiryOptions = [
    { key: 0, text: "No Expiry (Permanent)", value: 0 },
    { key: 7, text: "7 Days", value: 7 },
    { key: 30, text: "30 Days", value: 30 },
    { key: 90, text: "90 Days", value: 90 },
    { key: 180, text: "6 Months", value: 180 },
    { key: 365, text: "1 Year", value: 365 }
  ];

  if (loading) {
    return (
      <PatientLayout activeTab="consent" account={account}>
        <div className="flex justify-center items-center h-96">
          <Loader active size="large">Loading Consent Data...</Loader>
        </div>
      </PatientLayout>
    );
  }

  if (error && !consents.length) {
    return (
      <PatientLayout activeTab="consent" account={account}>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Message negative>
            <Message.Header>Error</Message.Header>
            <p>{error}</p>
          </Message>
          <button
            onClick={() => router.push("/patient")}
            className="mt-4 bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700"
          >
            Back to Dashboard
          </button>
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout activeTab="consent" account={account}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-center mb-2">
            Manage Access Consent
          </h1>
          <p className="text-gray-600 text-center text-lg">
            Control which doctors can access your medical records
          </p>
        </div>

        {error && (
          <Message negative onDismiss={() => setError("")}>
            <Message.Header>Error</Message.Header>
            <p>{error}</p>
          </Message>
        )}

        {success && (
          <Message positive onDismiss={() => setSuccess("")}>
            <Message.Header>Success</Message.Header>
            <p>{success}</p>
          </Message>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-100">
            <div className="text-3xl font-bold text-teal-600">
              {consents.filter(c => c.isActive).length}
            </div>
            <div className="text-gray-600 font-medium">Active Consents</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-100">
            <div className="text-3xl font-bold text-gray-600">
              {consents.filter(c => !c.isActive).length}
            </div>
            <div className="text-gray-600 font-medium">Revoked Consents</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-100">
            <div className="text-3xl font-bold text-blue-600">
              {consents.filter(c => c.isPrimaryDoctor).length}
            </div>
            <div className="text-gray-600 font-medium">Primary Doctor</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-orange-200">
            <div className="text-3xl font-bold text-orange-600">
              {pendingRequests.length}
            </div>
            <div className="text-gray-600 font-medium">Pending Requests</div>
          </div>
        </div>

        {pendingRequests.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              <Icon name="bell" className="text-orange-500" /> Pending Access Requests
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {pendingRequests.map((request, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl shadow-xl border-2 border-orange-300 overflow-hidden"
                >
                  <div className="bg-gradient-to-r from-orange-500 to-orange-400 p-6 text-white">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-2xl font-bold">Dr. {request.doctorName}</h3>
                        <p className="text-white/80 text-sm mt-1">{request.doctorDepartment}</p>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-300 text-orange-900">
                        Pending
                      </span>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="space-y-3 text-base">
                      {request.doctorSpecialization && (
                        <div className="flex">
                          <span className="font-semibold text-gray-600 min-w-[140px]">
                            Specialization:
                          </span>
                          <span className="text-gray-800">{request.doctorSpecialization}</span>
                        </div>
                      )}
                      <div className="flex">
                        <span className="font-semibold text-gray-600 min-w-[140px]">
                          Purpose:
                        </span>
                        <span className="text-gray-800">{request.purpose}</span>
                      </div>
                      <div className="flex">
                        <span className="font-semibold text-gray-600 min-w-[140px]">
                          Requested On:
                        </span>
                        <span className="text-gray-800">{request.requestDate.toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="mt-6 flex gap-3">
                      <Button
                        color="teal"
                        fluid
                        onClick={() => {
                          setRequestToApprove(request);
                          setApproveModalOpen(true);
                        }}
                      >
                        <Icon name="check" /> Approve
                      </Button>
                      <Button
                        color="red"
                        fluid
                        onClick={() => handleRejectRequest(request)}
                        loading={actionLoading}
                      >
                        <Icon name="times" /> Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {consents.length === 0 ? (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-8 rounded-lg text-center">
            <Icon name="info circle" size="huge" className="text-blue-500 mb-4" />
            <h3 className="text-2xl font-bold text-blue-800 mb-2">No Consents Yet</h3>
            <p className="text-blue-700">
              You haven't granted access to any additional doctors yet.
              Your primary care doctor has automatic access to your records.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {consents.map((consent, idx) => (
              <div
                key={idx}
                className={`bg-white rounded-2xl shadow-xl border-2 overflow-hidden ${
                  consent.isActive ? "border-green-200" : "border-gray-200"
                }`}
              >
                <div
                  className={`p-6 text-white ${
                    consent.isPrimaryDoctor
                      ? "bg-gradient-to-r from-blue-600 to-blue-500"
                      : consent.isActive
                      ? "bg-gradient-to-r from-teal-600 to-teal-500"
                      : "bg-gradient-to-r from-gray-500 to-gray-600"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-2xl font-bold">Dr. {consent.name}</h3>
                      <p className="text-white/80 text-sm mt-1">{consent.department}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {consent.isPrimaryDoctor && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-400 text-blue-900">
                          Primary Doctor
                        </span>
                      )}
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          consent.isActive
                            ? "bg-green-400 text-green-900"
                            : "bg-gray-300 text-gray-700"
                        }`}
                      >
                        {consent.isActive ? "Active" : "Revoked"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="space-y-3 text-base">
                    <div className="flex">
                      <span className="font-semibold text-gray-600 min-w-[140px]">
                        Specialization:
                      </span>
                      <span className="text-gray-800">{consent.specialization}</span>
                    </div>

                    <div className="flex">
                      <span className="font-semibold text-gray-600 min-w-[140px]">
                        Purpose:
                      </span>
                      <span className="text-gray-800">{consent.purpose}</span>
                    </div>

                    {consent.grantedDate && (
                      <div className="flex">
                        <span className="font-semibold text-gray-600 min-w-[140px]">
                          Granted On:
                        </span>
                        <span className="text-gray-800">
                          {consent.grantedDate.toLocaleDateString()}
                        </span>
                      </div>
                    )}

                    {consent.expiryDate && (
                      <div className="flex">
                        <span className="font-semibold text-gray-600 min-w-[140px]">
                          Expires On:
                        </span>
                        <span className={`font-semibold ${
                          consent.expiryDate < new Date() ? "text-red-600" : "text-orange-600"
                        }`}>
                          {consent.expiryDate.toLocaleDateString()}
                        </span>
                      </div>
                    )}

                    {consent.revokedDate && (
                      <div className="flex">
                        <span className="font-semibold text-gray-600 min-w-[140px]">
                          Revoked On:
                        </span>
                        <span className="text-red-600">
                          {consent.revokedDate.toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {consent.isActive && !consent.isPrimaryDoctor && (
                    <div className="mt-6">
                      <Button
                        color="red"
                        fluid
                        onClick={() => {
                          setDoctorToRevoke(consent);
                          setRevokeModalOpen(true);
                        }}
                      >
                        <Icon name="times" />
                        Revoke Access
                      </Button>
                    </div>
                  )}

                  
                </div>
              </div>
            ))}
          </div>
        )}

        <Modal
          open={revokeModalOpen}
          onClose={() => setRevokeModalOpen(false)}
          size="small"
        >
          <Modal.Header>
            <Icon name="warning sign" color="red" /> Confirm Revoke Access
          </Modal.Header>
          <Modal.Content>
            <p>
              Are you sure you want to revoke access for{" "}
              <strong>Dr. {doctorToRevoke?.name}</strong>?
            </p>
            <p className="text-gray-600 mt-2">
              This will immediately prevent them from viewing your medical records.
              This action is recorded on the blockchain.
            </p>
          </Modal.Content>
          <Modal.Actions>
            <Button onClick={() => setRevokeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleRevokeConsent}
              loading={actionLoading}
            >
              <Icon name="times" /> Revoke Access
            </Button>
          </Modal.Actions>
        </Modal>

        <Modal
          open={approveModalOpen}
          onClose={() => setApproveModalOpen(false)}
          size="small"
        >
          <Modal.Header style={{ background: "linear-gradient(135deg, #009688 0%, #00bfa5 100%)", color: "white" }}>
            <Icon name="check circle" /> Approve Access Request
          </Modal.Header>
          <Modal.Content>
            <p style={{ marginBottom: "1em" }}>
              You are about to grant <strong>Dr. {requestToApprove?.doctorName}</strong> access to your medical records.
            </p>
            <div style={{ backgroundColor: "#f5f5f5", padding: "1em", borderRadius: "8px", marginBottom: "1.5em" }}>
              <p style={{ margin: 0 }}>
                <strong>Purpose:</strong> {requestToApprove?.purpose}
              </p>
            </div>
            <Form>
              <Form.Field>
                <label>Access Duration</label>
                <Dropdown
                  placeholder="Select duration"
                  fluid
                  selection
                  options={expiryOptions}
                  value={approvalExpiryDays}
                  onChange={(_, { value }) => setApprovalExpiryDays(value)}
                />
              </Form.Field>
            </Form>
          </Modal.Content>
          <Modal.Actions>
            <Button onClick={() => {
              setApproveModalOpen(false);
              setRequestToApprove(null);
              setApprovalExpiryDays(0);
            }}>
              Cancel
            </Button>
            <Button
              color="teal"
              onClick={handleApproveRequest}
              loading={actionLoading}
            >
              <Icon name="check" /> Grant Access
            </Button>
          </Modal.Actions>
        </Modal>
      </div>
    </PatientLayout>
  );
}
