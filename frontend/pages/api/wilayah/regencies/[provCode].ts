import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { provCode } = req.query;
  
  if (!provCode || typeof provCode !== "string") {
    return res.status(400).json({ error: "Invalid province code" });
  }

  try {
    const response = await fetch(`https://wilayah.id/api/regencies/${provCode}.json`);
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch regencies" });
  }
}
