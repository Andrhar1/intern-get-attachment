const express = require("express");
const axios = require("axios");
const { google } = require("googleapis");
require("dotenv").config();

const app = express();
app.use(express.json());

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const drive = google.drive({ version: "v3", auth: oauth2Client });

async function uploadToGoogleDrive(fileBuffer, fileName, mimeType) {
  try {
    const fileMetadata = {
      name: fileName,
      parents: [process.env.GOOGLE_FOLDER_ID],
    };

    const media = {
      mimeType: mimeType,
      body: fileBuffer,
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, webViewLink",
    });

    return response.data.webViewLink;
  } catch (error) {
    console.error("Error uploading file:", error);
    throw new Error("Failed to upload file to Google Drive.");
  }
}

app.post("/upload", async (req, res) => {
  try {
    const { awsUrl } = req.body;

    if (!awsUrl) {
      return res.status(400).json({ error: "AWS URL is required" });
    }

    // Fetch file from AWS S3 URL
    const response = await axios.get(awsUrl, { responseType: "arraybuffer" });

    const fileName = awsUrl.split("/").pop();
    const mimeType = response.headers["content-type"];
    const fileBuffer = Buffer.from(response.data);

    // Upload to Google Drive
    const googleDriveLink = await uploadToGoogleDrive(fileBuffer, fileName, mimeType);

    return res.json({ googleDriveLink });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to process request" });
  }
});

// Konfigurasi server untuk Vercel
module.exports = app;