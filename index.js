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

    console.log(`Uploaded ${fileName} successfully: ${response.data.webViewLink}`);

    // Set permission agar file bisa diakses oleh Google Calendar
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    return {
      fileUrl: response.data.webViewLink,
      title: fileName,
    };
  } catch (error) {
    console.error(`Error uploading file ${fileName}:`, error);
    return null;
  }
}

/**
 * Endpoint untuk menerima array attachment tanpa key "array_attachment"
 */
app.post("/upload", async (req, res) => {
  try {
    const attachments = req.body;

    if (!attachments || !Array.isArray(attachments)) {
      return res.status(400).json({ error: "Invalid request format" });
    }

    console.log("Received attachments:", attachments);

    const uploadResults = await Promise.all(
      attachments.map(async (attachment) => {
        try {
          console.log(`Fetching file from AWS: ${attachment.url}`);
          const response = await axios.get(attachment.url, { responseType: "arraybuffer" });

          const fileName = attachment.name;
          const mimeType = response.headers["content-type"];
          const fileBuffer = Buffer.from(response.data);

          return await uploadToGoogleDrive(fileBuffer, fileName, mimeType);
        } catch (error) {
          console.error(`Failed to process file ${attachment.name}:`, error);
          return null;
        }
      })
    );

    const filteredResults = uploadResults.filter((result) => result !== null);

    res.json({ status: "success", uploaded_files: filteredResults });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Failed to process request" });
  }
});

// Export untuk Vercel
module.exports = app;
