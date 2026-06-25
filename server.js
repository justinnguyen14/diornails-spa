const http = require("http");
const fs = require("fs");
const path = require("path");
const { URLSearchParams } = require("url");

const PORT = Number(process.env.PORT || 3000);
const PORTAL_PIN = process.env.SALON_PORTAL_PIN || "3070";
const SALON_TIME_ZONE = "America/New_York";
const DATA_DIR = path.join(__dirname, "data");
const BOOKINGS_FILE = path.join(DATA_DIR, "bookings.json");
const SCHEDULE_FILE = path.join(DATA_DIR, "schedule.json");
const CUSTOMERS_FILE = path.join(DATA_DIR, "customers.json");
const PUBLIC_DIR = __dirname;

loadEnvFile();

const defaultNailTechs = "Kevin,Rumi,Kvita,Ana,Khrystyna,Marta,Oksana,Sandra";
const nailTechs = parseNailTechs(process.env.NAIL_TECHS || defaultNailTechs);

const staff = [
  { id: "any", name: "Any available tech" },
  ...nailTechs
];

const bookableStaff = nailTechs;

const serviceGroups = [
  {
    name: "Manicure",
    services: [
      "Manicure Gel",
      "Manicure Regular",
      "Manicure Gel and Pedicure Gel",
      "Pedicure and Manicure and Regular",
      "Manicure Gel and Pedicure Regular"
    ]
  },
  {
    name: "Pedicure",
    services: [
      "Pedicure Regular",
      "Pedicure with Gel Color",
      "Spa Pedicure with Gel Color",
      "Spa Pedicure Volcano"
    ]
  },
  {
    name: "Nail Services",
    services: [
      "Acrylic/Hard Gel Nail Removal + Manicure Gel Color",
      "Full Set Gel",
      "Crystal Gel Full Set Pink & White",
      "Full Set Pink & White Acrylic",
      "Full Set Acrylic Solar",
      "Full Set Acrylic French",
      "Fill in Pink & White Gel",
      "Fill In Gel French",
      "Fill in Gel Pink Only",
      "Fill In Gel & Gel Colors",
      "Fill in Acrylic",
      "Acrylic Fill Pink & White",
      "Polish Change Nail Color",
      "Polish Change Toe Nails Regular",
      "Polish Change Nail Gel Color",
      "Polish Change Toe Gel Color",
      "Nail Repair and Up",
      "Nails Removal",
      "Nails Cut and Up",
      "French",
      "Callus Removal",
      "Airbrush Brush & Up"
    ]
  },
  {
    name: "Waxing",
    services: [
      "Eyebrow Wax",
      "Lip Wax",
      "Chin Wax",
      "Face Side Wax",
      "Full Face",
      "Half Arm",
      "Full Arm",
      "Under Arm",
      "Stomach Line",
      "Full Stomach",
      "Half Leg",
      "Full Leg",
      "Bikini",
      "Bikini & Thigh",
      "Chest & Up",
      "Back & Up",
      "Shoulder & Up",
      "Neck & Up"
    ]
  }
];

const services = serviceGroups.flatMap((group) => group.services);
const waxingServices = serviceGroups.find((group) => group.name === "Waxing")?.services || [];
const serviceDurations = Object.fromEntries([
  ["Manicure Gel", 45],
  ["Manicure Regular", 35],
  ["Pedicure Regular", 45],
  ["Spa Pedicure with Gel Color", 75],
  ["Pedicure and Manicure and Regular", 75],
  ["Manicure Gel and Pedicure Regular", 70],
  ["Pedicure with Gel Color", 55],
  ["Spa Pedicure Volcano", 75],
  ["Manicure Gel and Pedicure Gel", 75],
  ["Acrylic/Hard Gel Nail Removal + Manicure Gel Color", 60],
  ["Crystal Gel Full Set Pink & White", 60],
  ["Full Set Acrylic Solar", 60],
  ["Fill in Gel Pink Only", 60],
  ["Fill in Acrylic", 60],
  ["Full Set Acrylic French", 60],
  ["Full Set Gel", 60],
  ["Full Set Pink & White Acrylic", 60],
  ["Fill in Pink & White Gel", 60],
  ["Fill In Gel & Gel Colors", 60],
  ["Fill In Gel French", 60],
  ["Acrylic Fill Pink & White", 60],
  ["Polish Change Nail Color", 30],
  ["Polish Change Nail Gel Color", 30],
  ["Nail Repair and Up", 5],
  ["Nails Cut and Up", 5],
  ["Callus Removal", 5],
  ["Polish Change Toe Nails Regular", 30],
  ["Polish Change Toe Gel Color", 30],
  ["Nails Removal", 15],
  ["French", 5],
  ["Airbrush Brush & Up", 5],
  ...waxingServices.map((service) => [service, 15])
]);

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

  if (!fs.existsSync(CUSTOMERS_FILE)) {
    fs.writeFileSync(CUSTOMERS_FILE, "[]\n");
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

function readCustomers() {
  ensureStore();
  return JSON.parse(fs.readFileSync(CUSTOMERS_FILE, "utf8"));
}

function writeCustomers(customers) {
  ensureStore();
  fs.writeFileSync(CUSTOMERS_FILE, `${JSON.stringify(customers, null, 2)}\n`);
}

function upsertCustomer(input) {
  const firstName = String(input.firstName || "").trim();
  const lastName = String(input.lastName || "").trim();
  const phone = displayPhone(input.phone);
  const digits = phoneDigits(phone);

  if (!firstName || !lastName || digits.length !== 10) {
    return null;
  }

  const customers = readCustomers();
  const index = customers.findIndex((customer) => (
    phoneDigits(customer.phone) === digits &&
    normalizeName(customer.firstName) === normalizeName(firstName) &&
    normalizeName(customer.lastName) === normalizeName(lastName)
  ));
  const existing = index >= 0 ? customers[index] : {};
  const customer = {
    id: existing.id || `cus_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    firstName,
    lastName,
    customerName: `${firstName} ${lastName}`.trim(),
    phone,
    email: String(input.email || existing.email || "").trim().toLowerCase(),
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (index >= 0) {
    customers[index] = customer;
  } else {
    customers.push(customer);
  }

  writeCustomers(customers);
  return customer;
}

function syncCustomersFromBookings() {
  const bookings = readBookings();
  const customers = readCustomers();
  let changed = false;

  bookings.forEach((booking) => {
    const digits = phoneDigits(booking.phone);
    const parts = bookingNameParts(booking);

    if (!parts.firstName || !parts.lastName || digits.length !== 10) {
      return;
    }

    const index = customers.findIndex((customer) => (
      phoneDigits(customer.phone) === digits &&
      normalizeName(customer.firstName) === parts.firstName &&
      normalizeName(customer.lastName) === parts.lastName
    ));

    if (index >= 0) {
      return;
    }

    customers.push({
      id: `cus_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      firstName: booking.firstName || String(booking.customerName || "").trim().split(/\s+/)[0],
      lastName: booking.lastName || String(booking.customerName || "").trim().split(/\s+/).at(-1),
      customerName: booking.customerName,
      phone: displayPhone(booking.phone),
      email: String(booking.email || "").trim().toLowerCase(),
      createdAt: booking.createdAt || new Date().toISOString(),
      updatedAt: booking.updatedAt || booking.createdAt || new Date().toISOString()
    });
    changed = true;
  });

  if (changed) {
    writeCustomers(customers);
  }
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

function scheduleDay(dateString) {
  return new Date(`${dateString}T12:00:00`).getDay();
}

function weeklyScheduleFor(schedule, person) {
  return schedule.weekly?.[person.id] || person.workDays || [];
}

function isWeeklyStaffWorking(schedule, person, dateString) {
  return weeklyScheduleFor(schedule, person).includes(scheduleDay(dateString));
}

function setScheduleOverride(schedule, dateString, staffId, isWorking, explicitOverrideKeys) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return;
  }

  const person = bookableStaff.find((worker) => worker.id === staffId);

  if (!person || typeof isWorking !== "boolean") {
    return;
  }

  const weeklyValue = isWeeklyStaffWorking(schedule, person, dateString);
  schedule.overrides[dateString] = schedule.overrides[dateString] || {};
  explicitOverrideKeys.add(`${dateString}:${staffId}`);

  if (isWorking === weeklyValue) {
    delete schedule.overrides[dateString][staffId];
  } else {
    schedule.overrides[dateString][staffId] = isWorking;
  }

  if (Object.keys(schedule.overrides[dateString]).length === 0) {
    delete schedule.overrides[dateString];
  }
}

function pruneScheduleOverrides(schedule, changedWeeklyDaysByStaff = {}, explicitOverrideKeys = new Set()) {
  Object.entries(schedule.overrides || {}).forEach(([dateString, overrides]) => {
    if (!overrides || typeof overrides !== "object") {
      delete schedule.overrides[dateString];
      return;
    }

    const day = scheduleDay(dateString);

    bookableStaff.forEach((person) => {
      const overrideKey = `${dateString}:${person.id}`;
      const changedDays = changedWeeklyDaysByStaff[person.id] || new Set();
      const weeklyValue = isWeeklyStaffWorking(schedule, person, dateString);

      if (
        typeof overrides[person.id] !== "boolean" ||
        overrides[person.id] === weeklyValue ||
        (changedDays.has(day) && !explicitOverrideKeys.has(overrideKey))
      ) {
        delete overrides[person.id];
      }
    });

    if (Object.keys(overrides).length === 0) {
      delete schedule.overrides[dateString];
    }
  });
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

function displayTime(value) {
  const [hours, minutes] = value.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function addMinutes(value, minutesToAdd) {
  return minutesToTime(timeToMinutes(value) + minutesToAdd);
}

function appointmentTimeRange(booking) {
  const durationMinutes = Number(booking.durationMinutes || durationForService(booking.service));
  return `${displayTime(booking.time)} - ${displayTime(addMinutes(booking.time, durationMinutes))}`;
}

function normalizeServiceName(value) {
  return String(value || "").trim().toLowerCase();
}

function canonicalServiceName(value) {
  const normalized = normalizeServiceName(value);
  return services.find((service) => normalizeServiceName(service) === normalized) || "";
}

function durationForService(value) {
  const service = canonicalServiceName(value);
  return service ? serviceDurations[service] : 60;
}

function salonDateParts() {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: SALON_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
}

function localTodayIso() {
  const parts = salonDateParts();
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function currentMinutes() {
  const parts = salonDateParts();
  return Number(parts.hour) * 60 + Number(parts.minute);
}

function isPastSlot(dateString, time) {
  return dateString === localTodayIso() && timeToMinutes(time) <= currentMinutes();
}

function isPastDate(dateString) {
  return dateString < localTodayIso();
}

function slotsForDate(dateString, durationMinutes = 60) {
  const { open, close } = getHours(dateString);
  const start = timeToMinutes(open);
  const end = timeToMinutes(close) - durationMinutes;
  const slots = [];

  for (let minutes = start; minutes <= end; minutes += 15) {
    slots.push(minutesToTime(minutes));
  }

  return slots;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function isStaffAvailable(bookings, staffId, date, time, durationMinutes = 60) {
  const worker = bookableStaff.find((person) => person.id === staffId);

  if (isPastDate(date) || isPastSlot(date, time)) {
    return false;
  }

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

function isStaffAvailableForBooking(bookings, bookingId, staffId, date, time, durationMinutes) {
  return isStaffAvailable(
    bookings.filter((booking) => booking.id !== bookingId),
    staffId,
    date,
    time,
    durationMinutes
  );
}

function isStaffWorking(worker, dateString) {
  const schedule = readSchedule();
  return isStaffWorkingFromSchedule(worker, dateString, schedule);
}

function isStaffWorkingFromSchedule(worker, dateString, schedule) {
  const override = schedule.overrides?.[dateString]?.[worker.id];

  if (typeof override === "boolean") {
    return override;
  }

  return isWeeklyStaffWorking(schedule, worker, dateString);
}

function assignStaff(bookings, requestedStaffId, date, time, durationMinutes) {
  if (requestedStaffId && requestedStaffId !== "any") {
    return isStaffAvailable(bookings, requestedStaffId, date, time, durationMinutes) ? requestedStaffId : null;
  }

  const worker = bookableStaff.find((person) => isStaffAvailable(bookings, person.id, date, time, durationMinutes));
  return worker?.id || null;
}

function validateBooking(input) {
  const required = ["firstName", "lastName", "phone", "service", "date", "time"];
  const missing = required.filter((key) => !String(input[key] || "").trim());

  if (missing.length > 0) {
    return `${missing.join(", ")} required.`;
  }

  if (String(input.email || "").trim() && !isValidEmail(input.email)) {
    return "Please enter a valid email address.";
  }

  if (phoneDigits(input.phone).length !== 10) {
    return "Please enter a full 10 digit phone number.";
  }

  const service = canonicalServiceName(input.service);

  if (!service || !serviceDurations[service]) {
    return "Please choose a valid service.";
  }

  if (isPastDate(input.date)) {
    return "Please choose today or a future date.";
  }

  if (!slotsForDate(input.date, serviceDurations[service]).includes(input.time)) {
    return "That appointment time is outside salon hours.";
  }

  if (isPastSlot(input.date, input.time)) {
    return "That appointment time has already passed. Please choose a later time.";
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
  const timeRange = appointmentTimeRange(booking);
  const summary = `Dior Nails & Spa appointment confirmed for ${booking.customerName} on ${formattedDate} from ${timeRange} with ${booking.staffName}. Service: ${booking.service}. Questions? Call (862) 258-3070.`;
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; color: #111014; line-height: 1.6;">
      <h1 style="color: #967036;">Your Dior Nails appointment is confirmed</h1>
      <p>Hi ${escapeHtml(booking.customerName)},</p>
      <p>Your appointment has been booked.</p>
      <table style="border-collapse: collapse; margin: 18px 0;">
        <tr><td style="padding: 6px 14px 6px 0;"><strong>Service</strong></td><td>${escapeHtml(booking.service)}</td></tr>
        <tr><td style="padding: 6px 14px 6px 0;"><strong>Nail tech</strong></td><td>${escapeHtml(booking.staffName)}</td></tr>
        <tr><td style="padding: 6px 14px 6px 0;"><strong>Date</strong></td><td>${escapeHtml(formattedDate)}</td></tr>
        <tr><td style="padding: 6px 14px 6px 0;"><strong>Time</strong></td><td>${escapeHtml(timeRange)}</td></tr>
        <tr><td style="padding: 6px 14px 6px 0;"><strong>Reserved</strong></td><td>${Number(booking.durationMinutes || durationForService(booking.service))} minutes</td></tr>
      </table>
      <p>Questions? Call Dior Nails &amp; Spa at <a href="tel:+18622583070">(862) 258-3070</a>.</p>
    </div>
  `;
  const results = [];

  if (booking.email && process.env.RESEND_API_KEY && process.env.NOTIFICATION_FROM_EMAIL) {
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
  } else if (!booking.email) {
    results.push({ channel: "email", ok: false, reason: "customer_email_not_provided" });
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
  const timeRange = appointmentTimeRange(booking);
  const summary = `Dior Nails & Spa appointment cancelled for ${booking.customerName} on ${formattedDate} from ${timeRange} with ${booking.staffName}. Service: ${booking.service}. Cancelled by ${cancelledBy}. Questions? Call (862) 258-3070.`;
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; color: #111014; line-height: 1.6;">
      <h1 style="color: #967036;">Your Dior Nails appointment was cancelled</h1>
      <p>Hi ${escapeHtml(booking.customerName)},</p>
      <p>Your appointment has been cancelled.</p>
      <table style="border-collapse: collapse; margin: 18px 0;">
        <tr><td style="padding: 6px 14px 6px 0;"><strong>Service</strong></td><td>${escapeHtml(booking.service)}</td></tr>
        <tr><td style="padding: 6px 14px 6px 0;"><strong>Nail tech</strong></td><td>${escapeHtml(booking.staffName)}</td></tr>
        <tr><td style="padding: 6px 14px 6px 0;"><strong>Date</strong></td><td>${escapeHtml(formattedDate)}</td></tr>
        <tr><td style="padding: 6px 14px 6px 0;"><strong>Time</strong></td><td>${escapeHtml(timeRange)}</td></tr>
        <tr><td style="padding: 6px 14px 6px 0;"><strong>Reserved</strong></td><td>${Number(booking.durationMinutes || durationForService(booking.service))} minutes</td></tr>
      </table>
      <p>Questions? Call Dior Nails &amp; Spa at <a href="tel:+18622583070">(862) 258-3070</a>.</p>
    </div>
  `;
  const results = [];

  if (booking.email && process.env.RESEND_API_KEY && process.env.NOTIFICATION_FROM_EMAIL) {
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
  } else if (!booking.email) {
    results.push({ channel: "email", ok: false, reason: "customer_email_not_provided" });
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

async function createBooking(input, createdBy = "customer") {
  const validationError = validateBooking(input);

  if (validationError) {
    return { statusCode: 400, error: validationError };
  }

  const bookings = readBookings();
  const service = canonicalServiceName(input.service);
  const durationMinutes = durationForService(service);
  const staffId = assignStaff(bookings, input.staffId || "any", input.date, input.time, durationMinutes);

  if (!staffId) {
    return { statusCode: 409, error: "That time is no longer available. Please choose another time." };
  }

  const staffName = bookableStaff.find((person) => person.id === staffId).name;
  const firstName = String(input.firstName).trim();
  const lastName = String(input.lastName).trim();
  const booking = {
    id: `apt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    firstName,
    lastName,
    customerName: `${firstName} ${lastName}`.trim(),
    email: String(input.email || "").trim().toLowerCase(),
    phone: displayPhone(input.phone),
    service,
    staffId,
    staffName,
    date: input.date,
    time: input.time,
    durationMinutes,
    notes: String(input.notes || "").trim(),
    status: "confirmed",
    createdBy,
    createdAt: new Date().toISOString(),
    notifications: []
  };

  booking.notifications = await notifyCustomer(booking).catch((error) => [
    { channel: "notification", ok: false, reason: error.message }
  ]);

  const customer = upsertCustomer(booking);
  booking.customerId = customer?.id || "";
  bookings.push(booking);
  writeBookings(bookings);
  return { statusCode: 201, booking };
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
    sendJson(res, 200, { staff: scheduledStaff, services, serviceGroups, serviceDurations });
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
    const changedWeeklyDaysByStaff = {};
    const explicitOverrideKeys = new Set();

    if (input.weekly && typeof input.weekly === "object") {
      bookableStaff.forEach((person) => {
        if (Array.isArray(input.weekly[person.id])) {
          const previousDays = new Set(weeklyScheduleFor(schedule, person));
          const nextDays = input.weekly[person.id]
            .map(Number)
            .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
          const nextDaySet = new Set(nextDays);

          changedWeeklyDaysByStaff[person.id] = new Set(
            [0, 1, 2, 3, 4, 5, 6].filter((day) => previousDays.has(day) !== nextDaySet.has(day))
          );
          schedule.weekly[person.id] = nextDays;
        }
      });
    }

    if (input.date && input.overrides && typeof input.overrides === "object") {
      bookableStaff.forEach((person) => {
        if (typeof input.overrides[person.id] === "boolean") {
          setScheduleOverride(schedule, input.date, person.id, input.overrides[person.id], explicitOverrideKeys);
        }
      });
    }

    if (input.overrideDates && typeof input.overrideDates === "object") {
      Object.entries(input.overrideDates).forEach(([date, overrides]) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !overrides || typeof overrides !== "object") {
          return;
        }
        bookableStaff.forEach((person) => {
          if (typeof overrides[person.id] === "boolean") {
            setScheduleOverride(schedule, date, person.id, overrides[person.id], explicitOverrideKeys);
          }
        });
      });
    }

    pruneScheduleOverrides(schedule, changedWeeklyDaysByStaff, explicitOverrideKeys);
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
      date: localTodayIso(),
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
    const service = canonicalServiceName(searchParams.get("service") || "");
    const durationMinutes = durationForService(service);

    if (!date) {
      sendJson(res, 400, { error: "Date required." });
      return;
    }

    const bookings = readBookings();
    const schedule = readSchedule();
    const slots = slotsForDate(date, durationMinutes).map((time) => {
      const workingStaff = bookableStaff.filter((person) => isStaffWorkingFromSchedule(person, date, schedule));
      const availableStaff = workingStaff.filter((person) => isStaffAvailable(bookings, person.id, date, time, durationMinutes));
      const selectedStaff = bookableStaff.find((person) => person.id === staffId);
      const available = selectedStaff
        ? isStaffAvailable(bookings, selectedStaff.id, date, time, durationMinutes)
        : availableStaff.length > 0;

      return {
        time,
        available,
        durationMinutes,
        staffId,
        availableStaffIds: availableStaff.map((person) => person.id)
      };
    });

    sendJson(res, 200, { date, service, durationMinutes, slots });
    return;
  }

  if (req.method === "POST" && pathname === "/api/bookings") {
    try {
      const input = await readJson(req);
      const result = await createBooking(input);
      sendJson(res, result.statusCode, result.error ? { error: result.error } : { booking: result.booking });
    } catch (error) {
      sendJson(res, 400, { error: "Unable to create booking." });
    }
    return;
  }

  if (req.method === "GET" && pathname === "/api/customers") {
    if (!requirePortal(req, res)) {
      return;
    }

    const query = String(searchParams.get("q") || "").trim().toLowerCase();
    const queryDigits = phoneDigits(query);
    const customers = readCustomers()
      .filter((customer) => {
        if (!query) return true;
        const name = `${customer.firstName} ${customer.lastName}`.toLowerCase();
        return (
          name.includes(query) ||
          String(customer.firstName || "").toLowerCase().includes(query) ||
          String(customer.lastName || "").toLowerCase().includes(query) ||
          (queryDigits && phoneDigits(customer.phone).includes(queryDigits))
        );
      })
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
      .slice(0, 20);

    sendJson(res, 200, { customers });
    return;
  }

  if (req.method === "POST" && pathname === "/api/staff-bookings") {
    if (!requirePortal(req, res)) {
      return;
    }

    try {
      const input = await readJson(req);
      const result = await createBooking(input, "staff");
      sendJson(res, result.statusCode, result.error ? { error: result.error } : { booking: result.booking });
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

    const nextBooking = { ...bookings[index], ...input };
    const service = canonicalServiceName(nextBooking.service);
    const staffId = nextBooking.staffId;
    const staffName = bookableStaff.find((person) => person.id === staffId)?.name;
    const durationMinutes = durationForService(service);

    if (!service || !serviceDurations[service]) {
      sendJson(res, 400, { error: "Please choose a valid service." });
      return;
    }

    if (!staffName) {
      sendJson(res, 400, { error: "Please choose a valid nail tech." });
      return;
    }

    if (!slotsForDate(nextBooking.date, durationMinutes).includes(nextBooking.time)) {
      sendJson(res, 400, { error: "That appointment time is outside salon hours." });
      return;
    }

    if (!isStaffAvailableForBooking(bookings, nextBooking.id, staffId, nextBooking.date, nextBooking.time, durationMinutes)) {
      sendJson(res, 409, { error: "That nail tech is not available for the selected time." });
      return;
    }

    bookings[index] = {
      ...nextBooking,
      service,
      staffName,
      durationMinutes,
      updatedAt: new Date().toISOString()
    };
    const customer = upsertCustomer(bookings[index]);
    bookings[index].customerId = customer?.id || bookings[index].customerId || "";
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
  syncCustomersFromBookings();
  console.log(`Dior Nails booking system running at http://localhost:${PORT}`);
});
