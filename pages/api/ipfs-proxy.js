export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const response = await fetch("http://127.0.0.1:5001/api/v0/add", {
      method: "POST",
      body: req.body,
    });
    const data = await response.text();
    res.status(200).json({ result: data });
  } catch {
    res.status(500).json({ error: "Failed to upload to local IPFS" });
  }
}
