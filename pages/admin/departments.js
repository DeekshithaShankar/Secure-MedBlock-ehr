import { useEffect, useState } from "react";
import { Card, Header, Icon, Message, Grid, Loader } from "semantic-ui-react";
import { useRouter } from "next/router";
import { ethers } from "ethers";
import AdminLayout from "../../components/AdminLayout";
import DoctorRegistry from "../../artifacts/contracts/DoctorRegistry.sol/DoctorRegistry.json";
import { ContractAddress } from "../../config";

export default function Departments() {
  const router = useRouter();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      if (!window.ethereum) throw new Error("MetaMask not detected");

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(
        ContractAddress,
        DoctorRegistry.abi,
        provider
      );

      const allDoctors = await contract.getAllDoctors();

      const deptCount = {};
      allDoctors.forEach((doc) => {
        if (doc.isActive && doc.department) {
          deptCount[doc.department] = (deptCount[doc.department] || 0) + 1;
        }
      });

      const deptArray = Object.keys(deptCount).map((dept) => ({
        name: dept,
        count: deptCount[dept],
      }));

      setDepartments(deptArray);
    } catch (err) {
      setError(err.reason || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <Loader active inline="centered" content="Loading departments..." />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Header as="h2" color="black" textAlign="center">
        <Icon name="folder open" /> Department Management
      </Header>
      <p style={{ textAlign: "center", color: "#666", marginBottom: "2em" }}>
        View and manage doctors under each department
      </p>

      {error && <Message negative content={error} />}

      {departments.length === 0 ? (
        <Message info content="No departments found. Register doctors to create departments." />
      ) : (
        <Grid columns={3} stackable style={{ marginTop: "2em" }}>
          {departments.map((dept, idx) => (
            <Grid.Column key={idx}>
              <Card
                link
                onClick={() => router.push("/admin/department/" + dept.name)}
                style={{
                  borderRadius: "15px",
                  textAlign: "center",
                  padding: "2em",
                  cursor: "pointer",
                  transition: "all 0.3s",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                }}
              >
                <Icon
                  name="folder open"
                  size="huge"
                  color="blue"
                  style={{ marginBottom: "1em" }}
                />
                <Card.Content>
                  <Card.Header style={{ fontSize: "1.5em", marginBottom: "0.5em" }}>
                    {dept.name}
                  </Card.Header>
                  <Card.Meta style={{ fontSize: "1.2em", color: "#009688" }}>
                    <Icon name="user md" />
                    {dept.count} Doctor{dept.count !== 1 ? "s" : ""}
                  </Card.Meta>
                  <Card.Description style={{ marginTop: "1em", color: "#666" }}>
                    Click to view all doctors
                  </Card.Description>
                </Card.Content>
              </Card>
            </Grid.Column>
          ))}
        </Grid>
      )}
    </AdminLayout>
  );
}