import { useState } from "react";
import { ethers } from "ethers";
import AdminLayout from "../../components/AdminLayout";
import DoctorRegistry from "../../artifacts/contracts/DoctorRegistry.sol/DoctorRegistry.json";
import { ContractAddress } from "../../config";

export default function AddDoctor() {
  const [form, setForm] = useState({
    wallet: "",
    name: "",
    age: "",
    specialization: "",
    department: "",
    licenseId: "",
  });

  const [message, setMessage] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(false);
  const [showReactivateButton, setShowReactivateButton] = useState(false);
  const [inactiveDoctor, setInactiveDoctor] = useState(null);

  const departments = [
    "Cardiology",
    "Neurology",
    "Orthopedics",
    "Dermatology",
    "Pediatrics",
    "Radiology",
    "Urology",
    "Oncology",
    "Emergency",
    "General Medicine",
    "Dental",
    "Gynocology"
  ];

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const registerDoctor = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });
    setShowReactivateButton(false);

    try {
      if (!window.ethereum) throw new Error("MetaMask not detected");

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(ContractAddress, DoctorRegistry.abi, signer);

      const doctorData = await contract.doctors(form.wallet);
      if (doctorData.exists) {
        if (doctorData.isActive) {
          setMessage({
            type: "error",
            text: ` Dr. ${doctorData.fullName} is already registered and active!`,
          });
          setLoading(false);
          return;
        } else {
          setInactiveDoctor({
            name: doctorData.fullName,
            wallet: form.wallet,
          });
          setShowReactivateButton(true);
          setMessage({
            type: "warning",
            text: ` Dr. ${doctorData.fullName} was previously removed. Click "Reactivate" to restore their account.`,
          });
          setLoading(false);
          return;
        }
      }

      const tx = await contract.registerDoctor(
        form.wallet,
        form.name,
        parseInt(form.age),
        form.specialization,
        form.department,
        form.licenseId
      );

      await tx.wait();

      setMessage({
        type: "success",
        text: `Dr. ${form.name} registered successfully in ${form.department}!`,
      });
      setForm({
        wallet: "",
        name: "",
        age: "",
        specialization: "",
        department: "",
        licenseId: "",
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: ` ${err.reason || err.message || "Registration failed"}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const reactivateDoctor = async () => {
    if (!inactiveDoctor) return;

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(ContractAddress, DoctorRegistry.abi, signer);
      const tx = await contract.reactivateDoctor(inactiveDoctor.wallet);
      await tx.wait();

      setMessage({
        type: "success",
        text: ` Dr. ${inactiveDoctor.name} has been reactivated successfully!`,
      });
      setShowReactivateButton(false);
      setInactiveDoctor(null);
      setForm({
        wallet: "",
        name: "",
        age: "",
        specialization: "",
        department: "",
        licenseId: "",
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: ` ${err.reason || err.message || "Reactivation failed"}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <h2 className="text-4xl font-bold mb-8 text-center text-gray-800">
        Register New Doctor
      </h2>

      <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-lg">
        <form onSubmit={registerDoctor} className="space-y-5">
          <div>
            <label className="block text-gray-700 font-semibold mb-2 text-lg">
              Doctor Wallet Address
            </label>
            <input
              className="w-full border-2 border-gray-300 p-4 rounded-lg text-lg focus:border-teal-500 focus:outline-none transition"
              name="wallet"
              placeholder="0x..."
              value={form.wallet}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2 text-lg">
              Full Name
            </label>
            <input
              className="w-full border-2 border-gray-300 p-4 rounded-lg text-lg focus:border-teal-500 focus:outline-none transition"
              name="name"
              placeholder="Dr. John Doe"
              value={form.name}
              onChange={handleChange}
              required
              disabled={showReactivateButton} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-semibold mb-2 text-lg">
                Age
              </label>
              <input
                className="w-full border-2 border-gray-300 p-4 rounded-lg text-lg focus:border-teal-500 focus:outline-none transition"
                name="age"
                type="number"
                placeholder="35"
                value={form.age}
                onChange={handleChange}
                required
                disabled={showReactivateButton}
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2 text-lg">
                Specialization
              </label>
              <input
                className="w-full border-2 border-gray-300 p-4 rounded-lg text-lg focus:border-teal-500 focus:outline-none transition"
                name="specialization"
                placeholder="Cardiology"
                value={form.specialization}
                onChange={handleChange}
                required
                disabled={showReactivateButton}
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2 text-lg">
              Department
            </label>
            <select
              className="w-full border-2 border-gray-300 p-4 rounded-lg text-lg bg-white focus:border-teal-500 focus:outline-none transition cursor-pointer"
              name="department"
              value={form.department}
              onChange={handleChange}
              required
              disabled={showReactivateButton}
            >
              <option value="">Select Department</option>
              {departments.map((dept, idx) => (
                <option key={idx} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2 text-lg">
              License ID
            </label>
            <input
              className="w-full border-2 border-gray-300 p-4 rounded-lg text-lg focus:border-teal-500 focus:outline-none transition"
              name="licenseId"
              placeholder="DOC-12345"
              value={form.licenseId}
              onChange={handleChange}
              required
              disabled={showReactivateButton}
            />
          </div>

          {!showReactivateButton && (
            <button
              type="submit"
              disabled={loading}
              className={`w-full text-white text-xl font-bold py-4 rounded-lg mt-6 transition duration-300 ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-teal-600 hover:bg-teal-700 hover:shadow-lg"
              }`}
            >
              {loading ? "Registering..." : "Register Doctor"}
            </button>
          )}
        </form>

        {showReactivateButton && (
          <div className="mt-6 space-y-4">
            <button
              type="button"
              onClick={reactivateDoctor}
              disabled={loading}
              className={`w-full text-white text-xl font-bold py-4 rounded-lg transition duration-300 ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700 hover:shadow-lg"
              }`}
            >
              {loading ? "Reactivating..." : "Reactivate Dr. " + inactiveDoctor?.name}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowReactivateButton(false);
                setInactiveDoctor(null);
                setMessage({ type: "", text: "" });
                setForm({
                  wallet: "",
                  name: "",
                  age: "",
                  specialization: "",
                  department: "",
                  licenseId: "",
                });
              }}
              className="w-full text-gray-700 text-lg font-semibold py-3 rounded-lg border-2 border-gray-300 hover:bg-gray-100 transition"
            >
              Cancel & Register New Doctor
            </button>
          </div>
        )}

        {message.text && (
          <div
            className={`mt-6 p-4 rounded-lg text-center text-lg font-semibold ${
              message.type === "success"
                ? "bg-green-100 text-green-800 border-2 border-green-300"
                : message.type === "warning"
                ? "bg-yellow-100 text-yellow-800 border-2 border-yellow-300"
                : "bg-red-100 text-red-800 border-2 border-red-300"
            }`}
          >
            {message.text}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}