const http = require("http");
const fs = require("fs");
const path = require("path");
const { URLSearchParams } = require("url");

const PORT = Number(process.env.PORT || 3000);
const PORTAL_PIN = process.env.SALON_PORTAL_PIN || "3070";
const DATA_DIR = path.join(__dirname, "data");
const BOOKINGS_FILE = path.join(DATA_DIR, "bookings.json");
const SCHEDULE_FILE = path.join(DATA_DIR, "schedule.json");
const PUBLIC_DIR = __dirname;

loadEnvFile();

const nailTechs = parseNailTechs(process.env.NAIL_TECHS || "Kevin");

const staff = [
  { id: "any", name: "Any available tech" },
  ...nailTechs
];

const bookableStaff = nailTechs;

const services = [
  "Manicure Gel and Pedicure Gel",
  "Manicure Gel and Pedicure Regular",
  "Manicure Gel",
  "Manicure Regular",
  "Pedicure and Manicure and Regular",
  "Pedicure Regular",
  "Spa Pedicure with Gel Color",
  "Spa Pedicure Volcano",
  "Pedicure with Gel Color"
].sort((a, b) => a.localeCompare(b));

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function parseNailTechs(value) {
  return String(value || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({
      id: slugify(name),
      name,
      workDays: workDaysForTech(name)
    }));
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function workDaysForTech(name) {
  if (slugify(name) === "rumi") {
    return [0, 1, 2, 3, 4, 5];
  }

  return [0, 1, 2, 3, 4, 5, 6];
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

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(BOOKINGS_FILE)) {
    fs.writeFileSync(BOOKINGS_FILE, "[]\n");
  }

  if (!fs.existsSync(SCHEDULE_FILE)) {
    writeSchedule(defaultSchedule());
  }
}

function readBookings() {
  ensureStore();
  return JSON.parse(fs.readFileSync(BOOKINGS_FILE, "utf8"));
}

function writeBookings(bookings) {
  ensureStore();
  fs.writeFileSync(BOOKINGS_FILE, `${JSON.stringify(bookings, null, 2)}\n`);
}

function defaultSchedule() {
  return {
    weekly: Object.fromEntries(bookableStaff.map((person) => [person.id, person.workDays])),
    overrides: {}
  };
}

function readSchedule() {
  ensureStore();
  const schedule = JSON.parse(fs.readFileSync(SCHEDULE_FILE, "utf8"));
  const defaults = defaultSchedule();

  bookableStaff.forEach((person) => {
    if (!Array.isArray(schedule.weekly?.[person.id])) {
      schedule.weekly = schedule.weekly || {};
      schedule.weekly[person.id] = defaults.weekly[person.id];
    }
  });

  schedule.overrides = schedule.overrides || {};
  return schedule;
}

function writeSchedule(schedule) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  fs.writeFileSync(SCHEDULE_FILE, `${JSON.stringify(schedule, null, 2)}\n`);
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body is too large."));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function getHours(dateString) {
  const day = new Date(`${dateString}T12:00:00`).getDay();

  if (day === 0) {
    return { open: "10:00", close: "17:00" };
  }

  if (day === 6) {
    return { open: "09:00", close: "19:00" };
  }

  return { open: "09:00", close: "19:30" };
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value) {
  const hours = String(Math.floor(value / 60)).padStart(2, "0");
  const minutes = String(value % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function slotsForDate(dateString) {
  const { open, close } = getHours(dateString);
  const start = timeToMinutes(open);
  const end = timeToMinutes(close) - 60;
  const slots = [];

  for (let minutes = start; minutes <= end; minutes += 60) {
    slots.push(minutesToTime(minutes));
  }

  return slots;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function isStaffAvailable(bookings, staffId, date, time, durationMinutes = 60) {
  const worker = bookableStaff.find((person) => person.id === staffId);

  if (!worker || !isStaffWorking(worker, date)) {
    return false;
  }

  const start = timeToMinutes(time);
  const end = start + durationMinutes;

  return !bookings.some((booking) => {
    if (booking.status === "cancelled" || booking.staffId !== staffId || booking.date !== date) {
      return false;
    }

    const bookingStart = timeToMinutes(booking.time);
    const bookingEnd = bookingStart + Number(booking.durationMinutes || 60);
    return overlaps(start, end, bookingStart, bookingEnd);
  });
}

function isStaffWorking(worker, dateString) {
  const schedule = readSchedule();
  return isStaffWorkingFromSchedule(worker, dateString, schedule);
}

function isStaffWorkingFromSchedule(worker, dateString, schedule) {
  const day = new Date(`${dateString}T12:00:00`).getDay();
  const override = schedule.overrides?.[dateString]?.[worker.id];

  if (typeof override === "boolean") {
    return override;
  }

  const weeklyDays = schedule.weekly?.[worker.id] || worker.workDays;
  return weeklyDays.includes(day);
}

function assignStaff(bookings, requestedStaffId, date, time) {
  if (requestedStaffId && requestedStaffId !== "any") {
    return isStaffAvailable(bookings, requestedStaffId, date, time) ? requestedStaffId : null;
  }

  const worker = bookableStaff.find((person) => isStaffAvailable(bookings, person.id, date, time));
  return worker?.id || null;
}

function validateBooking(input) {
  const required = ["firstName", "lastName", "email", "phone", "service", "date", "time"];
  const missing = required.filter((key) => !String(input[key] || "").trim());

  if (missing.length > 0) {
    return `${missing.join(", ")} required.`;
  }

  if (!isValidEmail(input.email)) {
    return "Please enter a valid email address.";
  }

  if (phoneDigits(input.phone).length !== 10) {
    return "Please enter a full 10 digit phone number.";
  }

  if (!slotsForDate(input.date).includes(input.time)) {
    return "That appointment time is outside salon hours.";
  }

  if (input.staffId && input.staffId !== "any" && !bookableStaff.some((person) => person.id === input.staffId)) {
    return "Please choose a valid nail tech.";
  }

  return "";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || "").trim());
}

function phoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatPhoneForSms(value) {
  const digits = phoneDigits(value);
  return digits.length === 10 ? `+1${digits}` : String(value || "").trim();
}

function displayPhone(value) {
  const digits = phoneDigits(value);

  if (digits.length !== 10) {
    return String(value || "").trim();
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

async function notifyCustomer(booking) {
  const formattedDate = displayDate(booking.date);
  const summary = `Dior Nails & Spa appointment confirmed for ${booking.customerName} on ${formattedDate} at ${booking.time} with ${booking.staffName}. Service: ${booking.service}. Questions? Call (862) 258-3070.`;
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; color: #111014; line-height: 1.6;">
      <h1 style="color: #967036;">Your Dior Nails appointment is confirmed</h1>
      <p>Hi ${escapeHtml(booking.customerName)},</p>
      <p>Your appointment has been booked.</p>
      <table style="border-collapse: collapse; margin: 18px 0;">
        <tr><td style="padding: 6px 14px 6px 0;"><strong>Service</strong></td><td>${escapeHtml(booking.service)}</td></tr>
        <tr><td style="padding: 6px 14px 6px 0;"><strong>Nail tech</strong></td><td>${escapeHtml(booking.staffName)}</td></tr>
        <tr><td style="padding: 6px 14px 6px 0;"><strong>Date</strong></td><td>${escapeHtml(formattedDate)}</td></tr>
        <tr><td style="padding: 6px 14px 6px 0;"><strong>Time</strong></td><td>${escapeHtml(booking.time)}</td></tr>
      </table>
      <p>Questions? Call Dior Nails &amp; Spa at <a href="tel:+18622583070">(862) 258-3070</a>.</p>
    </div>
  `;
  const results = [];

  if (process.env.RESEND_API_KEY && process.env.NOTIFICATION_FROM_EMAIL) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.NOTIFICATION_FROM_EMAIL,
        to: booking.email,
        subject: "Your Dior Nails appointment is confirmed",
        text: summary,
        html: emailHtml
      })
    });
    const result = await response.json().catch(() => ({}));
    results.push({
      channel: "email",
      ok: response.ok,
      status: response.status,
      id: result.id,
      reason: result.message || result.error
    });
  } else {
    results.push({ channel: "email", ok: false, reason: "missing_email_provider" });
  }

  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
    const params = new URLSearchParams({
      From: process.env.TWILIO_FROM_NUMBER,
      To: formatPhoneForSms(booking.phone),
      Body: summary
    });
    const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params
    });
    const result = await response.json().catch(() => ({}));
    results.push({
      channel: "sms",
      ok: response.ok,
      status: response.status,
      id: result.sid,
      reason: result.message
    });
  } else {
    results.push({ channel: "sms", ok: false, reason: "missing_sms_provider" });
  }

  return results;
}

async function notifyCancellation(booking, cancelledBy = "the salon") {
  const formattedDate = displayDate(booking.date);
  const summary = `Dior Nails & Spa appointment cancelled for ${booking.customerName} on ${formattedDate} at ${booking.time} with ${booking.staffName}. Service: ${booking.service}. Cancelled by ${cancelledBy}. Questions? Call (862) 258-3070.`;
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; color: #111014; line-height: 1.6;">
      <h1 style="color: #967036;">Your Dior Nails appointment was cancelled</h1>
      <p>Hi ${escapeHtml(booking.customerName)},</p>
      <p>Your appointment has been cancelled.</p>
      <table style="border-collapse: collapse; margin: 18px 0;">
        <tr><td style="padding: 6px 14px 6px 0;"><strong>Service</strong></td><td>${escapeHtml(booking.service)}</td></tr>
        <tr><td style="padding: 6px 14px 6px 0;"><strong>Nail tech</strong></td><td>${escapeHtml(booking.staffName)}</td></tr>
        <tr><td style="padding: 6px 14px 6px 0;"><strong>Date</strong></td><td>${escapeHtml(formattedDate)}</td></tr>
        <tr><td style="padding: 6px 14px 6px 0;"><strong>Time</strong></td><td>${escapeHtml(booking.time)}</td></tr>
      </table>
      <p>Questions? Call Dior Nails &amp; Spa at <a href="tel:+18622583070">(862) 258-3070</a>.</p>
    </div>
  `;
  const results = [];

  if (process.env.RESEND_API_KEY && process.env.NOTIFICATION_FROM_EMAIL) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.NOTIFICATION_FROM_EMAIL,
        to: booking.email,
        subject: "Your Dior Nails appointment was cancelled",
        text: summary,
        html: emailHtml
      })
    });
    const result = await response.json().catch(() => ({}));
    results.push({
      channel: "email",
      ok: response.ok,
      status: response.status,
      id: result.id,
      reason: result.message || result.error
    });
  } else {
    results.push({ channel: "email", ok: false, reason: "missing_email_provider" });
  }

  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
    const params = new URLSearchParams({
      From: process.env.TWILIO_FROM_NUMBER,
      To: formatPhoneForSms(booking.phone),
      Body: summary
    });
    const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params
    });
    const result = await response.json().catch(() => ({}));
    results.push({
      channel: "sms",
      ok: response.ok,
      status: response.status,
      id: result.sid,
      reason: result.message
    });
  } else {
    results.push({ channel: "sms", ok: false, reason: "missing_sms_provider" });
  }

  return results;
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function bookingNameParts(booking) {
  if (booking.firstName || booking.lastName) {
    return {
      firstName: normalizeName(booking.firstName),
      lastName: normalizeName(booking.lastName)
    };
  }

  const parts = String(booking.customerName || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.at(-1) || ""
  };
}

function matchesCustomerIdentity(booking, phone, firstName, lastName) {
  const parts = bookingNameParts(booking);
  return (
    phoneDigits(booking.phone) === phoneDigits(phone) &&
    parts.firstName === normalizeName(firstName) &&
    parts.lastName === normalizeName(lastName)
  );
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function displayDate(value) {
  const date = new Date(`${value}T12:00:00`);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

function requirePortal(req, res) {
  const suppliedPin = req.headers["x-portal-pin"];
  if (suppliedPin !== PORTAL_PIN) {
    sendJson(res, 401, { error: "Portal PIN required." });
    return false;
  }

  return true;
}

async function handleApi(req, res, pathname, searchParams) {
  if (req.method === "GET" && pathname === "/api/config") {
    const schedule = readSchedule();
    const scheduledStaff = staff.map((person) => ({
      ...person,
      workDays: schedule.weekly?.[person.id] || person.workDays || []
    }));
    sendJson(res, 200, { staff: scheduledStaff, services });
    return;
  }

  if (req.method === "GET" && pathname === "/api/schedule") {
    if (!requirePortal(req, res)) {
      return;
    }

    sendJson(res, 200, { staff: bookableStaff, schedule: readSchedule() });
    return;
  }

  if (req.method === "PATCH" && pathname === "/api/schedule") {
    if (!requirePortal(req, res)) {
      return;
    }

    const input = await readJson(req);
    const schedule = readSchedule();

    if (input.weekly && typeof input.weekly === "object") {
      bookableStaff.forEach((person) => {
        if (Array.isArray(input.weekly[person.id])) {
          schedule.weekly[person.id] = input.weekly[person.id]
            .map(Number)
            .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
        }
      });
    }

    if (input.date && input.overrides && typeof input.overrides === "object") {
      schedule.overrides[input.date] = schedule.overrides[input.date] || {};

      bookableStaff.forEach((person) => {
        if (typeof input.overrides[person.id] === "boolean") {
          schedule.overrides[input.date][person.id] = input.overrides[person.id];
        }
      });
    }

    if (input.overrideDates && typeof input.overrideDates === "object") {
      Object.entries(input.overrideDates).forEach(([date, overrides]) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !overrides || typeof overrides !== "object") {
          return;
        }

        schedule.overrides[date] = schedule.overrides[date] || {};

        bookableStaff.forEach((person) => {
          if (typeof overrides[person.id] === "boolean") {
            schedule.overrides[date][person.id] = overrides[person.id];
          }
        });
      });
    }

    writeSchedule(schedule);
    sendJson(res, 200, { schedule });
    return;
  }

  if (req.method === "GET" && pathname === "/api/notification-status") {
    if (!requirePortal(req, res)) {
      return;
    }

    sendJson(res, 200, {
      emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.NOTIFICATION_FROM_EMAIL),
      smsConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER)
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/test-notification") {
    if (!requirePortal(req, res)) {
      return;
    }

    const input = await readJson(req);

    if (!isValidEmail(input.email)) {
      sendJson(res, 400, { error: "Please enter a valid email address." });
      return;
    }

    if (phoneDigits(input.phone).length !== 10) {
      sendJson(res, 400, { error: "Please enter a full 10 digit phone number." });
      return;
    }

    const testBooking = {
      customerName: String(input.customerName || "Test Customer").trim(),
      email: String(input.email).trim().toLowerCase(),
      phone: displayPhone(input.phone),
      service: "Test Appointment",
      staffName: "Kevin",
      date: new Date().toISOString().slice(0, 10),
      time: "09:00"
    };

    const notifications = await notifyCustomer(testBooking).catch((error) => [
      { channel: "notification", ok: false, reason: error.message }
    ]);

    sendJson(res, 200, { notifications });
    return;
  }

  if (req.method === "GET" && pathname === "/api/availability") {
    const date = searchParams.get("date");
    const staffId = searchParams.get("staffId") || "any";

    if (!date) {
      sendJson(res, 400, { error: "Date required." });
      return;
    }

    const bookings = readBookings();
    const schedule = readSchedule();
    const slots = slotsForDate(date).map((time) => {
      const workingStaff = bookableStaff.filter((person) => isStaffWorkingFromSchedule(person, date, schedule));
      const availableStaff = workingStaff.filter((person) => isStaffAvailable(bookings, person.id, date, time));
      const selectedStaff = bookableStaff.find((person) => person.id === staffId);
      const available = selectedStaff
        ? isStaffAvailable(bookings, selectedStaff.id, date, time)
        : availableStaff.length > 0;

      return {
        time,
        available,
        staffId,
        availableStaffIds: availableStaff.map((person) => person.id)
      };
    });

    sendJson(res, 200, { date, slots });
    return;
  }

  if (req.method === "POST" && pathname === "/api/bookings") {
    try {
      const input = await readJson(req);
      const validationError = validateBooking(input);

      if (validationError) {
        sendJson(res, 400, { error: validationError });
        return;
      }

      const bookings = readBookings();
      const staffId = assignStaff(bookings, input.staffId || "any", input.date, input.time);

      if (!staffId) {
        sendJson(res, 409, { error: "That time is no longer available. Please choose another time." });
        return;
      }

      const staffName = bookableStaff.find((person) => person.id === staffId).name;
      const firstName = String(input.firstName).trim();
      const lastName = String(input.lastName).trim();
      const booking = {
        id: `apt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        firstName,
        lastName,
        customerName: `${firstName} ${lastName}`.trim(),
        email: String(input.email).trim().toLowerCase(),
        phone: displayPhone(input.phone),
        service: String(input.service).trim(),
        staffId,
        staffName,
        date: input.date,
        time: input.time,
        durationMinutes: 60,
        notes: String(input.notes || "").trim(),
        status: "confirmed",
        createdAt: new Date().toISOString(),
        notifications: []
      };

      booking.notifications = await notifyCustomer(booking).catch((error) => [
        { channel: "notification", ok: false, reason: error.message }
      ]);

      bookings.push(booking);
      writeBookings(bookings);
      sendJson(res, 201, { booking });
    } catch (error) {
      sendJson(res, 400, { error: "Unable to create booking." });
    }
    return;
  }

  if (req.method === "GET" && pathname === "/api/customer-bookings") {
    const phone = searchParams.get("phone") || "";
    const firstName = searchParams.get("firstName") || "";
    const lastName = searchParams.get("lastName") || "";
    const digits = phoneDigits(phone);

    if (digits.length !== 10) {
      sendJson(res, 400, { error: "Please enter a full 10 digit phone number." });
      return;
    }

    if (!normalizeName(firstName) || !normalizeName(lastName)) {
      sendJson(res, 400, { error: "Please enter the first and last name used for booking." });
      return;
    }

    const bookings = readBookings()
      .filter((booking) => matchesCustomerIdentity(booking, phone, firstName, lastName) && booking.status !== "cancelled")
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

    sendJson(res, 200, { bookings });
    return;
  }

  if (req.method === "PATCH" && pathname.startsWith("/api/customer-bookings/") && pathname.endsWith("/cancel")) {
    const id = pathname.split("/").at(-2);
    const input = await readJson(req);
    const digits = phoneDigits(input.phone);
    const firstName = input.firstName || "";
    const lastName = input.lastName || "";

    if (digits.length !== 10) {
      sendJson(res, 400, { error: "Please enter a full 10 digit phone number." });
      return;
    }

    if (!normalizeName(firstName) || !normalizeName(lastName)) {
      sendJson(res, 400, { error: "Please enter the first and last name used for booking." });
      return;
    }

    const bookings = readBookings();
    const index = bookings.findIndex((booking) => booking.id === id && matchesCustomerIdentity(booking, input.phone, firstName, lastName));

    if (index === -1 || bookings[index].status === "cancelled") {
      sendJson(res, 404, { error: "No active appointment found for that name and phone number." });
      return;
    }

    const cancellationNotifications = await notifyCancellation(bookings[index], "customer").catch((error) => [
      { channel: "notification", ok: false, reason: error.message }
    ]);

    bookings[index] = {
      ...bookings[index],
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
      cancelledBy: "customer",
      cancellationNotifications
    };
    writeBookings(bookings);
    sendJson(res, 200, { booking: bookings[index] });
    return;
  }

  if (req.method === "GET" && pathname === "/api/bookings") {
    if (!requirePortal(req, res)) {
      return;
    }

    const bookings = readBookings();
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const staffId = searchParams.get("staffId");
    const filtered = bookings.filter((booking) => {
      if (from && booking.date < from) return false;
      if (to && booking.date > to) return false;
      if (staffId && staffId !== "all" && booking.staffId !== staffId) return false;
      return booking.status !== "cancelled";
    });

    sendJson(res, 200, { bookings: filtered });
    return;
  }

  if (req.method === "PATCH" && pathname.startsWith("/api/bookings/") && pathname.endsWith("/cancel")) {
    if (!requirePortal(req, res)) {
      return;
    }

    const id = pathname.split("/").at(-2);
    const bookings = readBookings();
    const index = bookings.findIndex((booking) => booking.id === id);

    if (index === -1 || bookings[index].status === "cancelled") {
      sendJson(res, 404, { error: "Active booking not found." });
      return;
    }

    const cancellationNotifications = await notifyCancellation(bookings[index], "salon staff").catch((error) => [
      { channel: "notification", ok: false, reason: error.message }
    ]);

    bookings[index] = {
      ...bookings[index],
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
      cancelledBy: "staff",
      cancellationNotifications
    };
    writeBookings(bookings);
    sendJson(res, 200, { booking: bookings[index] });
    return;
  }

  if (req.method === "PATCH" && pathname.startsWith("/api/bookings/")) {
    if (!requirePortal(req, res)) {
      return;
    }

    const id = pathname.split("/").pop();
    const input = await readJson(req);
    const bookings = readBookings();
    const index = bookings.findIndex((booking) => booking.id === id);

    if (index === -1) {
      sendJson(res, 404, { error: "Booking not found." });
      return;
    }

    bookings[index] = { ...bookings[index], ...input, updatedAt: new Date().toISOString() };
    writeBookings(bookings);
    sendJson(res, 200, { booking: bookings[index] });
    return;
  }

  sendJson(res, 404, { error: "Not found." });
}

function serveStatic(res, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestedPath));

  if (!filePath.startsWith(PUBLIC_DIR) || filePath.includes(`${path.sep}data${path.sep}`) || path.basename(filePath).startsWith(".")) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream"
    });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url.pathname, url.searchParams).catch((error) => {
      sendJson(res, 500, { error: error.message || "Server error." });
    });
    return;
  }

  serveStatic(res, decodeURIComponent(url.pathname));
});

server.listen(PORT, () => {
  ensureStore();
  console.log(`Dior Nails booking system running at http://localhost:${PORT}`);
});
