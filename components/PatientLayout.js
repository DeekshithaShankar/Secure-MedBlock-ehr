import { Menu, Container, Icon } from "semantic-ui-react";
import { useRouter } from "next/router";

export default function PatientLayout({ children, activeTab, account }) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("isPatient");
    router.push("/");
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f5" }}>
      <Menu
        inverted
        color="teal"
        size="large"
        style={{
          borderRadius: 0,
          margin: 0,
          background: "linear-gradient(90deg, #009688 0%, #00796B 100%)",
          minHeight: "10px",
          fontSize: "1.1em",
          padding: "0.3em 0",
        }}
      >
        <Container style={{ display: "flex", alignItems: "center", minHeight: "10px" }}>
          <Menu.Item 
            header 
            onClick={() => router.push("/patient")}
            style={{ fontSize: "1.2em", padding: "1.2em 1.5em", cursor: "pointer" }}
          >
            <Icon name="heartbeat" />
            Patient Dashboard
          </Menu.Item>

          <Menu.Item
            active={activeTab === "about"}
            onClick={() => router.push("/patient?tab=about")}
            style={{ fontSize: "1.2em",padding: "1.2em 1.5em", cursor: "pointer" }}
          >
            <Icon name="user" /> About Me
          </Menu.Item>

          <Menu.Item
            active={activeTab === "history"}
            onClick={() => router.push("/patient?tab=history")}
            style={{ fontSize: "1.2em",padding: "1.2em 1.5em", cursor: "pointer" }}
          >
            <Icon name="history" /> Doctor History
          </Menu.Item>

          <Menu.Item
            active={activeTab === "records"}
            onClick={() => router.push("/patient/view-records")}
            style={{ fontSize: "1.2em",padding: "1.2em 1.5em", cursor: "pointer" }}
          >
            <Icon name="file alternate" /> View My Records
          </Menu.Item>

          <Menu.Item
            active={activeTab === "logs"}
            onClick={() => router.push("/patient/access-logs")}
            style={{ fontSize: "1.2em",padding: "1.2em 1.5em", cursor: "pointer" }}
          >
            <Icon name="history" /> Access Logs
          </Menu.Item>

          <Menu.Item
            active={activeTab === "consent"}
            onClick={() => router.push("/patient/manage-consent")}
            style={{ fontSize: "1.2em",padding: "1.2em 1.5em", cursor: "pointer" }}
          >
            <Icon name="shield" /> Manage Consent
          </Menu.Item>

          <Menu.Menu>
            <Menu.Item onClick={handleLogout} style={{ fontSize: "1.2em",padding: "1.2em 1.5em", cursor: "pointer" }}>
              <Icon name="sign-out" /> Logout
            </Menu.Item>
          </Menu.Menu>
        </Container>
      </Menu>

      <Container style={{ marginTop: "2em", marginBottom: "2em" }}>
        {children}
      </Container>
    </div>
  );
}