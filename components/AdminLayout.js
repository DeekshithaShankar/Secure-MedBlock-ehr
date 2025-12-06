import { Menu, Container, Icon } from "semantic-ui-react";
import { useRouter } from "next/router";

export default function AdminLayout({ children }) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("isAdmin");
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
          minHeight: "30px",
          fontSize: "1.1em",
          padding: "0.4em 0",
        }}
      >
        <Container style={{ display: "flex", alignItems: "center", minHeight: "10px" }}>
          <Menu.Item
            header
            onClick={() => router.push("/admin")}
            style={{ fontSize: "1.2em", padding: "1.2em 1.5em" }}
          >
            Admin Dashboard
          </Menu.Item>

          <Menu.Item 
            onClick={() => router.push("/admin/add-doctor")}
            style={{ fontSize: "1.2em",padding: "1.2em 1.5em" }}
          >
            <Icon name="user plus" /> Add Doctor
          </Menu.Item>

          <Menu.Item 
            onClick={() => router.push("/admin/view-doctors")}
            style={{ fontSize: "1.2em",padding: "1.2em 1.5em" }}
          >
            <Icon name="users" /> View Doctors
          </Menu.Item>

          <Menu.Item 
            onClick={() => router.push("/admin/view-patients")}
            style={{ fontSize: "1.2em",padding: "1.2em 1.5em" }}
          >
            <Icon name="wheelchair" /> View Patients
          </Menu.Item>

          <Menu.Item
            onClick={() => router.push("/admin/departments")}
            style={{fontSize: "1.2em", padding: "1.2em 1.5em" }}
          >
            <Icon name="building" /> Departments
          </Menu.Item>

          <Menu.Item
            onClick={() => router.push("/admin/audit-logs")}
            style={{fontSize: "1.2em", padding: "1.2em 1.5em" }}
          >
            <Icon name="history" /> Audit Logs
          </Menu.Item>

            <Menu.Item

                color="teal"
                onClick={handleLogout}
                style={{fontSize: "1.2em",padding: "1.2em 1.5em" }}
              >
                <Icon name="sign-out" /> Logout

            </Menu.Item>

        </Container>
      </Menu>

      <Container style={{ marginTop: "2em", marginBottom: "2em" }}>
        {children}
      </Container>
    </div>
  );
}