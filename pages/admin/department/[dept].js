import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import AdminLayout from "../../../components/AdminLayout";
import { ethers } from "ethers";
import DoctorRegistry from "../../../artifacts/contracts/DoctorRegistry.sol/DoctorRegistry.json";
import { ContractAddress } from "../../../config";
import {Label} from "semantic-ui-react";
export default function DepartmentDoctors() {
  const router = useRouter();
  const { dept } = router.query;
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (dept) loadDoctors();
  }, [dept]);

  const loadDoctors = async () => {
    try {
      if (!window.ethereum) throw new Error("MetaMask not found");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(ContractAddress, DoctorRegistry.abi, provider);
      const allDoctors = await contract.getAllDoctors();

      const filtered = allDoctors.filter(
        (d) => d.department && d.department.toLowerCase() === dept.toLowerCase()
      );
      setDoctors(filtered);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            {dept} Department
          </h1>
          <p className="text-lg text-gray-600">
            List of doctors currently registered under the {dept} department.
          </p>
        </div>

        {loading ? (
          <p className="text-center text-gray-500 text-lg">Loading doctors...</p>
        ) : doctors.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 p-8 rounded-xl text-center shadow-sm">
            <h3 className="text-2xl font-semibold text-gray-700 mb-2">
              No Doctors Found
            </h3>
            <p className="text-gray-500">
              There are no doctors currently registered in this department.
            </p>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
  {doctors.map((doc, i) => (
    <div
      key={i}
      className="rounded-2xl shadow-xl border border-gray-200 bg-white"
      style={{ overflow: "hidden", minHeight: "300px" }}
    >
      <div
        className={`p-6 text-white ${
          doc.isActive
            ? "bg-gradient-to-r from-teal-700 to-teal-500"
            : "bg-gradient-to-r from-gray-500 to-gray-600"
        }`}
      >
        <h2 className="text-3xl font-bold">
          Dr. {doc.fullName || "Unknown"}
        </h2>
      </div>

      <div className="p-5 text-gray-800 text-lg">
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
        color="red" 
        size="large" 
        style={{ 
          float: "right",
          fontSize: "1.1em",
          padding: "0.7em 1.2em"
        }}
      >
        Inactive
      </Label>
    )}
  </div>

        <hr className="my-4 border-gray-200" />

        <div className="space-y-2 text-xl leading-relaxed">

          <div className="flex">
            <b className="w-40 block">License ID:</b>
            <span className="font-mono">{doc.licenseId || "N/A"}</span>
          </div>

          <div className="flex">
            <b className="w-40 block">Specialization:</b>
            <span>{doc.specialization || "N/A"}</span>
          </div>

          <div className="flex">
            <b className="w-40 block">Department:</b>
            <span>{doc.department || "N/A"}</span>
          </div>
        </div>
      </div>
    </div>
  ))}
</div>

        )}
      </div>
    </AdminLayout>
  );
}
