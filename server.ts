import express from "express";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON parsing middleware with custom limits for large payloads (e.g. base64 images if needed)
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API Route to securely delete Cloudinary images
  app.post("/api/delete-cloudinary-image", async (req, res) => {
    try {
      const { publicIds } = req.body;
      if (!publicIds || !Array.isArray(publicIds)) {
        return res.status(400).json({ error: "Missing or invalid publicIds array" });
      }

      const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "rqf1hlrx";
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;

      if (!apiKey || !apiSecret) {
        return res.status(500).json({ 
          error: "Cloudinary credentials are not configured on the server. Please add CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to Settings." 
        });
      }

      const results = [];
      const errors = [];

      for (const publicId of publicIds) {
        if (!publicId || typeof publicId !== "string") continue;
        
        try {
          const timestamp = Math.round(new Date().getTime() / 1000).toString();
          const stringToSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
          const signature = crypto.createHash("sha1").update(stringToSign).digest("hex");

          const params = new URLSearchParams();
          params.append("public_id", publicId);
          params.append("api_key", apiKey);
          params.append("timestamp", timestamp);
          params.append("signature", signature);

          const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString(),
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Cloudinary responded with status ${response.status}: ${errText}`);
          }

          const data = await response.json();
          if (data.result === "ok" || data.result === "not_found") {
            results.push({ publicId, status: data.result });
          } else {
            throw new Error(`Cloudinary returned result status: ${data.result}`);
          }
        } catch (err: any) {
          console.error(`Failed to delete Cloudinary image: ${publicId}`, err);
          errors.push({ publicId, error: err.message || String(err) });
        }
      }

      if (errors.length > 0) {
        return res.status(500).json({
          error: "Partial or full deletion failure on Cloudinary",
          details: errors,
          results
        });
      }

      return res.json({ success: true, results });
    } catch (error: any) {
      console.error("Error in delete-cloudinary-image endpoint:", error);
      return res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: process.env.NODE_ENV });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
