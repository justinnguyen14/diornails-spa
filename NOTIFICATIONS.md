# Dior Nails notification setup

The booking system can send customer confirmations by email and text after provider credentials are added to a local `.env` file.

## 1. Create the private config file

In this folder, copy `.env.example` and name the copy `.env`.

Keep `.env` private. It is already ignored by Git.

## 2. Email confirmations with Resend

Fill these values in `.env`:

```env
RESEND_API_KEY=your_resend_api_key
NOTIFICATION_FROM_EMAIL=appointments@yourdomain.com
```

The sender email must be allowed by your Resend account. For production, use a verified domain email.

## 3. Text confirmations with Twilio

Fill these values in `.env`:

```env
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_FROM_NUMBER=+15551234567
```

Use the Twilio phone number exactly as Twilio provides it, including `+1`.

## 4. Restart the salon server

After editing `.env`, close the old server window and start it again with:

```text
start-salon-server.bat
```

## 5. Test without creating an appointment

Use the private test endpoint with the staff portal PIN:

```powershell
$body = @{
  customerName = "Test Customer"
  email = "your-email@example.com"
  phone = "8622583070"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://localhost:3000/api/test-notification" `
  -Method Post `
  -Headers @{ "X-Portal-Pin" = "3070" } `
  -ContentType "application/json" `
  -Body $body
```

If credentials are missing, the response will say which channel is not configured. If credentials are valid, the response should show `ok: true` for email and/or sms.
