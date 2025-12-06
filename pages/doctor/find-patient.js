import { useEffect, useState } from "react";
import { ethers } from "ethers";
import {
  Header,
  Icon,
  Message,
  Button,
  Card,
  Input,
  Loader,
} from "semantic-ui-react";
import DoctorLayout from "../../components/DoctorLayout";
import HealthRecordSecure from "../../artifacts/contracts/HealthRecordSecure.sol/HealthRecordSecure.json";
import { HealthRecordAddress } from "../../config";

export default function FindPatient() {
  const [allPatients, setAllPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [addingPatient, setAddingPatient] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadAllPatients();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredPatients(allPatients);
    } else {
      const filtered = allPatients.filter((p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPatients(filtered);
    }
  }, [searchTerm, allPatients]);

  const loadAllPatients = async () => {
    try {
      setLoading(true);
      setError("");

      if (!window.ethereum) throw new Error("MetaMask not detected");

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      const contract = new ethers.Contract(
        HealthRecordAddress,
        HealthRecordSecure.abi,
        signer
      );

      const [wallets, names, isInMyList] = await contract.searchAllPatients();

      const patients = wallets.map((wallet, i) => ({
        wallet,
        name: names[i],
        isInMyList: isInMyList[i],
      }));

      setAllPatients(patients);
      setFilteredPatients(patients);
    } catch (err) {
      setError(err.reason || err.message || "Failed to load patients");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPatient = async (patientWallet) => {
    try {
      setAddingPatient(patientWallet);
      setError("");
      setSuccess("");

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      const contract = new ethers.Contract(
        HealthRecordAddress,
        HealthRecordSecure.abi,
        signer
      );

      const tx = await contract.addExistingPatientToMyList(patientWallet);
      await tx.wait();

      setSuccess("Patient added to your list successfully!");

      await loadAllPatients();

      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      setError(err.reason || err.message || "Failed to add patient");
    } finally {
      setAddingPatient(null);
    }
  };

  return (
    <DoctorLayout>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2em" }}>
        <Header
          as="h1"
          style={{
            fontSize: "2.5em",
            marginBottom: "0.5em",
            textAlign: "center",
          }}
        >
          <Icon name="search" /> Find Patient
        </Header>

        <p
          style={{
            textAlign: "center",
            color: "#666",
            marginBottom: "2em",
            fontSize: "1.1em",
          }}
        >
          Search for existing patients in the system and add them to your patient list.
          After adding, you can request consent to view their records.
        </p>

        <div
          style={{
            backgroundColor: "white",
            borderRadius: "18px",
            boxShadow: "0 6px 25px rgba(0,0,0,0.12)",
            padding: "2em",
            marginBottom: "2em",
          }}
        >
          <Input
            fluid
            icon="search"
            iconPosition="left"
            placeholder="Search patients by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ fontSize: "1.2em" }}
          />
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

        {loading && (
          <div style={{ textAlign: "center", padding: "3em" }}>
            <Loader active size="large">
              Loading patients...
            </Loader>
          </div>
        )}

        {!loading && filteredPatients.length === 0 && (
          <Message info>
            <Message.Header>No Patients Found</Message.Header>
            <p>
              {searchTerm
                ? `No patients matching "${searchTerm}" found.`
                : "No patients are registered in the system yet."}
            </p>
          </Message>
        )}

        {!loading && filteredPatients.length > 0 && (
          <div>
            <h3 style={{ marginBottom: "1em", color: "#333" }}>
              {searchTerm
                ? `Found ${filteredPatients.length} patient(s)`
                : `All Patients (${filteredPatients.length})`}
            </h3>

            <Card.Group itemsPerRow={3} stackable>
              {filteredPatients.map((patient, index) => (
                <Card key={index}>
                  <Card.Content>
                    <Card.Header>
                      <Icon name="user" /> {patient.name}
                    </Card.Header>
                    <Card.Meta>
                      {patient.isInMyList ? (
                        <span style={{ color: "#21ba45" }}>
                          <Icon name="check circle" /> In your patient list
                        </span>
                      ) : (
                        <span style={{ color: "#f2711c" }}>
                          <Icon name="info circle" /> Not in your list
                        </span>
                      )}
                    </Card.Meta>
                  </Card.Content>
                  <Card.Content extra>
                    {patient.isInMyList ? (
                      <Button
                        color="teal"
                        fluid
                        as="a"
                        href="/doctor/view-record"
                      >
                        <Icon name="eye" /> View Records
                      </Button>
                    ) : (
                      <Button
                        color="teal"
                        fluid
                        onClick={() => handleAddPatient(patient.wallet)}
                        loading={addingPatient === patient.wallet}
                        disabled={addingPatient !== null}
                      >
                        <Icon name="plus" /> Add to My List
                      </Button>
                    )}
                  </Card.Content>
                </Card>
              ))}
            </Card.Group>
          </div>
        )}

      </div>
    </DoctorLayout>
  );
}
