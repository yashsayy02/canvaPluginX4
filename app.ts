import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { createBaseServer } from "./base_backend/create.js";
import { createJwtMiddleware } from "./jwt_middleware/jwt_middleware.js";

async function main() {
  const APP_ID = process.env.CANVA_APP_ID;

  if (!APP_ID) {
    throw new Error("CANVA_APP_ID is missing in .env");
  }

  const router = express.Router();

  const staticDir = path.join(process.cwd(), "static");

  if (!fs.existsSync(staticDir)) {
    fs.mkdirSync(staticDir);
  }

  router.use("/static", express.static(staticDir));


  router.use(
    cors({
      origin: `https://app-${APP_ID.toLowerCase()}.canva-apps.com`,
      optionsSuccessStatus: 200,
    })
  );

  router.get("/", (req, res) => {
    res.send("Canva Fetch Example Backend is running.");
  });


  const jwtMiddleware = createJwtMiddleware(APP_ID);
  router.use(jwtMiddleware);

  router.post("/process-pdf", async (req, res): Promise<void> => {
    try {
      const { pdf_url } = req.body;

      if (!pdf_url) {
        res.status(400).json({ error: "Missing pdf_url" });
        return;
      }

      console.log("PDF download URL:", pdf_url);

      const now = new Date();
      const timestamp = now
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\..+/, "")
        .replace("T", "_");

      const inputPdfName = `input_${timestamp}.pdf`;
      const outputPdfName = `output_${timestamp}.pdf`;

      const inputPdf = path.join(staticDir, inputPdfName);
      const outputPdf = path.join(staticDir, outputPdfName);

      const response = await fetch(pdf_url);
      if (!response.ok) {
        res.status(500).json({ error: "Failed to download PDF" });
        return;
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      fs.writeFileSync(inputPdf, buffer);
      console.log("Saved input PDF:", inputPdf);

      const exePath = path.join(__dirname, "PdfConverter.exe");

      execFile(exePath, [inputPdf, outputPdf], (error, stdout, stderr) => {
        if (error) {
          console.error("Converter EXE error:", error);
          console.error("stderr:", stderr);
          res.status(500).json({ error: "PDF conversion failed" });
          return;
        }

        console.log("Converter EXE output:", stdout);

        const processedUrl = `/static/${outputPdfName}`;

        res.json({
          input_file: `/static/${inputPdfName}`,
          processed_url: processedUrl,
        });
      });

    } catch (err) {
      console.error("Internal PDF processing error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const server = createBaseServer(router);
  server.start(process.env.PORT);
}

main();
