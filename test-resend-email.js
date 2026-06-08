const fs = require("fs");
const path = require("path");

loadEnvFile();

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.NOTIFICATION_FROM_EMAIL || "onboarding@resend.dev";
const testRecipient = process.env.TEST_EMAIL_TO || "diornailsbuddlake@gmail.com";

if (!apiKey) {
  console.error("Missing RESEND_API_KEY in .env. Replace the blank value with your real re_... API key.");
  process.exit(1);
}

async function sendTestEmail() {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: fromEmail,
      to: testRecipient,
      subject: "Hello World",
      html: "<p>Congrats on sending your <strong>first email</strong>!</p>"
    })
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Resend test email failed:");
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  console.log("Resend test email sent successfully.");
  console.log(JSON.stringify(result, null, 2));
}

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      return;
    }

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

sendTestEmail().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
