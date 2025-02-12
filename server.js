require("dotenv").config();
const express = require("express");
const axios = require("axios");
const fs = require("fs");
const { google } = require("googleapis");

const app = express();
const PORT = process.env.PORT || 8080;

// Setup Google OAuth
const auth = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET
);
auth.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

const drive = google.drive({ version: "v3", auth });

// Fungsi untuk download file dari Amazon S3
async function downloadFromS3(s3Url) {
  const response = await axios({
    url: s3Url,
    method: "GET",
    responseType: "stream",
  });

  const filePath = `./tempfile.pdf`;
  const writer = fs.createWriteStream(filePath);

  return new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on("finish", () => resolve(filePath));
    writer.on("error", reject);
  });
}

// Fungsi untuk upload file ke Google Drive
async function uploadToGoogleDrive(filePath) {
  const fileMetadata = {
    name: "UploadedFromS3.pdf",
    parents: [process.env.FOLDER_ID], // Folder ID di Google Drive
  };

  const media = {
    mimeType: "application/pdf",
    body: fs.createReadStream(filePath),
  };

  const response = await drive.files.create({
    resource: fileMetadata,
    media,
    fields: "id, webViewLink",
  });

  fs.unlinkSync(filePath); // Hapus file setelah diupload
  return response.data;
}

// API Endpoint untuk menerima request dari Jojonomic
app.get("/upload", async (req, res) => {
  try {
    const { url } = req.query; // Ambil URL dari parameter
    if (!url) return res.status(400).json({ error: "URL is required" });

    console.log("Downloading file from S3...");
    const filePath = await downloadFromS3(url);

    console.log("Uploading file to Google Drive...");
    const uploadedFile = await uploadToGoogleDrive(filePath);

    res.json({
      success: true,
      driveUrl: uploadedFile.webViewLink,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Jalankan server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
