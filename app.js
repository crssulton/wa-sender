const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const StatusClient = {
  IDLE: "IDLE",
  WAITING: "WAITING",
  SCANING: "SCANING",
  CONNECTED: "CONNECTED",
  DISCONNECTED: "DISCONNECTED",
};

const app = express();
const PORT = process.env.PORT;

let qrGenerated = "";
let statusClient = StatusClient.IDLE;

app.use(express.json());

const client = new Client({
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
  authStrategy: new LocalAuth({ dataPath: "./session" }),
});

client.on("ready", () => {
  console.log("WhatsApp siap digunakan!");
  statusClient = StatusClient.CONNECTED;
});

client.on("disconnected", (session) => {
  console.log("WhatsApp disconnected!");
  statusClient = StatusClient.DISCONNECTED;
});

client.on("qr", (qr) => {
  console.log("QR code siap untuk di-scan: ");
  qrcode.generate(qr, { small: true });
  qrGenerated = qr;
  statusClient = StatusClient.SCANING;
});

const verifyApiKey = (req, res, next) => {
  const apiKey = req.header(process.env.API_KEY_NAME);
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  next();
};

app.use(verifyApiKey);

app.get("/init", (req, res) => {
  if (statusClient === StatusClient.CONNECTED && client.info) {
    return res.json({
      success: true,
      message: "WhatsApp siap digunakan!",
      status: statusClient,
    });
  }

  if ([StatusClient.IDLE, StatusClient.DISCONNECTED].includes(statusClient)) {
    statusClient = StatusClient.WAITING;

    client.initialize();

    return res.json({
      success: true,
      message: "Proses inisialisasi WhatsApp!",
      status: statusClient,
    });
  }

  return res.json({ success: true, status: statusClient, data: qrGenerated });
});

app.post("/send", (req, res) => {
  const { number, message } = req.body;
  if (!number || !message) {
    return res
      .status(400)
      .json({ error: "Mohon masukkan nomor dan pesan yang akan dikirim" });
  }

  client
    .sendMessage(`${number}@c.us`, message)
    .then(() => {
      res.json({ success: true, message: "Pesan berhasil dikirim" });
    })
    .catch((err) => {
      res.status(500).json({
        success: false,
        message: "Gagal mengirim pesan",
        data: err.message,
      });
    });
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
