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
const STAFF_FILE = path.join(DATA_DIR, "staff.json");
const SERVICES_FILE = path.join(DATA_DIR, "services.json");
const CHECKINS_FILE = path.join(DATA_DIR, "checkins.json");
const PUBLIC_DIR = __dirname;

loadEnvFile();

const staffColorPalette = [
  { bg: "#ffe4e6", border: "#fb7185", ink: "#7f1d1d" },
  { bg: "#ffedd5", border: "#fb923c", ink: "#7c2d12" },
  { bg: "#fef9c3", border: "#eab308", ink: "#713f12" },
  { bg: "#dcfce7", border: "#4ade80", ink: "#14532d" },
  { bg: "#dbeafe", border: "#60a5fa", ink: "#1e3a8a" },
  { bg: "#ede9fe", border: "#a78bfa", ink: "#4c1d95" },
  { bg: "#fce7f3", border: "#f472b6", ink: "#831843" },
  { bg: "#cffafe", border: "#22d3ee", ink: "#164e63" },
  { bg: "#fef3c7", border: "#f59e0b", ink: "#78350f" },
  { bg: "#ccfbf1", border: "#2dd4bf", ink: "#134e4a" },
  { bg: "#e0e7ff", border: "#818cf8", ink: "#312e81" },
  { bg: "#fae8ff", border: "#d946ef", ink: "#701a75" }
];
const defaultNailTechs = "Kevin,Rumi,Kvita,Ana,Khrystyna,Marta,Oksana,Sandra";
const initialNailTechs = parseNailTechs(process.env.NAIL_TECHS || defaultNailTechs);
let bookableStaff = readStaffRecords();
let staff = [{ id: "any", name: "Any available tech" }, ...bookableStaff];

const defaultServiceGroups = [
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

const defaultServices = defaultServiceGroups.flatMap((group) => group.services);
const waxingServices = defaultServiceGroups.find((group) => group.name === "Waxing")?.services || [];
const defaultServiceDurations = Object.fromEntries([
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
const defaultServicePrices = {
  "Manicure Gel": 40,
  "Manicure Regular": 25,
  "Manicure Gel and Pedicure Gel": 95,
  "Pedicure and Manicure and Regular": 60,
  "Manicure Gel and Pedicure Regular": 80,
  "Pedicure Regular": 40,
  "Pedicure with Gel Color": 60,
  "Spa Pedicure with Gel Color": 75,
  "Spa Pedicure Volcano": 60,
  "Acrylic/Hard Gel Nail Removal + Manicure Gel Color": 45,
  "Full Set Gel": 65,
  "Crystal Gel Full Set Pink & White": 75,
  "Full Set Pink & White Acrylic": 70,
  "Full Set Acrylic Solar": 60,
  "Full Set Acrylic French": 70,
  "Fill in Pink & White Gel": 55,
  "Fill In Gel French": 65,
  "Fill in Gel Pink Only": 55,
  "Fill In Gel & Gel Colors": 55,
  "Fill in Acrylic": 50,
  "Acrylic Fill Pink & White": 60,
  "Polish Change Nail Color": 20,
  "Polish Change Toe Nails Regular": 20,
  "Polish Change Nail Gel Color": 25,
  "Polish Change Toe Gel Color": 30,
  "Nail Repair and Up": 5,
  "Nails Removal": 20,
  "Nails Cut and Up": 5,
  "French": 10,
  "Callus Removal": 5,
  "Airbrush Brush & Up": 5,
  "Eyebrow Wax": 12,
  "Lip Wax": 8,
  "Chin Wax": 7,
  "Face Side Wax": 14,
  "Full Face": 25,
  "Half Arm": 25,
  "Full Arm": 40,
  "Under Arm": 25,
  "Stomach Line": 10,
  "Full Stomach": 20,
  "Half Leg": 40,
  "Full Leg": 60,
  "Bikini": 25,
  "Bikini & Thigh": 35,
  "Chest & Up": 20,
  "Back & Up": 30,
  "Shoulder & Up": 15,
  "Neck & Up": 8
};
let serviceRecords = readServiceRecords();
let services = [];
let serviceGroups = [];
let serviceDurations = {};
refreshServiceCatalog();

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

function normalizeStaffRecord(record, fallback = {}) {
  const name = String(record.name || fallback.name || "").trim();
  return {
    id: String(record.id || fallback.id || slugify(name)).trim(),
    name,
    phone: displayPhone(record.phone || fallback.phone || ""),
    email: String(record.email || fallback.email || "").trim().toLowerCase(),
    color: record.color || fallback.color || null,
    active: record.active !== false,
    workDays: Array.isArray(record.workDays)
      ? record.workDays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      : fallback.workDays || workDaysForTech(name),
    createdAt: record.createdAt || fallback.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || fallback.updatedAt || new Date().toISOString()
  };
}

function readAllStaffRecords() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(STAFF_FILE)) {
    fs.writeFileSync(
      STAFF_FILE,
      `${JSON.stringify(initialNailTechs.map((person) => normalizeStaffRecord(person)), null, 2)}\n`
    );
  }

  return JSON.parse(fs.readFileSync(STAFF_FILE, "utf8")).map((record, index) => normalizeStaffRecord({
    ...record,
    color: record.color || staffColorPalette[index % staffColorPalette.length]
  }));
}

function readStaffRecords() {
  return readAllStaffRecords().filter((record) => record.active !== false);
}

function writeStaffRecords(records) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  fs.writeFileSync(STAFF_FILE, `${JSON.stringify(records.map((record) => normalizeStaffRecord(record)), null, 2)}\n`);
  bookableStaff = records.filter((record) => record.active !== false).map((record) => normalizeStaffRecord(record));
  staff = [{ id: "any", name: "Any available tech" }, ...bookableStaff];
}

function defaultServiceRecords() {
  return defaultServiceGroups.flatMap((group) => group.services.map((name) => ({
    id: slugify(name),
    name,
    category: group.name,
    price: Number(defaultServicePrices[name] || 0),
    durationMinutes: Number(defaultServiceDurations[name] || 60),
    active: true
  })));
}

function normalizeServiceRecord(record) {
  const name = String(record.name || "").trim();
  return {
    id: String(record.id || slugify(name)).trim(),
    name,
    category: String(record.category || "Nail Services").trim(),
    price: Math.max(0, Number(record.price || 0)),
    durationMinutes: Math.min(120, Math.max(15, Number(record.durationMinutes || 60))),
    active: record.active !== false,
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || new Date().toISOString()
  };
}

function readServiceRecords() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(SERVICES_FILE)) {
    fs.writeFileSync(SERVICES_FILE, `${JSON.stringify(defaultServiceRecords(), null, 2)}\n`);
  }
  return JSON.parse(fs.readFileSync(SERVICES_FILE, "utf8")).map(normalizeServiceRecord);
}

function writeServiceRecords(records) {
  fs.writeFileSync(SERVICES_FILE, `${JSON.stringify(records.map(normalizeServiceRecord), null, 2)}\n`);
  serviceRecords = records.map(normalizeServiceRecord);
  refreshServiceCatalog();
}

function refreshServiceCatalog() {
  const active = serviceRecords.filter((record) => record.active !== false);
  services = active.map((record) => record.name);
  serviceDurations = Object.fromEntries(active.map((record) => [record.name, record.durationMinutes]));
  serviceGroups = [...new Set(active.map((record) => record.category))].map((category) => ({
    name: category,
    services: active.filter((record) => record.category === category).map((record) => record.name)
  }));
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

  if (!fs.existsSync(CHECKINS_FILE)) {
    fs.writeFileSync(CHECKINS_FILE, "[]\n");
  }

  if (!fs.existsSync(STAFF_FILE)) {
    writeStaffRecords(initialNailTechs);
  }

  if (!fs.existsSync(SERVICES_FILE)) {
    writeServiceRecords(defaultServiceRecords());
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

function readCheckins() {
  ensureStore();
  return JSON.parse(fs.readFileSync(CHECKINS_FILE, "utf8"));
}

function writeCheckins(checkins) {
  ensureStore();
  fs.writeFileSync(CHECKINS_FILE, `${JSON.stringify(checkins, null, 2)}\n`);
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
  const hasSmsConsent = Object.prototype.hasOwnProperty.call(input, "smsConsent");
  const smsConsent = hasSmsConsent ? booleanValue(input.smsConsent) : Boolean(existing.smsConsent);
  const customer = {
    id: existing.id || `cus_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    firstName,
    lastName,
    customerName: `${firstName} ${lastName}`.trim(),
    phone,
    email: String(input.email || existing.email || "").trim().toLowerCase(),
    birthday: Object.prototype.hasOwnProperty.call(input, "birthday")
      ? String(input.birthday || "").trim()
      : String(existing.birthday || "").trim(),
    smsConsent,
    smsConsentAt: smsConsent ? existing.smsConsentAt || new Date().toISOString() : "",
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

function customerPublicProfile(customer) {
  return {
    id: customer.id,
    firstName: customer.firstName || "",
    lastName: customer.lastName || "",
    customerName: customer.customerName || `${customer.firstName || ""} ${customer.lastName || ""}`.trim(),
    phone: customer.phone || "",
    email: customer.email || "",
    birthday: customer.birthday || "",
    smsConsent: Boolean(customer.smsConsent),
    checkInCount: Number(customer.checkInCount || 0),
    lastCheckInDate: customer.lastCheckInDate || ""
  };
}

function findCustomersByPhone(phone) {
  const digits = phoneDigits(phone);
  return readCustomers().filter((customer) => phoneDigits(customer.phone) === digits);
}

function todaysAppointmentsForPhone(phone) {
  const today = localTodayIso();
  const digits = phoneDigits(phone);
  return readBookings()
    .filter((booking) => (
      booking.status !== "cancelled" &&
      booking.date === today &&
      phoneDigits(booking.phone) === digits
    ))
    .sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")))
    .map((booking) => ({
      id: booking.id,
      service: booking.service,
      staffName: booking.staffName,
      time: booking.time,
      durationMinutes: booking.durationMinutes || durationForService(booking.service)
    }));
}

function checkinForBooking(booking, checkins = readCheckins()) {
  const digits = phoneDigits(booking.phone);
  return checkins.find((checkin) => (
    checkin.date === booking.date &&
    (
      (booking.customerId && checkin.customerId === booking.customerId) ||
      phoneDigits(checkin.phone) === digits
    )
  ));
}

function bookingWithCheckinStatus(booking, checkins = readCheckins()) {
  const checkin = checkinForBooking(booking, checkins);
  return {
    ...booking,
    checkInStatus: checkin ? "checked-in" : "pending",
    checkInAt: checkin?.createdAt || "",
    checkInId: checkin?.id || ""
  };
}

function checkinCountForCustomer(customerId, phone) {
  const digits = phoneDigits(phone);
  return readCheckins().filter((checkin) => (
    (customerId && checkin.customerId === customerId) ||
    (!customerId && phoneDigits(checkin.phone) === digits)
  )).length;
}

function recordCheckinForCustomer(customer, source = "checkin") {
  const today = localTodayIso();
  const digits = phoneDigits(customer.phone);
  const checkins = readCheckins();
  const existingToday = checkins.find((checkin) => (
    checkin.date === today &&
    (
      (customer.id && checkin.customerId === customer.id) ||
      phoneDigits(checkin.phone) === digits
    )
  ));

  const total = checkinCountForCustomer(customer.id, customer.phone);

  if (existingToday) {
    return {
      alreadyCheckedIn: true,
      checkin: existingToday,
      points: total,
      appointments: todaysAppointmentsForPhone(customer.phone)
    };
  }

  const checkin = {
    id: `chk_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    customerId: customer.id || "",
    customerName: customer.customerName || `${customer.firstName || ""} ${customer.lastName || ""}`.trim(),
    phone: displayPhone(customer.phone),
    date: today,
    pointsAwarded: 1,
    source,
    createdAt: new Date().toISOString()
  };
  checkins.push(checkin);
  writeCheckins(checkins);

  const customers = readCustomers();
  const index = customers.findIndex((record) => record.id === customer.id);
  if (index >= 0) {
    customers[index] = {
      ...customers[index],
      checkInCount: total + 1,
      lastCheckInDate: today,
      updatedAt: new Date().toISOString()
    };
    writeCustomers(customers);
  }

  return {
    alreadyCheckedIn: false,
    checkin,
    points: total + 1,
    appointments: todaysAppointmentsForPhone(customer.phone)
  };
}

function updateCustomerProfile(customerId, input) {
  const customers = readCustomers();
  const index = customers.findIndex((customer) => customer.id === customerId);
  if (index < 0) return null;

  const smsConsent = Object.prototype.hasOwnProperty.call(input, "smsConsent")
    ? booleanValue(input.smsConsent)
    : Boolean(customers[index].smsConsent);

  customers[index] = {
    ...customers[index],
    email: String(input.email || customers[index].email || "").trim().toLowerCase(),
    birthday: Object.prototype.hasOwnProperty.call(input, "birthday")
      ? String(input.birthday || "").trim()
      : String(customers[index].birthday || "").trim(),
    smsConsent,
    smsConsentAt: smsConsent ? customers[index].smsConsentAt || new Date().toISOString() : "",
    updatedAt: new Date().toISOString()
  };
  writeCustomers(customers);
  return customers[index];
}

function findCustomerByIdAndPhone(customerId, phone) {
  const digits = phoneDigits(phone);
  return readCustomers().find((customer) => (
    customer.id === customerId &&
    phoneDigits(customer.phone) === digits
  ));
}

function syncCustomersFromBookings() {
  const bookings = readBookings();
  const customers = readCustomers();
  let changed = false;

  bookings.forEach((booking) => {
    if (booking.status === "cancelled") {
      return;
    }

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
      smsConsent: Boolean(booking.smsConsent),
      smsConsentAt: booking.smsConsentAt || "",
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

function normalizeUnavailableRange(value = {}) {
  const start = String(value.start || "").trim();
  const end = String(value.end || "").trim();

  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
    return null;
  }

  if (timeToMinutes(start) >= timeToMinutes(end)) {
    return null;
  }

  return { start, end };
}

function normalizeScheduleOverrideValue(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  const normalized = {};
  if (typeof value.working === "boolean") {
    normalized.working = value.working;
  }

  const unavailable = normalizeUnavailableRange(value.unavailable || value);
  if (unavailable) {
    normalized.unavailable = unavailable;
  }

  return Object.keys(normalized).length ? normalized : undefined;
}

function scheduleOverrideWorkingValue(override, fallbackWorking) {
  if (typeof override === "boolean") {
    return override;
  }

  if (override && typeof override === "object" && typeof override.working === "boolean") {
    return override.working;
  }

  return fallbackWorking;
}

function scheduleOverrideUnavailable(override) {
  if (!override || typeof override !== "object") {
    return null;
  }

  return normalizeUnavailableRange(override.unavailable || override);
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

function setScheduleDayOverride(schedule, dateString, staffId, value, explicitOverrideKeys) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return;
  }

  const person = bookableStaff.find((worker) => worker.id === staffId);
  const normalized = normalizeScheduleOverrideValue(value);

  if (!person || typeof normalized === "undefined") {
    return;
  }

  const weeklyValue = isWeeklyStaffWorking(schedule, person, dateString);
  const working = scheduleOverrideWorkingValue(normalized, weeklyValue);
  const unavailable = scheduleOverrideUnavailable(normalized);
  schedule.overrides[dateString] = schedule.overrides[dateString] || {};
  explicitOverrideKeys.add(`${dateString}:${staffId}`);

  if (working === weeklyValue && !unavailable) {
    delete schedule.overrides[dateString][staffId];
  } else if (!unavailable && typeof normalized === "boolean") {
    schedule.overrides[dateString][staffId] = working;
  } else {
    schedule.overrides[dateString][staffId] = {
      ...(working !== weeklyValue ? { working } : {}),
      ...(unavailable ? { unavailable } : {})
    };
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
      const normalized = normalizeScheduleOverrideValue(overrides[person.id]);
      const working = scheduleOverrideWorkingValue(normalized, weeklyValue);
      const unavailable = scheduleOverrideUnavailable(normalized);

      if (
        typeof normalized === "undefined" ||
        (working === weeklyValue && !unavailable) ||
        (changedDays.has(day) && !explicitOverrideKeys.has(overrideKey))
      ) {
        delete overrides[person.id];
      } else if (unavailable || typeof normalized === "object") {
        overrides[person.id] = {
          ...(working !== weeklyValue ? { working } : {}),
          ...(unavailable ? { unavailable } : {})
        };
      } else {
        overrides[person.id] = working;
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

function appointmentFitsSalonHours(dateString, time, durationMinutes) {
  const { open, close } = getHours(dateString);
  const start = timeToMinutes(time);
  return start >= timeToMinutes(open) && start + durationMinutes <= timeToMinutes(close);
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function isStaffAvailable(bookings, staffId, date, time, durationMinutes = 60, options = {}) {
  const worker = bookableStaff.find((person) => person.id === staffId);
  const schedule = readSchedule();

  if (isPastDate(date) || (!options.ignorePastSlot && isPastSlot(date, time)) || !appointmentFitsSalonHours(date, time, durationMinutes)) {
    return false;
  }

  if (!worker || !isStaffWorkingFromSchedule(worker, date, schedule)) {
    return false;
  }

  const start = timeToMinutes(time);
  const end = start + durationMinutes;
  const unavailable = staffUnavailableRangeFromSchedule(worker, date, schedule);

  if (unavailable && overlaps(start, end, timeToMinutes(unavailable.start), timeToMinutes(unavailable.end))) {
    return false;
  }

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
  const weeklyValue = isWeeklyStaffWorking(schedule, worker, dateString);

  if (typeof override === "boolean") {
    return override;
  }

  if (override && typeof override === "object" && typeof override.working === "boolean") {
    return override.working;
  }

  return weeklyValue;
}

function staffUnavailableRangeFromSchedule(worker, dateString, schedule) {
  const override = schedule.overrides?.[dateString]?.[worker.id];
  return scheduleOverrideUnavailable(override);
}

function assignStaff(bookings, requestedStaffId, date, time, durationMinutes, options = {}) {
  if (requestedStaffId && requestedStaffId !== "any") {
    return isStaffAvailable(bookings, requestedStaffId, date, time, durationMinutes, options) ? requestedStaffId : null;
  }

  const worker = bookableStaff.find((person) => isStaffAvailable(bookings, person.id, date, time, durationMinutes, options));
  return worker?.id || null;
}

function validateBooking(input, options = {}) {
  const staffMode = Boolean(options.staffMode);
  const bypassConstraints = staffMode && Boolean(options.bypassConstraints);
  const required = ["firstName", "lastName", "phone", "service", "date", "time"];
  const missing = required.filter((key) => !String(input[key] || "").trim());

  if (missing.length > 0) {
    return { error: `${missing.join(", ")} required.` };
  }

  if (String(input.email || "").trim() && !isValidEmail(input.email)) {
    return { error: "Please enter a valid email address." };
  }

  if (phoneDigits(input.phone).length !== 10) {
    return { error: "Please enter a full 10 digit phone number." };
  }

  const service = canonicalServiceName(input.service);

  if (!service || !serviceDurations[service]) {
    return { error: "Please choose a valid service." };
  }

  if (input.staffId && input.staffId !== "any" && !bookableStaff.some((person) => person.id === input.staffId)) {
    return { error: "Please choose a valid nail tech." };
  }

  if (isPastDate(input.date)) {
    return { error: "Please choose today or a future date." };
  }

  if (!appointmentFitsSalonHours(input.date, input.time, serviceDurations[service]) && !bypassConstraints) {
    return {
      error: `That service must finish by the salon closing time of ${displayTime(getHours(input.date).close)}.`,
      bypassable: staffMode && !bypassConstraints
    };
  }

  const { open, close } = getHours(input.date);
  const startMinutes = timeToMinutes(input.time);
  const openMinutes = timeToMinutes(open);
  const closeMinutes = timeToMinutes(close);
  const validStartTime = bypassConstraints
    ? startMinutes >= openMinutes && startMinutes <= closeMinutes && (startMinutes - openMinutes) % 15 === 0
    : slotsForDate(input.date, serviceDurations[service]).includes(input.time);

  if (!validStartTime) {
    return { error: "Please choose a 15-minute appointment start time within salon hours." };
  }

  if (isPastSlot(input.date, input.time)) {
    const minutesPast = currentMinutes() - timeToMinutes(input.time);
    if (!staffMode || (minutesPast > 15 && !bypassConstraints)) {
      return {
        error: "That appointment time has already passed. Please choose a later time.",
        bypassable: staffMode && !bypassConstraints
      };
    }
  }

  return { error: "" };
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || "").trim());
}

function phoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function booleanValue(value) {
  return value === true || value === "true" || value === "on" || value === 1 || value === "1";
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

async function sendEmailNotification(booking, subject, summary, html) {
  if (!booking.email) {
    return { channel: "email", ok: false, reason: "customer_email_not_provided" };
  }

  if (!process.env.RESEND_API_KEY || !process.env.NOTIFICATION_FROM_EMAIL) {
    return { channel: "email", ok: false, reason: "missing_email_provider" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.NOTIFICATION_FROM_EMAIL,
        to: booking.email,
        subject,
        text: summary,
        html
      })
    });
    const result = await response.json().catch(() => ({}));
    return {
      channel: "email",
      ok: response.ok,
      status: response.status,
      id: result.id,
      reason: result.message || result.error
    };
  } catch (error) {
    return { channel: "email", ok: false, reason: error.message || "email_request_failed" };
  }
}

async function sendSmsToPhone(phone, body, channel = "sms") {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM_NUMBER) {
    return { channel, ok: false, reason: "missing_sms_provider" };
  }

  if (phoneDigits(phone).length !== 10) {
    return { channel, ok: false, reason: "invalid_sms_phone" };
  }

  const params = new URLSearchParams({
    From: process.env.TWILIO_FROM_NUMBER,
    To: formatPhoneForSms(phone),
    Body: body
  });

  if (process.env.TWILIO_STATUS_CALLBACK_URL) {
    params.set("StatusCallback", process.env.TWILIO_STATUS_CALLBACK_URL);
  }

  try {
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
    return {
      channel,
      ok: response.ok,
      status: response.status,
      id: result.sid,
      messageStatus: result.status,
      reason: result.message
    };
  } catch (error) {
    return { channel, ok: false, reason: error.message || "sms_request_failed" };
  }
}

async function sendSmsNotification(booking, summary) {
  if (!booking.smsConsent) {
    return { channel: "sms", ok: false, reason: "customer_sms_not_consented" };
  }

  return sendSmsToPhone(booking.phone, `${summary} Reply STOP to opt out.`, "sms");
}

async function notifySelectedStaff(booking, requestedStaffId) {
  if (!requestedStaffId || requestedStaffId === "any") {
    return { channel: "staff_sms", ok: false, reason: "staff_not_specifically_requested" };
  }

  const selectedStaff = bookableStaff.find((person) => person.id === booking.staffId);
  if (!selectedStaff) {
    return { channel: "staff_sms", ok: false, reason: "staff_not_found" };
  }

  if (phoneDigits(selectedStaff.phone).length !== 10) {
    return { channel: "staff_sms", ok: false, reason: "staff_phone_not_provided" };
  }

  const formattedDate = displayDate(booking.date);
  const timeRange = appointmentTimeRange(booking);
  const summary = `Dior Nails staff alert: ${booking.customerName} booked ${booking.service} with you on ${formattedDate} from ${timeRange}. Customer phone: ${booking.phone}.`;
  return sendSmsToPhone(selectedStaff.phone, summary, "staff_sms");
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
  return Promise.all([
    sendEmailNotification(booking, "Your Dior Nails appointment is confirmed", summary, emailHtml),
    sendSmsNotification(booking, summary)
  ]);
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
  return Promise.all([
    sendEmailNotification(booking, "Your Dior Nails appointment was cancelled", summary, emailHtml),
    sendSmsNotification(booking, summary)
  ]);
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
  const staffMode = createdBy === "staff";
  const bypassConstraints = staffMode && booleanValue(input.bypassConstraints);
  const validation = validateBooking(input, { staffMode, bypassConstraints });

  if (validation.error) {
    return {
      statusCode: validation.bypassable ? 409 : 400,
      error: validation.error,
      canBypass: Boolean(validation.bypassable)
    };
  }

  const bookings = readBookings();
  const service = canonicalServiceName(input.service);
  const durationMinutes = durationForService(service);
  const minutesPast = currentMinutes() - timeToMinutes(input.time);
  const staffPastGrace = staffMode && input.date === localTodayIso() && isPastSlot(input.date, input.time) && minutesPast <= 15;
  const staffId = bypassConstraints && input.staffId && input.staffId !== "any"
    ? input.staffId
    : assignStaff(bookings, input.staffId || "any", input.date, input.time, durationMinutes, { ignorePastSlot: staffPastGrace });

  if (!staffId) {
    return {
      statusCode: 409,
      error: "That time is no longer available. Please choose another time.",
      canBypass: staffMode
    };
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
    smsConsent: booleanValue(input.smsConsent),
    smsConsentAt: booleanValue(input.smsConsent) ? new Date().toISOString() : "",
    service,
    staffId,
    staffName,
    date: input.date,
    time: input.time,
    durationMinutes,
    notes: String(input.notes || "").trim(),
    status: "confirmed",
    createdBy,
    bypassedConstraints: bypassConstraints,
    createdAt: new Date().toISOString(),
    notifications: []
  };

  booking.notifications = await notifyCustomer(booking).catch((error) => [
    { channel: "notification", ok: false, reason: error.message }
  ]);
  booking.staffNotifications = [];

  if (input.staffId && input.staffId !== "any") {
    const staffNotification = await notifySelectedStaff(booking, input.staffId).catch((error) => ({
      channel: "staff_sms",
      ok: false,
      reason: error.message
    }));
    booking.staffNotifications.push(staffNotification);
  }

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
    sendJson(res, 200, { staff: scheduledStaff, services, serviceGroups, serviceDurations, serviceRecords: serviceRecords.filter((record) => record.active !== false) });
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
        const override = normalizeScheduleOverrideValue(input.overrides[person.id]);
        if (typeof override !== "undefined") {
          setScheduleDayOverride(schedule, input.date, person.id, override, explicitOverrideKeys);
        }
      });
    }

    if (input.overrideDates && typeof input.overrideDates === "object") {
      Object.entries(input.overrideDates).forEach(([date, overrides]) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !overrides || typeof overrides !== "object") {
          return;
        }
        bookableStaff.forEach((person) => {
          const override = normalizeScheduleOverrideValue(overrides[person.id]);
          if (typeof override !== "undefined") {
            setScheduleDayOverride(schedule, date, person.id, override, explicitOverrideKeys);
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
      time: "09:00",
      smsConsent: true
    };

    const notifications = await notifyCustomer(testBooking).catch((error) => [
      { channel: "notification", ok: false, reason: error.message }
    ]);

    sendJson(res, 200, { notifications });
    return;
  }

  if (req.method === "POST" && pathname === "/api/checkins/lookup") {
    const input = await readJson(req);
    const digits = phoneDigits(input.phone);

    if (digits.length !== 10) {
      sendJson(res, 400, { error: "Please enter a full 10 digit phone number." });
      return;
    }

    const matches = findCustomersByPhone(input.phone);
    const appointments = todaysAppointmentsForPhone(input.phone);

    if (!matches.length) {
      sendJson(res, 200, {
        needsProfile: true,
        phone: displayPhone(input.phone),
        appointments,
        message: "Create a quick profile to finish checking in."
      });
      return;
    }

    const customer = matches[0];

    if (!String(customer.birthday || "").trim()) {
      sendJson(res, 200, {
        needsBirthday: true,
        customer: customerPublicProfile(customer),
        phone: displayPhone(input.phone),
        appointments,
        message: "Add your birthday to receive birthday-week gifts and discounts."
      });
      return;
    }

    const result = recordCheckinForCustomer(customer);
    sendJson(res, 200, {
      needsProfile: false,
      alreadyCheckedIn: result.alreadyCheckedIn,
      customer: customerPublicProfile({
        ...customer,
        checkInCount: result.points,
        lastCheckInDate: localTodayIso()
      }),
      points: result.points,
      appointments: result.appointments,
      message: result.alreadyCheckedIn ? "You are already checked in for today." : "Welcome back!"
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/checkins/birthday") {
    const input = await readJson(req);
    const customerId = String(input.customerId || "").trim();
    const digits = phoneDigits(input.phone);

    if (!customerId || digits.length !== 10) {
      sendJson(res, 400, { error: "Customer and phone number are required." });
      return;
    }

    let customer = findCustomerByIdAndPhone(customerId, input.phone);

    if (!customer) {
      sendJson(res, 404, { error: "Customer not found." });
      return;
    }

    const birthday = String(input.birthday || "").trim();
    if (!booleanValue(input.skipBirthday) && !birthday) {
      sendJson(res, 400, { error: "Please add a birthday or choose skip for now." });
      return;
    }

    if (birthday) {
      customer = updateCustomerProfile(customer.id, { birthday }) || customer;
    }

    const result = recordCheckinForCustomer(customer, birthday ? "birthday-updated" : "birthday-skipped");
    sendJson(res, 200, {
      needsProfile: false,
      needsBirthday: false,
      alreadyCheckedIn: result.alreadyCheckedIn,
      customer: customerPublicProfile({
        ...customer,
        checkInCount: result.points,
        lastCheckInDate: localTodayIso()
      }),
      points: result.points,
      appointments: result.appointments,
      message: result.alreadyCheckedIn ? "You are already checked in for today." : "Welcome back!"
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/checkins/profile") {
    const input = await readJson(req);
    const firstName = String(input.firstName || "").trim();
    const lastName = String(input.lastName || "").trim();
    const digits = phoneDigits(input.phone);

    if (!firstName || !lastName || digits.length !== 10) {
      sendJson(res, 400, { error: "First name, last name, and a full 10 digit phone number are required." });
      return;
    }

    if (String(input.email || "").trim() && !isValidEmail(input.email)) {
      sendJson(res, 400, { error: "Please enter a valid email address." });
      return;
    }

    if (!booleanValue(input.profileConsent)) {
      sendJson(res, 400, { error: "Please agree to save your customer profile before checking in." });
      return;
    }

    let customer = upsertCustomer({
      firstName,
      lastName,
      phone: input.phone,
      email: input.email,
      smsConsent: input.smsConsent
    });

    if (!customer) {
      sendJson(res, 400, { error: "Unable to save this customer profile." });
      return;
    }

    customer = updateCustomerProfile(customer.id, {
      email: input.email,
      birthday: input.birthday,
      smsConsent: input.smsConsent
    }) || customer;

    const result = recordCheckinForCustomer(customer, "new-profile");
    sendJson(res, 201, {
      needsProfile: false,
      alreadyCheckedIn: result.alreadyCheckedIn,
      customer: customerPublicProfile({
        ...customer,
        checkInCount: result.points,
        lastCheckInDate: localTodayIso()
      }),
      points: result.points,
      appointments: result.appointments,
      message: result.alreadyCheckedIn ? "Your profile is saved and you are already checked in today." : "Thank you for joining us and welcome!"
    });
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
      .slice(0, query ? 20 : 200);

    sendJson(res, 200, { customers });
    return;
  }

  if (req.method === "POST" && pathname === "/api/customers") {
    if (!requirePortal(req, res)) {
      return;
    }

    const input = await readJson(req);
    const firstName = String(input.firstName || "").trim();
    const lastName = String(input.lastName || "").trim();

    if (!firstName || !lastName || phoneDigits(input.phone).length !== 10) {
      sendJson(res, 400, { error: "First name, last name, and a full 10 digit phone number are required." });
      return;
    }

    if (String(input.email || "").trim() && !isValidEmail(input.email)) {
      sendJson(res, 400, { error: "Please enter a valid email address." });
      return;
    }

    const customers = readCustomers();
    const customer = {
      id: `cus_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      firstName,
      lastName,
      customerName: `${firstName} ${lastName}`,
      phone: displayPhone(input.phone),
      email: String(input.email || "").trim().toLowerCase(),
      birthday: String(input.birthday || "").trim(),
      smsConsent: booleanValue(input.smsConsent),
      smsConsentAt: booleanValue(input.smsConsent) ? new Date().toISOString() : "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    customers.push(customer);
    writeCustomers(customers);
    sendJson(res, 201, { customer });
    return;
  }

  if (req.method === "PATCH" && pathname.startsWith("/api/customers/")) {
    if (!requirePortal(req, res)) {
      return;
    }

    const customerId = decodeURIComponent(pathname.slice("/api/customers/".length));
    const input = await readJson(req);
    const customers = readCustomers();
    const index = customers.findIndex((customer) => customer.id === customerId);

    if (index < 0) {
      sendJson(res, 404, { error: "Customer not found." });
      return;
    }

    const firstName = String(input.firstName || "").trim();
    const lastName = String(input.lastName || "").trim();
    if (!firstName || !lastName || phoneDigits(input.phone).length !== 10) {
      sendJson(res, 400, { error: "First name, last name, and a full 10 digit phone number are required." });
      return;
    }
    if (String(input.email || "").trim() && !isValidEmail(input.email)) {
      sendJson(res, 400, { error: "Please enter a valid email address." });
      return;
    }

    const smsConsent = booleanValue(input.smsConsent);
    customers[index] = {
      ...customers[index],
      firstName,
      lastName,
      customerName: `${firstName} ${lastName}`,
      phone: displayPhone(input.phone),
      email: String(input.email || "").trim().toLowerCase(),
      birthday: String(input.birthday || customers[index].birthday || "").trim(),
      smsConsent,
      smsConsentAt: smsConsent ? customers[index].smsConsentAt || new Date().toISOString() : "",
      updatedAt: new Date().toISOString()
    };
    writeCustomers(customers);
    sendJson(res, 200, { customer: customers[index] });
    return;
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/customers/")) {
    if (!requirePortal(req, res)) {
      return;
    }

    const customerId = decodeURIComponent(pathname.slice("/api/customers/".length));
    const customers = readCustomers();
    const nextCustomers = customers.filter((customer) => customer.id !== customerId);
    if (nextCustomers.length === customers.length) {
      sendJson(res, 404, { error: "Customer not found." });
      return;
    }

    writeCustomers(nextCustomers);
    sendJson(res, 200, { removed: true });
    return;
  }

  if (req.method === "GET" && pathname === "/api/staff-records") {
    if (!requirePortal(req, res)) {
      return;
    }

    const schedule = readSchedule();
    const records = readAllStaffRecords().map((person) => ({
      ...person,
      workDays: schedule.weekly?.[person.id] || []
    }));
    sendJson(res, 200, { staff: records });
    return;
  }

  if (req.method === "POST" && pathname === "/api/staff-records") {
    if (!requirePortal(req, res)) {
      return;
    }

    const input = await readJson(req);
    const name = String(input.name || "").trim();
    if (!name) {
      sendJson(res, 400, { error: "Employee name is required." });
      return;
    }
    if (String(input.phone || "").trim() && phoneDigits(input.phone).length !== 10) {
      sendJson(res, 400, { error: "Enter a full 10 digit phone number or leave it blank." });
      return;
    }
    if (String(input.email || "").trim() && !isValidEmail(input.email)) {
      sendJson(res, 400, { error: "Please enter a valid email address." });
      return;
    }

    const records = readAllStaffRecords();
    let id = slugify(name) || `worker-${Date.now()}`;
    if (records.some((person) => person.id === id)) {
      id = `${id}-${Date.now()}`;
    }
    const employee = normalizeStaffRecord({
      id,
      name,
      phone: input.phone,
      email: input.email,
      color: staffColorPalette[records.length % staffColorPalette.length],
      active: input.active !== false,
      workDays: []
    });
    records.push(employee);
    writeStaffRecords(records);
    const schedule = readSchedule();
    schedule.weekly[employee.id] = employee.workDays;
    writeSchedule(schedule);
    sendJson(res, 201, { employee });
    return;
  }

  if (req.method === "PATCH" && pathname.startsWith("/api/staff-records/")) {
    if (!requirePortal(req, res)) {
      return;
    }

    const staffId = decodeURIComponent(pathname.slice("/api/staff-records/".length));
    const input = await readJson(req);
    const records = readAllStaffRecords();
    const index = records.findIndex((person) => person.id === staffId);
    if (index < 0) {
      sendJson(res, 404, { error: "Employee not found." });
      return;
    }
    const name = String(input.name || "").trim();
    if (!name) {
      sendJson(res, 400, { error: "Employee name is required." });
      return;
    }
    if (String(input.phone || "").trim() && phoneDigits(input.phone).length !== 10) {
      sendJson(res, 400, { error: "Enter a full 10 digit phone number or leave it blank." });
      return;
    }
    if (String(input.email || "").trim() && !isValidEmail(input.email)) {
      sendJson(res, 400, { error: "Please enter a valid email address." });
      return;
    }

    records[index] = normalizeStaffRecord({
      ...records[index],
      name,
      phone: input.phone,
      email: input.email,
      active: input.active !== false,
      updatedAt: new Date().toISOString()
    });
    writeStaffRecords(records);
    sendJson(res, 200, { employee: records[index] });
    return;
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/staff-records/")) {
    if (!requirePortal(req, res)) {
      return;
    }

    const staffId = decodeURIComponent(pathname.slice("/api/staff-records/".length));
    const records = readAllStaffRecords();
    const index = records.findIndex((person) => person.id === staffId);
    if (index < 0) {
      sendJson(res, 404, { error: "Employee not found." });
      return;
    }

    const removedEmployee = records[index];
    records.splice(index, 1);
    writeStaffRecords(records);
    const schedule = readSchedule();
    delete schedule.weekly[staffId];
    Object.keys(schedule.overrides || {}).forEach((date) => {
      delete schedule.overrides[date]?.[staffId];
      if (schedule.overrides[date] && Object.keys(schedule.overrides[date]).length === 0) {
        delete schedule.overrides[date];
      }
    });
    writeSchedule(schedule);
    sendJson(res, 200, { employee: removedEmployee, removed: true });
    return;
  }

  if (req.method === "GET" && pathname === "/api/services") {
    if (!requirePortal(req, res)) {
      return;
    }
    sendJson(res, 200, { services: readServiceRecords() });
    return;
  }

  if (req.method === "POST" && pathname === "/api/services") {
    if (!requirePortal(req, res)) {
      return;
    }
    const input = await readJson(req);
    const name = String(input.name || "").trim();
    const durationMinutes = Number(input.durationMinutes);
    const price = Number(input.price);
    if (!name || !String(input.category || "").trim()) {
      sendJson(res, 400, { error: "Service name and category are required." });
      return;
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 120 || durationMinutes % 15 !== 0) {
      sendJson(res, 400, { error: "Service time must be between 15 and 120 minutes in 15 minute intervals." });
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      sendJson(res, 400, { error: "Enter a valid service price." });
      return;
    }
    const records = readServiceRecords();
    if (records.some((record) => normalizeServiceName(record.name) === normalizeServiceName(name))) {
      sendJson(res, 409, { error: "A service with that name already exists." });
      return;
    }
    let id = slugify(name) || `service-${Date.now()}`;
    if (records.some((record) => record.id === id)) id = `${id}-${Date.now()}`;
    const service = normalizeServiceRecord({
      id,
      name,
      category: input.category,
      price,
      durationMinutes,
      active: true
    });
    records.push(service);
    writeServiceRecords(records);
    sendJson(res, 201, { service });
    return;
  }

  if (req.method === "PATCH" && pathname.startsWith("/api/services/")) {
    if (!requirePortal(req, res)) {
      return;
    }
    const serviceId = decodeURIComponent(pathname.slice("/api/services/".length));
    const input = await readJson(req);
    const records = readServiceRecords();
    const index = records.findIndex((record) => record.id === serviceId);
    if (index < 0) {
      sendJson(res, 404, { error: "Service not found." });
      return;
    }
    const durationMinutes = Number(input.durationMinutes);
    const price = Number(input.price);
    if (!String(input.name || "").trim() || !String(input.category || "").trim()) {
      sendJson(res, 400, { error: "Service name and category are required." });
      return;
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 120 || durationMinutes % 15 !== 0) {
      sendJson(res, 400, { error: "Service time must be between 15 and 120 minutes in 15 minute intervals." });
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      sendJson(res, 400, { error: "Enter a valid service price." });
      return;
    }
    records[index] = normalizeServiceRecord({
      ...records[index],
      name: input.name,
      category: input.category,
      price,
      durationMinutes,
      active: input.active !== false,
      updatedAt: new Date().toISOString()
    });
    writeServiceRecords(records);
    sendJson(res, 200, { service: records[index] });
    return;
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/services/")) {
    if (!requirePortal(req, res)) {
      return;
    }
    const serviceId = decodeURIComponent(pathname.slice("/api/services/".length));
    const records = readServiceRecords();
    const next = records.filter((record) => record.id !== serviceId);
    if (next.length === records.length) {
      sendJson(res, 404, { error: "Service not found." });
      return;
    }
    writeServiceRecords(next);
    sendJson(res, 200, { removed: true });
    return;
  }

  if (req.method === "POST" && pathname === "/api/staff-bookings") {
    if (!requirePortal(req, res)) {
      return;
    }

    try {
      const input = await readJson(req);
      const result = await createBooking(input, "staff");
      sendJson(res, result.statusCode, result.error ? { error: result.error, canBypass: result.canBypass } : { booking: result.booking });
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
    const checkins = readCheckins();
    const filtered = bookings.filter((booking) => {
      if (from && booking.date < from) return false;
      if (to && booking.date > to) return false;
      if (staffId && staffId !== "all" && booking.staffId !== staffId) return false;
      return booking.status !== "cancelled";
    }).map((booking) => bookingWithCheckinStatus(booking, checkins));

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

    if (!appointmentFitsSalonHours(nextBooking.date, nextBooking.time, durationMinutes)) {
      sendJson(res, 400, {
        error: `That service must finish by the salon closing time of ${displayTime(getHours(nextBooking.date).close)}.`
      });
      return;
    }

    if (!slotsForDate(nextBooking.date, durationMinutes).includes(nextBooking.time)) {
      sendJson(res, 400, { error: "Please choose a 15-minute appointment start time within salon hours." });
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
