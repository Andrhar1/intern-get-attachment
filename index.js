const express = require("express");
const axios = require("axios");
const { google } = require("googleapis");
const { Readable } = require("stream");
require("dotenv").config();

const app = express();
app.use(express.json());

// Setup OAuth2 Client untuk Google Drive
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const drive = google.drive({ version: "v3", auth: oauth2Client });

/**
 * Fungsi untuk mengunggah file ke Google Drive
 */
async function uploadToGoogleDrive(fileBuffer, fileName, mimeType) {
  try {
    const fileMetadata = {
      name: fileName,
      parents: [process.env.GOOGLE_FOLDER_ID],
    };

    // Ubah buffer menjadi stream agar kompatibel dengan Google Drive API
    const bufferStream = new Readable();
    bufferStream.push(fileBuffer);
    bufferStream.push(null);

    const media = {
      mimeType: mimeType,
      body: bufferStream,
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

/**
 * Endpoint untuk menerima URL AWS S3 dan mengunggah file ke Google Drive
 */
app.post("/upload", async (req, res) => {
  try {
    const { awsUrl } = req.body;
    console.log("Received AWS URL:", awsUrl);

    if (!awsUrl) {
      console.error("Error: AWS URL is missing");
      return res.status(400).json({ error: "AWS URL is required" });
    }

    // Fetch file dari AWS S3
    console.log("Fetching file from AWS...");
    const response = await axios.get(awsUrl, { responseType: "arraybuffer" });
    console.log("File fetched successfully.");

    const fileName = awsUrl.split("/").pop();
    const mimeType = response.headers["content-type"];
    const fileBuffer = Buffer.from(response.data);

    // Upload ke Google Drive
    console.log("Uploading file to Google Drive...");
    const googleDriveLink = await uploadToGoogleDrive(fileBuffer, fileName, mimeType);
    console.log("File uploaded successfully:", googleDriveLink);

    return res.json({ googleDriveLink });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Failed to process request" });
  }
});

// Export untuk Vercel
module.exports = app;
