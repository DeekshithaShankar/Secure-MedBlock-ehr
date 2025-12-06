import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { ethers } from "ethers";
import {
  Container,
  Header,
  Button,
  Grid,
  Segment,
  Icon,
  Message,
  Menu,
  Form,
  Card,
} from "semantic-ui-react";
import DoctorRegistry from "../artifacts/contracts/DoctorRegistry.sol/DoctorRegistry.json";
import HealthRecordSecure from "../artifacts/contracts/HealthRecordSecure.sol/HealthRecordSecure.json";
import { ContractAddress, HealthRecordAddress } from "../config";

export default function Home() {
  const router = useRouter();
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("login");
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [contactSuccess, setContactSuccess] = useState(false);

  useEffect(() => {
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({
          method: "eth_accounts",
        });
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        }
      } catch {
      }
    }
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        setError("Please install MetaMask!");
        return;
      }

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      setAccount(accounts[0]);
      setError("");
    } catch {
      setError("Failed to connect wallet");
    }
  };

  const handleLogin = async (role) => {
    try {
      setLoading(true);
      setError("");

      if (!account) {
        setError("Please connect your wallet first!");
        setLoading(false);
        return;
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const address = await signer.getAddress();

      if (role === "admin") {
        const doctorContract = new ethers.Contract(
          ContractAddress,
          DoctorRegistry.abi,
          provider
        );

        const isAdmin = await doctorContract.isAdmin(address);
        if (isAdmin) {
          localStorage.setItem("isAdmin", "true");
          router.push("/admin");
        } else {
          setError("Access denied. You are not the admin.");
        }
      } else if (role === "doctor") {
        const doctorContract = new ethers.Contract(
          ContractAddress,
          DoctorRegistry.abi,
          provider
        );

        const isDoctor = await doctorContract.isDoctor(address);
        if (isDoctor) {
          localStorage.setItem("isDoctor", "true");
          router.push("/doctor");
        } else {
          setError("Access denied. You are not a registered doctor.");
        }
      } else if (role === "patient") {
        const healthContract = new ethers.Contract(
          HealthRecordAddress,
          HealthRecordSecure.abi,
          provider
        );

        const isPatient = await healthContract.isPatient(address);
        if (isPatient) {
          localStorage.setItem("isPatient", "true");
          router.push("/patient");
        } else {
          setError(
            "Access denied. You are not a registered patient. Please contact your doctor to register."
          );
        }
      }
    } catch (err) {
      setError(err.reason || err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleContactSubmit = () => {
    if (contactForm.name && contactForm.email && contactForm.message) {
      setContactSuccess(true);
      setContactForm({ name: "", email: "", message: "" });
      setTimeout(() => setContactSuccess(false), 5000);
    }
  };

  const scrollToSection = (section) => {
    setActiveSection(section);
    document.getElementById(section)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8f9fa" }}>
      <Menu
        fixed="top"
        size="large"
        style={{
          backgroundColor: "white",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        }}
      >
        <Container>
          <Menu.Item header style={{ fontSize: "1.3em", color: "#009688" }}>
            <Icon name="heartbeat" />
            Secure Med-Block
          </Menu.Item>
          <Menu.Menu position="right">
            <Menu.Item
              active={activeSection === "login"}
              onClick={() => scrollToSection("login")}
            >
              Login
            </Menu.Item>
            <Menu.Item
              active={activeSection === "about"}
              onClick={() => scrollToSection("about")}
            >
              About
            </Menu.Item>
            <Menu.Item
              active={activeSection === "features"}
              onClick={() => scrollToSection("features")}
            >
              Features
            </Menu.Item>
            <Menu.Item
              active={activeSection === "contact"}
              onClick={() => scrollToSection("contact")}
            >
              Contact
            </Menu.Item>
          </Menu.Menu>
        </Container>
      </Menu>

      <div
        id="login"
        style={{
          padding: "8em 2em 5em 2em",
          marginTop: "3.5em",
          background: "linear-gradient(135deg, #009688 0%, #00bfa5 100%)",
          color: "white",
        }}
      >
        <Container>
          <Header
            as="h1"
            style={{
              fontSize: "3em",
              color: "white",
              marginBottom: "0.2em",
              fontWeight: "bold",
              textAlign: "center",
            }}
          >
            <Icon name="heartbeat" />
            Secure Med-Block
          </Header>
          <Header
            as="h2"
            style={{
              fontSize: "1.5em",
              color: "rgba(255,255,255,0.9)",
              fontWeight: "300",
              marginBottom: "2em",
              textAlign: "center",
            }}
          >
            Blockchain-Based Healthcare Record Management System
          </Header>

          {!account ? (
            <div style={{ textAlign: "center", marginBottom: "3em" }}>
              <Segment
                raised
                style={{
                  padding: "3em",
                  maxWidth: "500px",
                  margin: "0 auto",
                  backgroundColor: "white",
                }}
              >
                <Icon name="google wallet" size="huge" color="teal" />
                <Header as="h3" style={{ marginTop: "1em", color: "#2c3e50" }}>
                  Connect Your Wallet
                </Header>
                <p style={{ color: "#666", marginBottom: "2em" }}>
                  Please connect your MetaMask wallet to access the platform
                </p>
                <Button size="huge" color="teal" onClick={connectWallet}>
                  <Icon name="plug" /> Connect MetaMask
                </Button>
              </Segment>
            </div>
          ) : (
            <div style={{ backgroundColor: "white", padding: "3em", borderRadius: "15px" }}>

              <Grid columns={3} stackable divided>
                <Grid.Column textAlign="center">
                  <div
                    style={{
                      padding: "2.5em",
                      borderRadius: "15px",
                      backgroundColor: "#e3f2fd",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
                    }}
                  >
                    <Icon
                      name="shield alternate"
                      size="big"
                      color="blue"
                    />
                    <Header as="h3" color="blue" style={{ marginTop: "0.5em" }}>
                      Admin
                    </Header>
                    <p style={{ color: "#666", marginBottom: "1.5em", minHeight: "3em" }}>
                      Manage doctors, patients, and system settings
                    </p>
                    <Button
                      fluid
                      color="blue"
                      size="large"
                      onClick={() => handleLogin("admin")}
                      loading={loading}
                      disabled={loading}
                    >
                      Login as Admin
                    </Button>
                  </div>
                </Grid.Column>

                <Grid.Column textAlign="center">
                  <div
                    style={{
                      padding: "2.5em",
                      borderRadius: "15px",
                      backgroundColor: "#e0f2f1",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
                    }}
                  >
                    <Icon
                      name="user md"
                      size="big"
                      color="teal"
                    />
                    <Header as="h3" color="teal" style={{ marginTop: "0.5em" }}>
                      Doctor
                    </Header>
                    <p style={{ color: "#666", marginBottom: "1.5em", minHeight: "3em" }}>
                      Register patients and manage health records
                    </p>
                    <Button
                      fluid
                      color="teal"
                      size="large"
                      onClick={() => handleLogin("doctor")}
                      loading={loading}
                      disabled={loading}
                    >
                      Login as Doctor
                    </Button>
                  </div>
                </Grid.Column>

                <Grid.Column textAlign="center">
                  <div
                    style={{
                      padding: "2.5em",
                      borderRadius: "15px",
                      backgroundColor: "#fce4ec",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
                    }}
                  >
                    <Icon
                      name="user"
                      size="big"
                      color="pink"
                    />
                    <Header as="h3" color="pink" style={{ marginTop: "0.5em" }}>
                      Patient
                    </Header>
                    <p style={{ color: "#666", marginBottom: "1.5em", minHeight: "3em" }}>
                      View your medical records and history
                    </p>
                    <Button
                      fluid
                      color="pink"
                      size="large"
                      onClick={() => handleLogin("patient")}
                      loading={loading}
                      disabled={loading}
                    >
                      Login as Patient
                    </Button>
                  </div>
                </Grid.Column>
              </Grid>

              {error && (
                <Message
                  negative
                  style={{ marginTop: "2em" }}
                  onDismiss={() => setError("")}
                >
                  <Message.Header>Login Error</Message.Header>
                  <p>{error}</p>
                </Message>
              )}

            </div>
          )}
        </Container>
      </div>

      <div
        id="about"
        style={{
          padding: "5em 2em",
          backgroundColor: "white",
        }}
      >
        <Container>
          <Header
            as="h2"
            textAlign="center"
            style={{
              fontSize: "2.5em",
              color: "#2c3e50",
              marginBottom: "0.5em",
            }}
          >
            About Secure Med-Block
          </Header>
          <p
            style={{
              textAlign: "center",
              fontSize: "1.1em",
              color: "#666",
              marginBottom: "3em",
              maxWidth: "800px",
              margin: "0 auto 3em auto",
            }}
          >
          </p>

          <Grid columns={2} stackable style={{ marginTop: "3em" }}>
            <Grid.Column>
              <Segment
                raised
                style={{ padding: "2em", minHeight: "250px", border: "none" }}
              >
                <Header as="h3" style={{ color: "#009688" }}>
                  <Icon name="shield alternate" />
                  Our Mission
                </Header>
                <p style={{ fontSize: "1.05em", lineHeight: "1.8", color: "#555" }}>
                  To provide a secure, transparent, and patient-centric
                  healthcare record management system powered by blockchain
                  technology. We aim to give patients full control over their
                  medical data while ensuring healthcare providers have seamless
                  access when needed.
                </p>
              </Segment>
            </Grid.Column>

            <Grid.Column>
              <Segment
                raised
                style={{ padding: "2em", minHeight: "250px", border: "none" }}
              >
                <Header as="h3" style={{ color: "#009688" }}>
                  <Icon name="certificate" />
                  Why Blockchain?
                </Header>
                <p style={{ fontSize: "1.05em", lineHeight: "1.8", color: "#555" }}>
                  Blockchain technology ensures that health records are
                  immutable, transparent, and secure. Every transaction is
                  recorded on the Ethereum blockchain, preventing unauthorized
                  modifications and ensuring complete audit trails of all medical
                  data access.
                </p>
              </Segment>
            </Grid.Column>
          </Grid>
        </Container>
      </div>

      <div
        id="features"
        style={{
          padding: "5em 2em",
          backgroundColor: "#f8f9fa"
       
        }}
      >
        <Container>
          <Header
            as="h2"
            textAlign="center"
            style={{
              fontSize: "2.5em",
              color: "#2c3e50",
              marginBottom: "0.5em",
            }}
          >
            Key Features
          </Header>
          <p
            style={{
              textAlign: "center",
              fontSize: "1.1em",
              color: "#666",
              marginBottom: "3em",
            }}
          >
            Discover what makes our platform unique
          </p>

          <Grid columns={3} stackable>
            <Grid.Column>
              <Card
                fluid
                style={{
                  textAlign: "center",
                  padding: "2em",
                  border: "none",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                }}
              >
                <Icon
                
                  name="lock"
                  size="huge"
                  color="teal"
                  style={{ marginBottom: "0.5em" }}
                  
                />
                <Card.Content>
                  <Card.Header>Secure and Encrypted</Card.Header>
                  <Card.Description style={{ marginTop: "1em" }}>
                    All medical records are encrypted and stored securely on IPFS
                    with blockchain verification
                  </Card.Description>
                </Card.Content>
              </Card>
            </Grid.Column>

            <Grid.Column>
              <Card
                fluid
                style={{
                  textAlign: "center",
                  padding: "2em",
                  border: "none",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                }}
              >
                <Icon
                  name="exchange"
                  size="huge"
                  color="blue"
                  style={{ marginBottom: "0.5em" }}
                  
                />
                <Card.Content>
                  <Card.Header>Patient Control</Card.Header>
                  <Card.Description style={{ marginTop: "1em" }}>
                    Patients have full ownership and control over who can access
                    their health data
                  </Card.Description>
                </Card.Content>
              </Card>
            </Grid.Column>

            <Grid.Column>
              <Card
                fluid
                style={{
                  textAlign: "center",
                  padding: "2em",
                  border: "none",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                }}
              >
                <Icon
                  name="history"
                  size="huge"
                  color="orange"
                  style={{ marginBottom: "0.5em" }}
                />
                <Card.Content>
                  <Card.Header>Complete Audit Trail</Card.Header>
                  <Card.Description style={{ marginTop: "1em" }}>
                    Every access and modification is permanently recorded on the
                    blockchain
                  </Card.Description>
                </Card.Content>
              </Card>
            </Grid.Column>

            <Grid.Column>
              <Card
                fluid
                style={{
                  textAlign: "center",
                  padding: "2em",
                  border: "none",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                }}
              >
                <Icon
                  name="doctor"
                  size="huge"
                  color="pink"
                  style={{ marginBottom: "0.5em" }}
                />
                <Card.Content>
                  <Card.Header>Doctor Management</Card.Header>
                  <Card.Description style={{ marginTop: "1em" }}>
                    Verified healthcare providers can register and manage patient
                    records securely
                  </Card.Description>
                </Card.Content>
              </Card>
            </Grid.Column>

            <Grid.Column>
              <Card
                fluid
                style={{
                  textAlign: "center",
                  padding: "2em",
                  border: "none",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                }}
              >
                <Icon
                  name="ethereum"
                  size="huge"
                  color="violet"
                  style={{ marginBottom: "0.5em" }}
                />
                <Card.Content>
                  <Card.Header>Blockchain Powered</Card.Header>
                  <Card.Description style={{ marginTop: "1em" }}>
                    Built on Ethereum blockchain ensuring transparency and
                    immutability
                  </Card.Description>
                </Card.Content>
              </Card>
            </Grid.Column>

            <Grid.Column>
              <Card
                fluid
                style={{
                  textAlign: "center",
                  padding: "2em",
                  border: "none",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                }}
              >
                <Icon
                  name="cloud upload"
                  size="huge"
                  color="green"
                  style={{ marginBottom: "0.5em" }}
                />
                <Card.Content>
                  <Card.Header>IPFS Storage</Card.Header>
                  <Card.Description style={{ marginTop: "1em" }}>
                    Decentralized storage ensures data availability and
                    redundancy
                  </Card.Description>
                </Card.Content>
              </Card>
            </Grid.Column>
          </Grid>
        </Container>
      </div>

      <div
        id="contact"
        style={{
          padding: "5em 2em",
          backgroundColor: "white",
        }}
      >
        <Container>
          <Header
            as="h2"
            textAlign="center"
            style={{
              fontSize: "2.5em",
              color: "#2c3e50",
              marginBottom: "0.5em",
            }}
          >
            Contact Us
          </Header>
          <p
            style={{
              textAlign: "center",
              fontSize: "1.1em",
              color: "#666",
              marginBottom: "3em",
            }}
          >
            Have questions? We would love to hear from you
          </p>
          <Grid stackable centered>
          <Grid.Column width={10}>
            <Segment
              raised
              style={{ padding: "2em", border: "none" }}
            >
              <Header as="h3" style={{ color: "#009688", textAlign: "center" }}>
                <Icon name="send" />
                Send us a Message
              </Header>
              <Form style={{ marginTop: "2em" }}>
                <Form.Input
                  label="Name"
                  placeholder="Your name"
                  value={contactForm.name}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, name: e.target.value })
                  }
                />
                <Form.Input
                  label="Email"
                  placeholder="your.email@example.com"
                  type="email"
                  value={contactForm.email}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, email: e.target.value })
                  }
                />
                <Form.TextArea
                  label="Message"
                  placeholder="How can we help you?"
                  rows={4}
                  value={contactForm.message}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, message: e.target.value })
                  }
                />
                <div style={{ textAlign: "center" }}>
                  <Button
                    color="teal"
                    size="large"
                    onClick={handleContactSubmit}
                  >
                    <Icon name="paper plane" /> Send Message
                  </Button>
                </div>
              </Form>
              {contactSuccess && (
                <Message positive style={{ marginTop: "1em" }}>
                  <Icon name="check" /> Thank you! We will get back to you soon.
                </Message>
              )}
            </Segment>
          </Grid.Column>
        </Grid>
        </Container>
      </div>

      <div
        style={{
          backgroundColor: "#2c3e50",
          color: "white",
          padding: "3em 2em",
          textAlign: "center",
        }}
      >
        <Container>
          <Grid columns={3} stackable divided inverted>
            <Grid.Column>
              <Header as="h4" inverted>
                About
              </Header>
              <p style={{ opacity: 0.8 }}>
                Secure Med-Block is a revolutionary healthcare management system
                leveraging blockchain technology for secure medical records.
              </p>
            </Grid.Column>

            <Grid.Column>
              <Header as="h4" inverted>
                Quick Links
              </Header>
              <p>
                
                 <a href="#login"
                  style={{ color: "white", opacity: 0.8, display: "block", marginBottom: "0.5em" }}
                >
                  Login
                </a>
                
                <a  href="#about"
                  style={{ color: "white", opacity: 0.8, display: "block", marginBottom: "0.5em" }}
                >
                  About
                </a>
                
                 <a href="#features"
                  style={{ color: "white", opacity: 0.8, display: "block", marginBottom: "0.5em" }}
                >
                  Features
                </a>
                
                 <a href="#contact"
                  style={{ color: "white", opacity: 0.8, display: "block" }}
                >
                  Contact
                </a>
              </p>
            </Grid.Column>

            <Grid.Column>
              <Header as="h4" inverted>
                Technology
              </Header>
              <p style={{ opacity: 0.8 }}>
                <Icon name="ethereum" /> Ethereum Blockchain
                <br />
                <Icon name="shield" /> Smart Contracts
                <br />
                <Icon name="database" /> IPFS Storage
              </p>
            </Grid.Column>
          </Grid>

          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.2)",
              marginTop: "2em",
              paddingTop: "2em",
              opacity: 0.7,
            }}
          >
            <p>
              2025 Secure Med-Block. All rights reserved. Powered by Ethereum Blockchain
            </p>
          </div>
        </Container>
      </div>
    </div>
  );
}