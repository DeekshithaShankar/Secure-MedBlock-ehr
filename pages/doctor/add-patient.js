import { useState } from "react";
import { ethers } from "ethers";
import DoctorLayout from "../../components/DoctorLayout";
import HealthRecordSecure from "../../artifacts/contracts/HealthRecordSecure.sol/HealthRecordSecure.json";
import { HealthRecordAddress } from "../../config";

export default function AddPatient() {
  const [form, setForm] = useState({
    walletAddress: "",
    name: "",
    age: "",
    bloodGroup: "",
    phone: "",
  });
  const [message, setMessage] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const registerPatient = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setMessage({ type: "", text: "" });

      if (!window.ethereum) throw new Error("MetaMask not detected");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        HealthRecordAddress,
        HealthRecordSecure.abi,
        signer
      );

      try {
        const patientData = await contract.patients(form.walletAddress);
        if (patientData.exists) {
          if (!patientData.isActive) {
            setMessage({
              type: "warning",
              text: "This patient was previously removed. Please contact admin to reactivate.",
            });
            setLoading(false);
            return;
          } else {
            setMessage({
              type: "error",
              text: "Patient already registered and active.",
            });
            setLoading(false);
            return;
          }
        }
      } catch {
      }

      const tx = await contract.registerPatient(
        form.walletAddress,
        form.name,
        parseInt(form.age),
        form.bloodGroup,
        form.phone
      );
      await tx.wait();

      const nextId = await contract.getNextPatientId();
      setMessage({
        type: "success",
        text: `Patient ${form.name} registered successfully! Assigned ID: ${nextId.toNumber() - 1}`,
      });

      setForm({
        walletAddress: "",
        name: "",
        age: "",
        bloodGroup: "",
        phone: "",
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: err.reason || err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DoctorLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">Patient Registration Form</h1>

        <div className="bg-white rounded-2xl shadow-2xl p-8 border-3 border-teal-100">
          <form onSubmit={registerPatient} className="space-y-6">
            <div>
              <label className="block text-gray-700 font-bold text-lg mb-3">
                Patient Wallet Address
              </label>
              <input
                type="text"
                name="walletAddress"
                value={form.walletAddress}
                onChange={handleChange}
                placeholder="0x..."
                required
                className="w-full border-2 border-gray-300 rounded-xl px-6 py-4 text-lg focus:border-teal-500 focus:outline-none transition"
              />
              <p className="text-sm text-gray-500 mt-2">
                Enter the patient's Ethereum wallet address
              </p>
            </div>

            <div>
              <label className="block text-gray-700 font-bold text-lg mb-3">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Deekshitha Shankar"
                required
                className="w-full border-2 border-gray-300 rounded-xl px-6 py-4 text-lg focus:border-teal-500 focus:outline-none transition"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-700 font-bold text-lg mb-3">
                  Age
                </label>
                <input
                  type="number"
                  name="age"
                  value={form.age}
                  onChange={handleChange}
                  placeholder="30"
                  required
                  min="1"
                  max="150"
                  className="w-full border-2 border-gray-300 rounded-xl px-6 py-4 text-lg focus:border-teal-500 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold text-lg mb-3">
                  Blood Group
                </label>
                <select
                  name="bloodGroup"
                  value={form.bloodGroup}
                  onChange={handleChange}
                  required
                  className="w-full border-2 border-gray-300 rounded-xl px-6 py-4 text-lg focus:border-teal-500 focus:outline-none transition bg-white cursor-pointer"
                >
                  <option value="">Select Blood Group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
            </div>

    
            <div>
              <label className="block text-gray-700 font-bold text-lg mb-3">
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="+1 9876543210"
                required
                className="w-full border-2 border-gray-300 rounded-xl px-6 py-4 text-lg focus:border-teal-500 focus:outline-none transition"
              />
              <p className="text-sm text-gray-500 mt-2">
                Include country code (e.g., +1 for USA)
              </p>
            </div>

        
            <button
              type="submit"
              disabled={loading}
              className={`w-full text-white text-xl font-bold py-5 rounded-xl transition duration-300 shadow-lg ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-600 hover:to-cyan-600 hover:shadow-xl"
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  Registering Patient...
                </span>
              ) : (
                "Submit"
              )}
            </button>
          </form>
        </div>

        {message.text && (
          <div
            className={`mt-6 p-6 rounded-xl text-lg font-semibold border-2 ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border-green-300"
                : message.type === "warning"
                ? "bg-yellow-50 text-yellow-800 border-yellow-300"
                : "bg-red-50 text-red-800 border-red-300"
            }`}
          >
            {message.type === "success" && " "}
            {message.type === "warning" && " "}
            {message.type === "error" && " "}
            {message.text}
          </div>
        )}
      </div>
    </DoctorLayout>
  );
}