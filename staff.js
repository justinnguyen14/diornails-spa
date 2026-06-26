const loginPanel = document.querySelector("#portal-login");
const dashboard = document.querySelector("#staff-dashboard");
const pinForm = document.querySelector("#pin-form");
const pinStatus = document.querySelector("#pin-status");
const calendarStaff = document.querySelector("#calendar-staff");
const calendarDate = document.querySelector("#calendar-date");
const calendarBoard = document.querySelector("#calendar-board");
const refreshCalendar = document.querySelector("#refresh-calendar");
const managePeopleButton = document.querySelector("#manage-people");
const settingsMenu = document.querySelector("#settings-menu");
const summaryCount = document.querySelector("#summary-count");
const summaryWorkers = document.querySelector("#summary-workers");
const summaryView = document.querySelector("#summary-view");
const viewButtons = document.querySelectorAll("[data-view]");

let portalPin = sessionStorage.getItem("diorPortalPin") || "";
let view = "day";
let staff = [];
let bookings = [];
let selectedBookingId = "";
let editingBookingId = "";
let scheduleData = { weekly: {}, overrides: {} };
let scheduleDraft = { weekly: {}, overrides: {} };
let scheduleDraftOverrides = {};
let pendingStaffCancel = null;
let serviceGroups = [];
let serviceDurations = {};
let customerSearchTimer = null;
let bookingPreviewTimer = null;
let bookingDetailsPinned = false;
let pendingManagerView = "";
let peopleTab = "employees";
let peopleRecords = { employees: [], customers: [], services: [] };

const workerColorMap = {
  kevin: { bg: "#ffe4e6", border: "#fb7185", ink: "#7f1d1d" },
  rumi: { bg: "#ffedd5", border: "#fb923c", ink: "#7c2d12" },
  kvita: { bg: "#fef9c3", border: "#eab308", ink: "#713f12" },
  ana: { bg: "#dcfce7", border: "#4ade80", ink: "#14532d" },
  khrystyna: { bg: "#dbeafe", border: "#60a5fa", ink: "#1e3a8a" },
  marta: { bg: "#ede9fe", border: "#a78bfa", ink: "#4c1d95" },
  oksana: { bg: "#fce7f3", border: "#f472b6", ink: "#831843" },
  sandra: { bg: "#cffafe", border: "#22d3ee", ink: "#164e63" }
};

const fallbackWorkerPalette = Object.values(workerColorMap);
const SALON_TIME_ZONE = "America/New_York";

function todayIso() {
  const parts = salonDateTimeParts();
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function salonDateTimeParts() {
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

function salonCurrentMinutes() {
  const parts = salonDateTimeParts();
  return Number(parts.hour) * 60 + Number(parts.minute);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toIso(date) {
  return date.toISOString().slice(0, 10);
}

function weekDatesFor(value) {
  const selected = new Date(`${value || todayIso()}T12:00:00`);
  const sunday = addDays(selected, -selected.getDay());
  return Array.from({ length: 7 }, (_, index) => toIso(addDays(sunday, index)));
}

function displayDate(value) {
  const date = new Date(`${value}T12:00:00`);
  const weekday = date.toLocaleDateString([], { weekday: "long" });
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${weekday} ${month}/${day}/${year}`;
}

function displayShortDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

function normalizeBirthdayInput(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return { value: "", valid: true };

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const shortMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const year = isoMatch ? Number(isoMatch[1]) : shortMatch ? Number(shortMatch[3]) : NaN;
  const month = isoMatch ? Number(isoMatch[2]) : shortMatch ? Number(shortMatch[1]) : NaN;
  const day = isoMatch ? Number(isoMatch[3]) : shortMatch ? Number(shortMatch[2]) : NaN;
  const currentYear = new Date().getFullYear();
  const date = new Date(year, month - 1, day);
  const valid = Number.isInteger(year)
    && Number.isInteger(month)
    && Number.isInteger(day)
    && year >= 1900
    && year <= currentYear
    && date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;

  return valid
    ? { value: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, valid: true }
    : { value: "", valid: false };
}

function managerDateHeader(value) {
  const date = new Date(`${value}T12:00:00`);
  const weekday = date.toLocaleDateString([], { weekday: "long" });
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();

  return `
    <span class="manager-date-header">
      <strong>${escapeHtml(weekday)}</strong>
      <small>${month}/${day}/${year}</small>
    </span>
  `;
}

function cloneSchedule(schedule) {
  return JSON.parse(JSON.stringify(schedule || { weekly: {}, overrides: {} }));
}

function normalizedSchedule(schedule) {
  const weekly = {};
  const overrides = {};

  Object.keys(schedule?.weekly || {}).sort().forEach((staffId) => {
    weekly[staffId] = [...new Set((schedule.weekly[staffId] || []).map(Number))].sort((a, b) => a - b);
  });

  Object.keys(schedule?.overrides || {}).sort().forEach((date) => {
    const values = {};
    Object.keys(schedule.overrides[date] || {}).sort().forEach((staffId) => {
      if (typeof schedule.overrides[date][staffId] === "boolean") {
        values[staffId] = schedule.overrides[date][staffId];
      }
    });
    if (Object.keys(values).length) overrides[date] = values;
  });

  return { weekly, overrides };
}

function hasUnsavedScheduleChanges() {
  return JSON.stringify(normalizedSchedule(scheduleDraft)) !== JSON.stringify(normalizedSchedule(scheduleData));
}

function resetScheduleDraft() {
  scheduleDraft = cloneSchedule(scheduleData);
  scheduleDraftOverrides = {};
}

function closeUnsavedScheduleModal() {
  document.querySelector("#unsaved-schedule-modal")?.remove();
  pendingManagerView = "";
}

function openUnsavedScheduleModal(nextView) {
  pendingManagerView = nextView;
  document.querySelector("#unsaved-schedule-modal")?.remove();
  document.body.insertAdjacentHTML("beforeend", `
    <div class="cancel-modal" id="unsaved-schedule-modal" role="dialog" aria-modal="true" aria-labelledby="unsaved-schedule-title">
      <div class="cancel-modal-card">
        <h2 id="unsaved-schedule-title">Unsaved schedule changes</h2>
        <p>Leaving Manager will discard changes that have not been saved. Go back to keep editing, discard them, or save everything now.</p>
        <div class="cancel-modal-actions">
          <button class="button button-secondary" type="button" data-manager-stay>Back to Manager</button>
          <button class="button button-secondary" type="button" data-manager-discard>Leave Without Saving</button>
          <button class="button" type="button" data-manager-save-leave>Save Changes Now</button>
        </div>
        <p class="form-status" id="unsaved-schedule-status" role="status"></p>
      </div>
    </div>
  `);
  document.querySelector("[data-manager-stay]")?.focus();
}

function activeSchedule() {
  return scheduleDraft || scheduleData;
}

function displayTime(value) {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function workerColor(staffId) {
  if (workerColorMap[staffId]) {
    return workerColorMap[staffId];
  }

  const index = Math.max(0, staff.findIndex((person) => person.id === staffId));
  if (staff[index]?.color) {
    return staff[index].color;
  }
  return fallbackWorkerPalette[index % fallbackWorkerPalette.length];
}

function workerColorStyle(staffId) {
  const color = workerColor(staffId);
  return `--event-bg: ${color.bg}; --event-border: ${color.border}; --event-ink: ${color.ink};`;
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

function calendarDisplayRange() {
  return {
    open: timeToMinutes("08:00"),
    close: timeToMinutes("20:00")
  };
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

function scheduleRange(days) {
  return calendarDisplayRange();
}

function getRange() {
  const selected = new Date(`${calendarDate.value || todayIso()}T12:00:00`);

  if (view === "day") {
    return { from: toIso(selected), to: toIso(selected) };
  }

  if (view === "week") {
    const sunday = addDays(selected, -selected.getDay());
    return { from: toIso(sunday), to: toIso(addDays(sunday, 6)) };
  }

  const first = new Date(selected.getFullYear(), selected.getMonth(), 1, 12);
  const last = new Date(selected.getFullYear(), selected.getMonth() + 1, 0, 12);
  return { from: toIso(first), to: toIso(last) };
}

function setPinStatus(message, type = "") {
  pinStatus.textContent = message;
  pinStatus.dataset.type = type;
}

function openStaffCancelModal(booking) {
  pendingStaffCancel = booking;
  const existing = document.querySelector("#staff-cancel-modal");

  if (existing) {
    existing.remove();
  }

  document.body.insertAdjacentHTML("beforeend", `
    <div class="cancel-modal" id="staff-cancel-modal" role="dialog" aria-modal="true" aria-labelledby="staff-cancel-title">
      <div class="cancel-modal-card">
        <h2 id="staff-cancel-title">Cancel appointment?</h2>
        <p>Are you sure you want to cancel ${escapeHtml(booking.customerName)}'s ${escapeHtml(booking.service)} appointment on ${displayDate(booking.date)} from ${appointmentTimeRange(booking)}?</p>
        <div class="cancel-modal-actions">
          <button class="button button-danger" type="button" id="staff-confirm-cancel">Cancel Appointment</button>
          <button class="button button-secondary" type="button" id="staff-keep-appointment">Don't Cancel</button>
        </div>
      </div>
    </div>
  `);

  document.querySelector("#staff-confirm-cancel")?.focus();
}

function closeStaffCancelModal() {
  pendingStaffCancel = null;
  document.querySelector("#staff-cancel-modal")?.remove();
}

function phoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatPhone(value) {
  const digits = phoneDigits(value).slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function serviceSelectOptions() {
  return serviceGroups.map((group) => `
    <optgroup label="${escapeHtml(group.name)}">
      ${group.services.map((service) => `
        <option value="${escapeHtml(service)}">${escapeHtml(service)} (${serviceDurations[service] || 60} min)</option>
      `).join("")}
    </optgroup>
  `).join("");
}

function staffBookingServiceOptions(filter = "") {
  const normalized = String(filter || "").trim().toLowerCase();
  return serviceGroups
    .map((group) => ({
      ...group,
      services: [...group.services]
        .filter((service) => service.toLowerCase().includes(normalized))
        .sort((a, b) => a.localeCompare(b))
    }))
    .filter((group) => group.services.length)
    .map((group) => `
      <div class="search-select-group" role="presentation">
        <p>${escapeHtml(group.name)}</p>
        ${group.services.map((service) => `
          <button type="button" role="option" data-staff-booking-service="${escapeHtml(service)}">
            <span>${escapeHtml(service)}</span>
            <small>${serviceDurations[service] || 60} min</small>
          </button>
        `).join("")}
      </div>
    `).join("") || '<p class="search-select-empty">No matching services</p>';
}

function staffBookingWorkerOptions(filter = "") {
  const normalized = String(filter || "").trim().toLowerCase();
  const normalizedDigits = phoneDigits(normalized);
  const matches = [...staff]
    .filter((person) => {
      const text = [person.name, person.phone, person.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        text.includes(normalized) ||
        Boolean(normalizedDigits && phoneDigits(person.phone || "").includes(normalizedDigits))
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return matches.length
    ? matches.map((person) => `
        <button
          type="button"
          role="option"
          data-staff-booking-worker="${escapeHtml(person.id)}"
          data-staff-booking-worker-name="${escapeHtml(person.name)}"
        >
          <span>${escapeHtml(person.name)}</span>
          ${person.phone || person.email
            ? `<small>${escapeHtml(person.phone || person.email)}</small>`
            : ""}
        </button>
      `).join("")
    : '<p class="search-select-empty">No matching nail techs</p>';
}

function renderStaffBookingSearchMenus(form) {
  if (!form) return;
  const serviceMenu = form.querySelector("#staff-booking-service-options");
  const workerMenu = form.querySelector("#staff-booking-worker-options");
  if (serviceMenu) serviceMenu.innerHTML = staffBookingServiceOptions();
  if (workerMenu) workerMenu.innerHTML = staffBookingWorkerOptions();
}

function updateStaffBookingClosingLimit(form) {
  if (!form) {
    return;
  }

  const serviceInput = form.elements.service;
  const dateInput = form.elements.date;
  const timeInput = form.elements.time;
  const helper = form.querySelector("#staff-time-limit");
  const duration = Number(serviceDurations[serviceInput.value] || 0);

  if (!dateInput.value || !duration) {
    timeInput.removeAttribute("min");
    timeInput.removeAttribute("max");
    timeInput.setCustomValidity("");
    helper.textContent = "Choose a service to calculate the latest available start time.";
    return;
  }

  const hours = getHours(dateInput.value);
  const openingMinutes = timeToMinutes(hours.open);
  const latestUnalignedStart = timeToMinutes(hours.close) - duration;
  const latestStart = openingMinutes + Math.floor((latestUnalignedStart - openingMinutes) / 15) * 15;
  const latestTime = minutesToTime(latestStart);
  timeInput.min = hours.open;
  timeInput.max = hours.close;
  const selectedMinutes = timeInput.value ? timeToMinutes(timeInput.value) : -1;
  const fits = selectedMinutes >= openingMinutes && selectedMinutes <= latestStart && (selectedMinutes - openingMinutes) % 15 === 0;

  timeInput.setCustomValidity("");
  helper.textContent = fits || !timeInput.value
    ? `This service should start by ${displayTime(latestTime)} to finish before the ${displayTime(hours.close)} closing time.`
    : `This service normally needs to start by ${displayTime(latestTime)}. Submit to review the constraint, then choose Book Anyway if needed.`;
}

function openStaffBookingModal({ date, time, staffId = "" }) {
  document.querySelector("#staff-booking-modal")?.remove();
  document.body.insertAdjacentHTML("beforeend", `
    <div class="cancel-modal staff-booking-modal" id="staff-booking-modal" role="dialog" aria-modal="true" aria-labelledby="staff-booking-title">
      <div class="cancel-modal-card staff-booking-card">
        <div class="staff-booking-head">
          <div>
            <span>Create appointment</span>
            <h2 id="staff-booking-title">${displayDate(date)} at ${displayTime(time)}</h2>
          </div>
          <button class="button button-secondary button-compact" type="button" data-close-staff-booking>Close</button>
        </div>

        <form class="staff-booking-form" id="staff-booking-form">
          <section class="staff-customer-search">
            <label>
              <span>Find saved customer</span>
              <input id="staff-customer-search" type="search" autocomplete="off" placeholder="Search name or phone number" />
            </label>
            <div class="staff-customer-results" id="staff-customer-results">
              <p>Start typing to search past customers.</p>
            </div>
          </section>

          <div class="staff-booking-grid">
            <label>
              <span>First name</span>
              <input name="firstName" autocomplete="given-name" required />
            </label>
            <label>
              <span>Last name</span>
              <input name="lastName" autocomplete="family-name" required />
            </label>
            <label>
              <span>Phone number</span>
              <input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="10 digit phone number" required />
            </label>
            <label>
              <span>Email (optional)</span>
              <input name="email" type="email" autocomplete="email" />
            </label>
            <label class="staff-booking-wide sms-consent">
              <input name="smsConsent" type="checkbox" value="true" />
              <span>Customer agreed to receive appointment confirmation and cancellation texts.</span>
            </label>
            <label class="staff-booking-wide">
              <span>Service</span>
              <div class="search-select staff-booking-search-select">
                <input
                  name="service"
                  id="staff-booking-service"
                  autocomplete="off"
                  placeholder="Choose or search service"
                  role="combobox"
                  aria-controls="staff-booking-service-options"
                  aria-expanded="false"
                  required
                />
                <div class="search-select-menu" id="staff-booking-service-options" role="listbox"></div>
              </div>
            </label>
            <label>
              <span>Nail tech</span>
              <div class="search-select staff-booking-search-select">
                <input
                  id="staff-booking-worker"
                  autocomplete="off"
                  placeholder="Choose or search nail tech"
                  role="combobox"
                  aria-controls="staff-booking-worker-options"
                  aria-expanded="false"
                  value="${escapeHtml(staff.find((person) => person.id === staffId)?.name || "")}"
                  required
                />
                <input name="staffId" id="staff-booking-worker-id" type="hidden" value="${escapeHtml(staffId)}" />
                <div class="search-select-menu" id="staff-booking-worker-options" role="listbox"></div>
              </div>
            </label>
            <label>
              <span>Date</span>
              <input name="date" type="date" value="${escapeHtml(date)}" required />
            </label>
            <label>
              <span>Start time</span>
              <input name="time" type="time" step="900" value="${escapeHtml(time)}" required />
              <small id="staff-time-limit">Choose a service to calculate the latest available start time.</small>
            </label>
            <label class="staff-booking-wide">
              <span>Notes</span>
              <textarea name="notes" rows="3" placeholder="Optional appointment notes"></textarea>
            </label>
          </div>

          <div class="staff-booking-actions">
            <button class="button" type="submit">Create Appointment</button>
            <button class="button button-warning is-hidden" type="button" data-bypass-staff-booking>Book Anyway</button>
            <button class="button button-secondary" type="button" data-close-staff-booking>Cancel</button>
          </div>
          <p class="form-status" id="staff-booking-status" role="status"></p>
        </form>
      </div>
    </div>
  `);

  const form = document.querySelector("#staff-booking-form");
  renderStaffBookingSearchMenus(form);
  document.querySelector("#staff-customer-search")?.focus();
  updateStaffBookingClosingLimit(form);
}

function closeStaffBookingModal() {
  clearTimeout(customerSearchTimer);
  document.querySelector("#staff-booking-modal")?.remove();
}

function peopleRecordForm() {
  if (peopleTab === "services") {
    const categories = [...new Set([
      "Manicure",
      "Pedicure",
      "Nail Services",
      "Waxing",
      ...peopleRecords.services.map((service) => service.category)
    ])];
    return `
      <form class="people-form" id="service-record-form">
        <input name="id" type="hidden" />
        <h3 data-people-form-title>Add new service</h3>
        <label><span>Service name</span><input name="name" required /></label>
        <label>
          <span>Category</span>
          <select name="category" required>
            ${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}
          </select>
        </label>
        <div class="people-name-grid">
          <label><span>Price</span><input name="price" type="number" min="0" step="0.01" required /></label>
          <label>
            <span>Time</span>
            <select name="durationMinutes" required>
              ${Array.from({ length: 8 }, (_, index) => (index + 1) * 15)
                .map((minutes) => `<option value="${minutes}">${minutes} minutes</option>`).join("")}
            </select>
          </label>
        </div>
        <label class="people-check"><input name="active" type="checkbox" checked /><span>Available for booking</span></label>
        <div class="people-form-actions">
          <button class="button" type="button" data-save-people>Add Service</button>
          <button class="button button-secondary" type="button" data-clear-people-form>Clear Form</button>
        </div>
        <p class="form-status" data-people-status role="status"></p>
      </form>
    `;
  }

  if (peopleTab === "employees") {
    return `
      <form class="people-form" id="employee-record-form">
        <input name="id" type="hidden" />
        <h3 data-people-form-title>Add new employee</h3>
        <label><span>Name</span><input name="name" required /></label>
        <label><span>Phone</span><input name="phone" type="tel" inputmode="tel" placeholder="Optional 10 digit phone" /></label>
        <label><span>Email</span><input name="email" type="email" placeholder="Optional email" /></label>
        <label class="people-check"><input name="active" type="checkbox" checked /><span>Active worker</span></label>
        <div class="people-form-actions">
          <button class="button" type="button" data-save-people>Add Employee</button>
          <button class="button button-secondary" type="button" data-clear-people-form>Clear Form</button>
        </div>
        <p class="form-status" data-people-status role="status"></p>
      </form>
    `;
  }

  return `
    <form class="people-form" id="customer-record-form">
      <input name="id" type="hidden" />
      <h3 data-people-form-title>Add new customer</h3>
      <div class="people-name-grid">
        <label><span>First name</span><input name="firstName" required /></label>
        <label><span>Last name</span><input name="lastName" required /></label>
      </div>
      <label><span>Phone</span><input name="phone" type="tel" inputmode="tel" placeholder="10 digit phone number" required /></label>
      <label><span>Email</span><input name="email" type="email" placeholder="Optional email" /></label>
      <label><span>Date of birth</span><input name="birthday" inputmode="numeric" placeholder="MM/DD/YYYY" /></label>
      <label class="people-check"><input name="smsConsent" type="checkbox" /><span>Customer agreed to receive appointment confirmations, reminders, account/check-in updates, birthday-week gifts, and salon offers by text. Message/data rates may apply; reply STOP to opt out.</span></label>
      <div class="people-form-actions">
        <button class="button" type="button" data-save-people>Add Customer</button>
        <button class="button button-secondary" type="button" data-clear-people-form>Clear Form</button>
      </div>
      <p class="form-status" data-people-status role="status"></p>
    </form>
  `;
}

function renderPeopleWorkspace() {
  const modal = document.querySelector("#people-modal");
  if (!modal) return;

  const records = peopleTab === "employees"
    ? peopleRecords.employees
    : peopleTab === "services"
      ? peopleRecords.services
      : peopleRecords.customers;
  const recordCard = (record) => {
        const name = peopleTab === "employees"
          ? record.name
          : peopleTab === "services"
            ? record.name
            : `${record.firstName} ${record.lastName}`;
        const detailLines = peopleTab === "services"
          ? [
              record.category,
              `$${Number(record.price).toFixed(2)} · ${record.durationMinutes} minutes`
            ]
          : [
              record.phone ? `Phone: ${record.phone}` : "",
              record.email ? `Email: ${record.email}` : "",
              peopleTab === "customers" && record.birthday ? `Birthday: ${displayShortDate(record.birthday)}` : ""
            ].filter(Boolean);
        const scheduledDays = peopleTab === "employees"
          ? weekDatesFor(calendarDate.value || todayIso()).filter((date) => isStaffWorking(record, date)).length
          : 0;
        const badge = peopleTab === "employees"
          ? `
              <span>${scheduledDays} days this week</span>
              <span>${record.active === false ? "Inactive worker" : "Active worker"}</span>
            `
          : peopleTab === "services"
            ? escapeHtml(record.active === false ? "Not bookable" : "Bookable")
            : escapeHtml(record.smsConsent ? "Texts allowed" : "No text consent");
        return `
          <article class="people-record" data-people-search="${escapeHtml(peopleSearchText(record))}">
            <div class="people-record-info">
              <strong>${escapeHtml(name)}</strong>
              <div class="people-record-details">
                ${(detailLines.length ? detailLines : ["No contact details"])
                  .map((detail) => `<small>${escapeHtml(detail)}</small>`).join("")}
              </div>
            </div>
            <em>${badge}</em>
            <span class="people-record-actions">
              <button type="button" data-edit-people-record="${escapeHtml(record.id)}">Edit</button>
              <button type="button" data-remove-people-record="${escapeHtml(record.id)}">Remove</button>
            </span>
          </article>
        `;
      };
  const list = peopleTab === "services"
    ? records.length
      ? serviceCategoryGroups(records)
          .map((group) => `
            <section class="people-record-group" data-people-group>
              <h3>${escapeHtml(group.name)}</h3>
              <div class="people-record-group-list">${group.records.map(recordCard).join("")}</div>
            </section>
          `).join("")
      : '<p class="slot-empty">No saved services yet.</p>'
    : records.length
      ? [...records]
          .sort((a, b) => peopleRecordName(a).localeCompare(peopleRecordName(b)))
          .map(recordCard).join("")
      : `<p class="slot-empty">No saved ${peopleTab} yet.</p>`;

  modal.querySelector(".people-modal-body").innerHTML = `
    <div class="people-layout">
      <section class="people-list-panel">
        <div class="people-list-heading">
          <div><span>Saved records</span><strong>${records.length}</strong></div>
          <div class="people-list-tools">
            <div class="settings-search">
              <input
                type="search"
                data-people-filter
                autocomplete="off"
                placeholder="Search ${peopleTab}"
                aria-label="Search ${peopleTab}"
              />
            </div>
            <button class="button button-secondary button-compact" type="button" data-clear-people-form>
              Add ${peopleTab === "employees" ? "Employee" : peopleTab === "services" ? "Service" : "Customer"}
            </button>
          </div>
        </div>
        <div class="people-records">
          ${list}
          <p class="slot-empty people-filter-empty" data-people-filter-empty hidden>No matching ${peopleTab}.</p>
        </div>
      </section>
      ${peopleRecordForm()}
    </div>
  `;

  const form = modal.querySelector("#employee-record-form, #customer-record-form, #service-record-form");
  if (!form) {
    return;
  }

  form.dataset.saveBound = "true";
}

function peopleRecordName(record) {
  if (peopleTab === "employees" || peopleTab === "services") return String(record.name || "");
  return `${record.firstName || ""} ${record.lastName || ""}`.trim();
}

function peopleSearchText(record) {
  const fields = peopleTab === "services"
    ? [record.name, record.category, record.price, record.durationMinutes]
    : peopleTab === "employees"
      ? [record.name, record.phone, record.email]
      : [record.firstName, record.lastName, `${record.firstName || ""} ${record.lastName || ""}`, record.phone, record.email, record.birthday, displayShortDate(record.birthday)];
  return fields
    .filter((value) => value !== undefined && value !== null)
    .join(" ")
    .toLowerCase();
}

function serviceCategoryGroups(records) {
  const preferredOrder = serviceGroups.map((group) => group.name);
  const categories = [...new Set(records.map((record) => record.category || "Other"))]
    .sort((a, b) => {
      const aIndex = preferredOrder.indexOf(a);
      const bIndex = preferredOrder.indexOf(b);
      if (aIndex >= 0 || bIndex >= 0) return (aIndex < 0 ? 999 : aIndex) - (bIndex < 0 ? 999 : bIndex);
      return a.localeCompare(b);
    });
  return categories.map((category) => ({
    name: category,
    records: records
      .filter((record) => (record.category || "Other") === category)
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
  }));
}

async function loadPeopleRecords() {
  const headers = { "X-Portal-Pin": portalPin };
  const [employeesResponse, customersResponse, servicesResponse] = await Promise.all([
    fetch("/api/staff-records", { headers }),
    fetch("/api/customers", { headers }),
    fetch("/api/services", { headers })
  ]);
  const employeesData = await employeesResponse.json();
  const customersData = await customersResponse.json();
  const servicesData = await servicesResponse.json();

  if (!employeesResponse.ok || !customersResponse.ok || !servicesResponse.ok) {
    throw new Error(employeesData.error || customersData.error || servicesData.error || "Unable to load settings records.");
  }

  peopleRecords = {
    employees: employeesData.staff || [],
    customers: customersData.customers || [],
    services: servicesData.services || []
  };
}

async function openPeopleModal(tab = "customers") {
  peopleTab = tab;
  settingsMenu.hidden = true;
  managePeopleButton.setAttribute("aria-expanded", "false");
  document.querySelector("#people-modal")?.remove();
  const isEmployee = peopleTab === "employees";
  const isService = peopleTab === "services";
  document.body.insertAdjacentHTML("beforeend", `
    <div class="cancel-modal people-modal" id="people-modal" role="dialog" aria-modal="true" aria-labelledby="people-title">
      <div class="cancel-modal-card people-modal-card">
        <div class="people-modal-head">
          <div>
            <span>Settings</span>
            <h2 id="people-title">${isEmployee ? "Staff Management" : isService ? "Service Management" : "Customer Database"}</h2>
            <p>${isEmployee
              ? "Workers saved here appear in customer booking, the salon calendar, and Manager scheduling."
              : isService
                ? "Prices and appointment times saved here immediately control booking availability and reserved calendar time."
              : "This is the same saved-customer database used when staff search for a customer while creating an appointment."}</p>
          </div>
          <button class="button button-secondary button-compact" type="button" data-close-people>Close</button>
        </div>
        <div class="people-modal-body"><p>Loading records...</p></div>
      </div>
    </div>
  `);

  try {
    await loadPeopleRecords();
    renderPeopleWorkspace();
  } catch (error) {
    document.querySelector(".people-modal-body").innerHTML = `<p class="form-status" data-type="error">${escapeHtml(error.message)}</p>`;
  }
}

function fillPeopleForm(recordId) {
  const records = peopleTab === "employees"
    ? peopleRecords.employees
    : peopleTab === "services"
      ? peopleRecords.services
      : peopleRecords.customers;
  const record = records.find((item) => item.id === recordId);
  const form = document.querySelector(
    peopleTab === "employees"
      ? "#employee-record-form"
      : peopleTab === "services"
        ? "#service-record-form"
        : "#customer-record-form"
  );
  if (!record || !form) return;

  Object.entries(record).forEach(([key, value]) => {
    const field = form.elements[key];
    if (!field) return;
    if (field.type === "checkbox") field.checked = Boolean(value);
    else {
      field.value = peopleTab === "customers" && key === "birthday" && value ? displayShortDate(value) : value || "";
      if (peopleTab === "services" && key === "durationMinutes" && !field.value) {
        field.insertAdjacentHTML("afterbegin", `<option value="${Number(value)}" disabled>${Number(value)} minutes (choose a 15 minute interval)</option>`);
        field.value = String(value);
      }
    }
  });
  const title = form.querySelector("[data-people-form-title]");
  const submitButton = form.querySelector("[data-save-people]");
  const label = peopleTab === "employees" ? "employee" : peopleTab === "services" ? "service" : "customer";
  if (title) title.textContent = `Edit ${label}`;
  if (submitButton) submitButton.textContent = `Save ${label[0].toUpperCase()}${label.slice(1)}`;
  form.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function filterPeopleRecords(query) {
  const normalized = String(query || "").trim().toLowerCase();
  const normalizedDigits = phoneDigits(normalized);
  document.querySelectorAll(".people-record").forEach((record) => {
    const searchable = record.dataset.peopleSearch || "";
    const matchesText = searchable.includes(normalized);
    const matchesPhone = normalizedDigits && phoneDigits(searchable).includes(normalizedDigits);
    record.hidden = Boolean(normalized) && !matchesText && !matchesPhone;
  });
  document.querySelectorAll("[data-people-group]").forEach((group) => {
    group.hidden = !group.querySelector(".people-record:not([hidden])");
  });
  const empty = document.querySelector("[data-people-filter-empty]");
  if (empty) {
    empty.hidden = !normalized || Boolean(document.querySelector(".people-record:not([hidden])"));
  }
}

function clearPeopleForm() {
  const form = document.querySelector(
    peopleTab === "employees"
      ? "#employee-record-form"
      : peopleTab === "services"
        ? "#service-record-form"
        : "#customer-record-form"
  );
  if (!form) return;
  form.reset();
  form.elements.namedItem("id").value = "";
  if (peopleTab === "employees" || peopleTab === "services") {
    form.elements.namedItem("active").checked = true;
  }
  if (peopleTab === "services") {
    form.elements.namedItem("durationMinutes").value = "15";
  }
  const title = form.querySelector("[data-people-form-title]");
  const submitButton = form.querySelector("[data-save-people]");
  const label = peopleTab === "employees" ? "employee" : peopleTab === "services" ? "service" : "customer";
  if (title) title.textContent = `Add new ${label}`;
  if (submitButton) submitButton.textContent = `Add ${label[0].toUpperCase()}${label.slice(1)}`;
  form.querySelector("input:not([type='hidden'])")?.focus();
}

async function removePeopleRecord(recordId) {
  const isEmployee = peopleTab === "employees";
  const isService = peopleTab === "services";
  const records = isEmployee ? peopleRecords.employees : isService ? peopleRecords.services : peopleRecords.customers;
  const record = records.find((item) => item.id === recordId);
  const name = isEmployee || isService ? record?.name : `${record?.firstName || ""} ${record?.lastName || ""}`.trim();
  const prompt = isEmployee
    ? `Remove ${name} completely from the employee database and schedules? Existing appointment history will stay saved.`
    : isService
      ? `Remove ${name} from available services? Existing appointments using this service will stay saved.`
      : `Remove ${name} completely from the saved customer database? Existing appointments will stay saved.`;

  if (!record || !window.confirm(prompt)) return;

  const endpoint = isEmployee ? "/api/staff-records" : isService ? "/api/services" : "/api/customers";
  const response = await fetch(`${endpoint}/${encodeURIComponent(recordId)}`, {
    method: "DELETE",
    headers: { "X-Portal-Pin": portalPin }
  });
  const result = await response.json();
  if (!response.ok) {
    window.alert(result.error || "Unable to remove record.");
    return;
  }

  if (isEmployee) {
    await loadConfig();
    await loadSchedule();
    await loadBookings();
  } else if (isService) {
    await loadConfig();
  }
  await loadPeopleRecords();
  renderPeopleWorkspace();
}

function updateBookingDetailPanel() {
  const currentPanel = calendarBoard.querySelector(".week-detail-panel");
  calendarBoard.classList.toggle("has-booking-detail", Boolean(selectedBookingId));

  if (currentPanel) {
    currentPanel.outerHTML = renderBookingDetails();
  }
}

function showBookingDetails(bookingId, pinned = false) {
  clearTimeout(bookingPreviewTimer);
  selectedBookingId = bookingId;
  editingBookingId = "";
  bookingDetailsPinned = pinned;
  updateBookingDetailPanel();
}

function closeBookingDetails() {
  clearTimeout(bookingPreviewTimer);
  selectedBookingId = "";
  editingBookingId = "";
  bookingDetailsPinned = false;
  updateBookingDetailPanel();
}

function scheduleBookingPreviewClose() {
  clearTimeout(bookingPreviewTimer);

  if (bookingDetailsPinned) {
    return;
  }

  bookingPreviewTimer = setTimeout(() => {
    closeBookingDetails();
  }, 180);
}

async function loadConfig() {
  const response = await fetch("/api/config");
  const config = await response.json();
  staff = config.staff.filter((person) => person.id !== "any");
  serviceGroups = config.serviceGroups || [];
  serviceDurations = config.serviceDurations || {};
  calendarStaff.innerHTML = [
    '<option value="all">All workers</option>',
    ...staff.map((person) => `<option value="${person.id}">${person.name}</option>`)
  ].join("");
}

async function loadSchedule() {
  const response = await fetch("/api/schedule", {
    headers: { "X-Portal-Pin": portalPin }
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load employee schedule.");
  }

  scheduleData = data.schedule || { weekly: {}, overrides: {} };
  scheduleDraft = cloneSchedule(scheduleData);
  scheduleDraftOverrides = {};
}

async function loadBookings() {
  const range = getRange();
  const staffId = calendarStaff.value || "all";
  const url = `/api/bookings?from=${range.from}&to=${range.to}&staffId=${encodeURIComponent(staffId)}`;
  const response = await fetch(url, {
    headers: { "X-Portal-Pin": portalPin }
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load calendar.");
  }

  bookings = data.bookings || [];
  if (selectedBookingId && !bookings.some((booking) => booking.id === selectedBookingId)) {
    selectedBookingId = "";
    editingBookingId = "";
  }
  renderCalendar();
}

function bookingCard(booking) {
  const notes = booking.notes ? `<p class="calendar-notes">${booking.notes}</p>` : "";
  return `
    <article class="appointment-card" style="${workerColorStyle(booking.staffId)}">
      <div>
        <strong>${appointmentTimeRange(booking)}</strong>
        <span>${booking.staffName}</span>
      </div>
      <h3>${booking.customerName}</h3>
      <p>${booking.service}</p>
      <a href="tel:${booking.phone}">${booking.phone}</a>
      ${booking.email ? `<a href="mailto:${booking.email}">${booking.email}</a>` : ""}
      ${notes}
      ${checkInBadge(booking)}
    </article>
  `;
}

function addMinutes(value, minutesToAdd) {
  const [hours, minutes] = value.split(":").map(Number);
  const total = hours * 60 + minutes + minutesToAdd;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function appointmentEndTime(booking) {
  return addMinutes(booking.time, Number(booking.durationMinutes || 60));
}

function appointmentTimeRange(booking) {
  return `${displayTime(booking.time)} - ${displayTime(appointmentEndTime(booking))}`;
}

function bookingHasEnded(booking) {
  const today = todayIso();
  if (booking.date < today) return true;
  if (booking.date > today) return false;
  return timeToMinutes(appointmentEndTime(booking)) <= salonCurrentMinutes();
}

function checkInState(booking) {
  if (booking.checkInStatus === "checked-in") {
    return {
      status: "checked-in",
      label: "Checked in",
      mark: "✓"
    };
  }

  if (bookingHasEnded(booking)) {
    return {
      status: "missed",
      label: "No check-in",
      mark: "×"
    };
  }

  return {
    status: "pending",
    label: "Not checked in",
    mark: ""
  };
}

function checkInBadge(booking, compact = false) {
  const state = checkInState(booking);
  return `
    <span class="checkin-badge checkin-badge-${state.status} ${compact ? "checkin-badge-compact" : ""}" title="${escapeHtml(state.label)}">
      <span aria-hidden="true">${state.mark}</span>
      ${compact ? "" : `<strong>${escapeHtml(state.label)}</strong>`}
    </span>
  `;
}

function scheduleLabels(open, close) {
  const firstHour = Math.floor(open / 30) * 30;
  const labels = [];

  for (let minutes = firstHour; minutes <= close; minutes += 30) {
    labels.push(minutes);
  }

  return labels;
}

function sameTimeBookingsFor(booking) {
  if (!booking) {
    return [];
  }

  return bookings
    .filter((item) => item.date === booking.date && item.time === booking.time)
    .sort((a, b) => a.staffName.localeCompare(b.staffName) || a.customerName.localeCompare(b.customerName));
}

function renderScheduleEvent(booking, open, compact = false, overlapCount = 1, groupedBookings = []) {
  const start = timeToMinutes(booking.time);
  const duration = Number(booking.durationMinutes || 60);
  const notes = booking.notes ? `<span class="schedule-event-notes">${escapeHtml(booking.notes)}</span>` : "";
  const eventClass = compact ? "schedule-event schedule-event-compact" : "schedule-event";
  const countBadge = overlapCount > 1 ? `<em>${overlapCount} appointments</em>` : "";
  const groupSummary = groupedBookings.length > 1
    ? groupedBookings.map((item) => `${item.staffName}: ${item.customerName}`).join(" | ")
    : "";

  return `
    <button
      class="${eventClass}"
      style="--event-start: ${Math.max(0, start - open)}; --event-duration: ${duration}; ${workerColorStyle(booking.staffId)}"
      title="${escapeHtml(groupSummary || `${booking.customerName} - ${booking.service}`)}"
      type="button"
      data-booking-id="${escapeHtml(booking.id)}"
    >
      ${checkInBadge(booking, true)}
      <strong>${appointmentTimeRange(booking)} ${escapeHtml(booking.customerName)}${countBadge}</strong>
      <span>${escapeHtml(overlapCount > 1 ? groupSummary : booking.service)}</span>
      <span>${escapeHtml(overlapCount > 1 ? "Click to choose appointment" : booking.staffName)}</span>
      ${compact ? "" : `<span>${escapeHtml(booking.phone)}</span>${notes}`}
    </button>
  `;
}

function groupedBookingsByTime(bookingsForColumn) {
  const groups = new Map();

  bookingsForColumn.forEach((booking) => {
    if (!groups.has(booking.time)) {
      groups.set(booking.time, []);
    }

    groups.get(booking.time).push(booking);
  });

  return [...groups.values()].map((group) =>
    group.sort((a, b) => a.staffName.localeCompare(b.staffName) || a.customerName.localeCompare(b.customerName))
  );
}

function renderCreateSlots(column, range) {
  if (!column.date) {
    return "";
  }

  if (column.staffId) {
    const person = staff.find((worker) => worker.id === column.staffId);

    if (person && !isStaffWorking(person, column.date)) {
      return "";
    }
  }

  const hours = getHours(column.date);
  const start = Math.max(range.open, timeToMinutes(hours.open));
  const end = Math.min(range.close, timeToMinutes(hours.close));
  const slots = [];

  for (let minutes = start; minutes < end; minutes += 15) {
    const time = minutesToTime(minutes);
    slots.push(`
      <button
        class="schedule-create-slot"
        type="button"
        style="--event-start: ${Math.max(0, minutes - range.open)};"
        data-create-slot
        data-date="${escapeHtml(column.date)}"
        data-time="${escapeHtml(time)}"
        data-staff-id="${escapeHtml(column.staffId || "")}"
        title="Create appointment at ${escapeHtml(displayTime(time))}"
        aria-label="Create appointment on ${escapeHtml(displayDate(column.date))} at ${escapeHtml(displayTime(time))}"
      ></button>
    `);
  }

  return slots.join("");
}

function maximizeButton(label = "calendar") {
  return `
    <button class="calendar-maximize-button" type="button" data-maximize-calendar aria-label="Maximize ${label}">
      <span data-maximize-label>Maximize</span>
    </button>
  `;
}

function calendarNavigationButton(label, direction) {
  const isPrevious = direction < 0;
  const action = isPrevious ? "Previous" : "Next";
  const arrow = isPrevious ? "&lsaquo;" : "&rsaquo;";

  return `
    <button
      class="calendar-navigation-button"
      type="button"
      data-calendar-direction="${direction}"
      aria-label="${action} ${escapeHtml(label)}"
      title="${action} ${escapeHtml(label)}"
    >
      ${isPrevious
        ? `<b aria-hidden="true">${arrow}</b><span>${action}</span>`
        : `<span>${action}</span><b aria-hidden="true">${arrow}</b>`}
    </button>
  `;
}

function renderSchedule(columns, days, compact = false) {
  const range = scheduleRange(days);
  const labels = scheduleLabels(range.open, range.close);
  const totalMinutes = range.close - range.open;
  const currentMinutes = salonCurrentMinutes();
  const showCurrentTime = days.includes(todayIso()) && currentMinutes >= range.open && currentMinutes <= range.close;
  const currentTimeOffset = Math.min(totalMinutes, Math.max(0, currentMinutes - range.open));

  return `
    <div class="schedule-calendar" style="--calendar-minutes: ${totalMinutes}; --schedule-columns: ${columns.length};">
      <div class="schedule-header">
        <div class="schedule-corner"></div>
        ${columns.map((column) => `
          <div class="schedule-heading ${column.isOff ? "schedule-heading-off" : ""}">
            ${escapeHtml(column.title)}
            ${column.isOff ? "<span>Off</span>" : ""}
          </div>
        `).join("")}
      </div>
      <div class="schedule-body">
        ${showCurrentTime ? `
          <div
            class="current-time-marker"
            style="--current-time-offset: ${currentTimeOffset};"
            data-current-time-marker
            aria-label="Current salon time"
          >
            <span aria-hidden="true"></span>
          </div>
        ` : ""}
        <div class="schedule-times">
          ${labels.map((minutes) => `
            <span style="--time-offset: ${Math.max(0, minutes - range.open)};">${displayTime(minutesToTime(minutes))}</span>
          `).join("")}
        </div>
        ${columns.map((column) => {
          return `
          <section class="schedule-column ${column.isOff ? "schedule-column-off" : ""}" aria-label="${escapeHtml(column.title)}${column.isOff ? " - off" : ""}">
            ${labels.map((minutes) => `
              <div class="schedule-line" style="--line-offset: ${Math.max(0, minutes - range.open)};"></div>
            `).join("")}
            ${column.isOff ? '<div class="schedule-off-message">Not working</div>' : renderCreateSlots(column, range)}
            ${groupedBookingsByTime(column.bookings).map((group) => renderScheduleEvent(group[0], range.open, compact, group.length, group)).join("")}
          </section>
        `;
        }).join("")}
      </div>
    </div>
  `;
}

function updateCurrentTimeMarker() {
  const marker = calendarBoard.querySelector("[data-current-time-marker]");

  if (!marker) {
    return;
  }

  const range = calendarDisplayRange();
  const offset = Math.min(range.close - range.open, Math.max(0, salonCurrentMinutes() - range.open));
  marker.style.setProperty("--current-time-offset", offset);
}

function renderDay() {
  const date = calendarDate.value || todayIso();
  const selectedStaffId = calendarStaff.value || "all";
  const isSingleWorker = selectedStaffId !== "all";
  const visibleStaff = selectedStaffId === "all"
    ? staff.filter((person) => isStaffWorking(person, date))
    : staff.filter((person) => person.id === selectedStaffId);
  const columns = visibleStaff.map((person) => ({
    title: `${person.name} - ${displayDate(date)}`,
    date,
    staffId: person.id,
    isOff: !isStaffWorking(person, date),
    bookings: bookings
      .filter((booking) => booking.date === date && booking.staffId === person.id)
      .sort((a, b) => a.time.localeCompare(b.time))
  }));
  const appointmentCount = columns.reduce((sum, column) => sum + column.bookings.length, 0);

  calendarBoard.innerHTML = `
    <div class="calendar-day" data-calendar-panel>
      <div class="calendar-day-heading">
        <div class="calendar-heading-main">
          <div class="calendar-heading-title">
            ${calendarNavigationButton("day", -1)}
            <h2>${displayDate(date)}</h2>
            ${calendarNavigationButton("day", 1)}
          </div>
          <span>${appointmentCount} appointment${appointmentCount === 1 ? "" : "s"}</span>
        </div>
        ${maximizeButton("day calendar")}
      </div>
      ${columns.length ? `
        <div class="staff-calendar-layout ${isSingleWorker ? "staff-calendar-layout-wide" : ""}">
          ${renderSchedule(columns, [date], true)}
          ${renderBookingDetails()}
        </div>
      ` : '<p class="slot-empty">No workers are scheduled for this date.</p>'}
    </div>
  `;
}

function renderWeek() {
  const range = getRange();
  const start = new Date(`${range.from}T12:00:00`);
  const days = Array.from({ length: 7 }, (_, index) => toIso(addDays(start, index)));
  const selectedStaffId = calendarStaff.value || "all";
  const selectedStaff = staff.find((person) => person.id === selectedStaffId);
  const selectedStaffName = selectedStaff?.name;
  const columns = days.map((day) => ({
    title: displayDate(day),
    date: day,
    staffId: selectedStaffId !== "all" ? selectedStaffId : "",
    isOff: Boolean(selectedStaff && !isStaffWorking(selectedStaff, day)),
    bookings: bookings
      .filter((booking) => booking.date === day)
      .sort((a, b) => a.time.localeCompare(b.time))
  }));
  const appointmentCount = columns.reduce((sum, column) => sum + column.bookings.length, 0);

  calendarBoard.innerHTML = `
    <div class="calendar-day" data-calendar-panel>
      <div class="calendar-day-heading">
        <div class="calendar-heading-main">
          <div class="calendar-heading-title">
            ${calendarNavigationButton("week", -1)}
            <h2>${selectedStaffName ? `${selectedStaffName}'s week` : "All workers week"}</h2>
            ${calendarNavigationButton("week", 1)}
          </div>
          <span>${displayDate(days[0])} - ${displayDate(days[6])}</span>
          <span>${appointmentCount} appointment${appointmentCount === 1 ? "" : "s"}</span>
        </div>
        ${maximizeButton("week calendar")}
      </div>
      <div class="staff-calendar-layout">
        ${renderSchedule(columns, days, true)}
        ${renderBookingDetails()}
      </div>
    </div>
  `;
}

function renderBookingDetails() {
  const booking = bookings.find((item) => item.id === selectedBookingId) || bookings[0];

  if (!booking) {
    return `
      <aside class="week-detail-panel">
        <h2>Appointment details</h2>
        <p class="slot-empty">Select an appointment to view customer details.</p>
      </aside>
    `;
  }

  if (editingBookingId === booking.id) {
    return `
      <aside class="week-detail-panel" style="${workerColorStyle(booking.staffId)}">
        <div class="week-detail-head">
          <div>
            <span>${displayDate(booking.date)} at ${appointmentTimeRange(booking)}</span>
            <h2>Edit appointment</h2>
          </div>
          <button class="button button-secondary button-compact" type="button" data-cancel-edit-booking>Cancel</button>
        </div>
        <form class="staff-edit-form" data-edit-booking-form="${escapeHtml(booking.id)}">
          <label>
            <span>Customer name</span>
            <input name="customerName" value="${escapeHtml(booking.customerName)}" required />
          </label>
          <label>
            <span>Service</span>
            <input name="service" value="${escapeHtml(booking.service)}" required />
          </label>
          <label>
            <span>Nail tech</span>
            <select name="staffId">
              ${staff.map((person) => `
                <option value="${escapeHtml(person.id)}" ${person.id === booking.staffId ? "selected" : ""}>${escapeHtml(person.name)}</option>
              `).join("")}
            </select>
          </label>
          <div class="staff-edit-grid">
            <label>
              <span>Date</span>
              <input name="date" type="date" value="${escapeHtml(booking.date)}" required />
            </label>
            <label>
              <span>Time</span>
              <input name="time" type="time" value="${escapeHtml(booking.time)}" required />
            </label>
          </div>
          <label>
            <span>Phone</span>
            <input name="phone" value="${escapeHtml(booking.phone)}" required />
          </label>
          <label>
            <span>Email (optional)</span>
            <input name="email" type="email" value="${escapeHtml(booking.email || "")}" />
          </label>
          <label>
            <span>Notes</span>
            <textarea name="notes" rows="3">${escapeHtml(booking.notes || "")}</textarea>
          </label>
          <button class="button" type="submit">Save Changes</button>
          <p class="form-status" id="staff-edit-status" role="status"></p>
        </form>
      </aside>
    `;
  }

  return `
    <aside class="week-detail-panel" style="${workerColorStyle(booking.staffId)}">
      <div class="week-detail-head">
        <div>
          <span>${displayDate(booking.date)} at ${appointmentTimeRange(booking)}</span>
          <h2>${escapeHtml(booking.customerName)}</h2>
        </div>
        <div class="week-detail-actions">
          <button class="button button-secondary button-compact" type="button" data-edit-booking="${escapeHtml(booking.id)}">Edit</button>
          <button class="detail-close-button" type="button" data-close-booking-details aria-label="Close appointment details" title="Close appointment details">&times;</button>
        </div>
      </div>
      <dl>
        <div><dt>Check-in</dt><dd>${checkInBadge(booking)}</dd></div>
        <div><dt>Service</dt><dd>${escapeHtml(booking.service)}</dd></div>
        <div><dt>Nail tech</dt><dd>${escapeHtml(booking.staffName)}</dd></div>
        <div><dt>Time reserved</dt><dd>${appointmentTimeRange(booking)} (${Number(booking.durationMinutes || 60)} minutes)</dd></div>
        <div><dt>Phone</dt><dd><a href="tel:${escapeHtml(booking.phone)}">${escapeHtml(booking.phone)}</a></dd></div>
        <div><dt>Email</dt><dd>${booking.email ? `<a href="mailto:${escapeHtml(booking.email)}">${escapeHtml(booking.email)}</a>` : "Not provided"}</dd></div>
        <div><dt>Notes</dt><dd>${escapeHtml(booking.notes || "None")}</dd></div>
      </dl>
      <button class="button button-danger" type="button" data-staff-cancel-booking="${escapeHtml(booking.id)}">
        Cancel This Appointment
      </button>
      ${renderSameTimePicker(booking)}
      <p class="form-status" id="staff-cancel-status" role="status"></p>
    </aside>
  `;
}

function renderSameTimePicker(booking) {
  const sameTimeBookings = sameTimeBookingsFor(booking);

  if (sameTimeBookings.length <= 1) {
    return "";
  }

  return `
    <section class="same-time-picker" aria-label="Appointments at this time">
      <div>
        <strong>${sameTimeBookings.length} appointments at ${displayTime(booking.time)}</strong>
        <span>Choose one to view details</span>
      </div>
      <div class="same-time-scroll">
        ${sameTimeBookings.map((item) => `
          <button
            class="${item.id === booking.id ? "is-selected" : ""}"
            type="button"
            style="${workerColorStyle(item.staffId)}"
            data-booking-id="${escapeHtml(item.id)}"
          >
            <span>${escapeHtml(item.staffName)}</span>
            <strong>${escapeHtml(item.customerName)}</strong>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function renderMonth() {
  const range = getRange();
  const start = new Date(`${range.from}T12:00:00`);
  const totalDays = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const firstDayOffset = start.getDay();
  const monthName = start.toLocaleDateString([], { month: "long", year: "numeric" });
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const leadingBlankDays = Array.from({ length: firstDayOffset }, () => null);
  const days = Array.from({ length: totalDays }, (_, index) => toIso(new Date(start.getFullYear(), start.getMonth(), index + 1, 12)));
  const monthCells = [...leadingBlankDays, ...days];
  const selectedStaffId = calendarStaff.value || "all";
  const visibleStaff = selectedStaffId === "all"
    ? staff
    : staff.filter((person) => person.id === selectedStaffId);

  calendarBoard.innerHTML = `
    <div class="month-calendar" data-calendar-panel>
      <div class="month-calendar-heading">
        <div class="calendar-heading-main">
          <div class="calendar-heading-title">
            ${calendarNavigationButton("month", -1)}
            <h2>${monthName}</h2>
            ${calendarNavigationButton("month", 1)}
          </div>
          <span>Employee work schedule</span>
        </div>
        ${maximizeButton("month calendar")}
      </div>
      <div class="month-weekdays">
        ${weekdays.map((weekday) => `<span>${weekday}</span>`).join("")}
      </div>
      <div class="month-grid">
        ${monthCells.map((day) => {
          if (!day) {
            return '<section class="month-cell month-cell-empty" aria-hidden="true"></section>';
          }

          const dayNumber = new Date(`${day}T12:00:00`).getDate();
          const workingStaff = visibleStaff.filter((person) => isStaffWorking(person, day));

          return `
            <section class="month-cell" aria-label="${displayDate(day)}">
              <div class="month-date-number">${dayNumber}</div>
              <div class="month-work-schedule">
                ${workingStaff.length
                  ? workingStaff.map((person) => `<span style="${workerColorStyle(person.id)}">${escapeHtml(person.name)}</span>`).join("")
                  : "<p>Off</p>"}
              </div>
            </section>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function isStaffWorking(person, dateString) {
  const day = new Date(`${dateString}T12:00:00`).getDay();
  const schedule = activeSchedule();
  const override = schedule.overrides?.[dateString]?.[person.id];

  if (typeof override === "boolean") {
    return override;
  }

  const weeklyDays = schedule.weekly?.[person.id] || person.workDays || [];
  return weeklyDays.includes(day);
}

function isWeeklyDayChecked(staffId, day) {
  return (activeSchedule().weekly?.[staffId] || []).includes(day);
}

function setDraftOverride(date, staffId, isWorking) {
  scheduleDraft.overrides = scheduleDraft.overrides || {};
  const day = new Date(`${date}T12:00:00`).getDay();
  const weeklyValue = (scheduleDraft.weekly?.[staffId] || []).includes(day);
  const savedOverride = scheduleData.overrides?.[date]?.[staffId];
  const savedValue = typeof savedOverride === "boolean"
    ? savedOverride
    : (scheduleData.weekly?.[staffId] || []).includes(day);

  scheduleDraft.overrides[date] = scheduleDraft.overrides[date] || {};
  if (isWorking === weeklyValue) {
    delete scheduleDraft.overrides[date][staffId];
  } else {
    scheduleDraft.overrides[date][staffId] = isWorking;
  }
  if (Object.keys(scheduleDraft.overrides[date]).length === 0) {
    delete scheduleDraft.overrides[date];
  }

  if (isWorking === savedValue) {
    delete scheduleDraftOverrides[date]?.[staffId];
    if (scheduleDraftOverrides[date] && Object.keys(scheduleDraftOverrides[date]).length === 0) {
      delete scheduleDraftOverrides[date];
    }
  } else {
    scheduleDraftOverrides[date] = scheduleDraftOverrides[date] || {};
    scheduleDraftOverrides[date][staffId] = isWorking;
  }
}

function moveManagerWeek(direction) {
  const current = new Date(`${calendarDate.value || todayIso()}T12:00:00`);
  current.setDate(current.getDate() + direction * 7);
  calendarDate.value = toIso(current);
  renderCalendar();
}

function renderManager() {
  const date = calendarDate.value || todayIso();
  const weekDates = weekDatesFor(date);
  const weekdays = [
    { id: 0, label: "Sunday" },
    { id: 1, label: "Monday" },
    { id: 2, label: "Tuesday" },
    { id: 3, label: "Wednesday" },
    { id: 4, label: "Thursday" },
    { id: 5, label: "Friday" },
    { id: 6, label: "Saturday" }
  ];

  calendarBoard.innerHTML = `
    <section class="manager-schedule">
      <div class="manager-heading">
        <div>
          <h2>Manager schedule</h2>
          <p>Set weekly employee workdays and override the selected calendar date when someone is off or added. Checked means working.</p>
        </div>
        <div class="manager-actions">
          <label>
            <span>Week selector</span>
            <input id="manager-week-date" type="date" value="${date}" />
          </label>
          <button class="button" type="button" id="save-schedule">Save Schedule</button>
        </div>
      </div>

      <div class="manager-sections">
        <section class="manager-panel">
          <h3>Weekly schedule</h3>
          <p>Checked means this employee normally works that weekday every week, including future weeks.</p>
          <div class="manager-table">
            ${staff.map((person) => `
              <div class="manager-row">
                <strong>${escapeHtml(person.name)}</strong>
                <div class="weekday-checks">
                  ${weekdays.map((day) => `
                    <label>
                      <input
                        type="checkbox"
                        data-weekly-staff="${escapeHtml(person.id)}"
                        value="${day.id}"
                        ${isWeeklyDayChecked(person.id, day.id) ? "checked" : ""}
                      />
                      <span>${day.label}</span>
                    </label>
                  `).join("")}
                </div>
              </div>
            `).join("")}
          </div>
        </section>

        <section class="manager-panel">
          <h3>Selected date: ${displayDate(date)}</h3>
          <p>One-day exception only. Change a box here when someone is working or off on just this date.</p>
          <div class="date-override-list">
            ${staff.map((person) => `
              <label>
                <input
                  type="checkbox"
                  data-date-staff="${escapeHtml(person.id)}"
                  ${isStaffWorking(person, date) ? "checked" : ""}
                />
                <span>${escapeHtml(person.name)} working on ${displayDate(date)}</span>
              </label>
            `).join("")}
          </div>
        </section>
      </div>

      <section class="manager-panel manager-week-panel">
        <div class="manager-week-heading">
          <button class="button button-secondary manager-week-button" type="button" data-manager-week-direction="-1" aria-label="Previous week">
            <span aria-hidden="true">‹</span>
            Previous
          </button>
          <h3>Selected week: ${displayDate(weekDates[0])} - ${displayDate(weekDates[6])}</h3>
          <button class="button button-secondary manager-week-button" type="button" data-manager-week-direction="1" aria-label="Next week">
            Next
            <span aria-hidden="true">›</span>
          </button>
        </div>
        <p>Use this for one-week exceptions. Only boxes you change here are saved as date-specific changes.</p>
        <div class="week-override-table">
          <div class="week-override-header">
            <span>Employee</span>
            ${weekDates.map((day) => managerDateHeader(day)).join("")}
          </div>
          ${staff.map((person) => `
            <div class="week-override-row">
              <strong>${escapeHtml(person.name)}</strong>
              ${weekDates.map((day) => `
                <label>
                  <input
                    type="checkbox"
                    data-week-date="${day}"
                    data-week-date-staff="${escapeHtml(person.id)}"
                    ${isStaffWorking(person, day) ? "checked" : ""}
                  />
                  <span>${new Date(`${day}T12:00:00`).toLocaleDateString([], { weekday: "short" })}</span>
                </label>
              `).join("")}
            </div>
          `).join("")}
        </div>
      </section>
      <p class="form-status" id="manager-status" role="status"></p>
    </section>
  `;
}

function renderCalendar() {
  calendarBoard.classList.toggle("has-booking-detail", Boolean(selectedBookingId));
  const workerIds = new Set(bookings.map((booking) => booking.staffId));
  summaryCount.textContent = String(bookings.length);
  summaryWorkers.textContent = String(workerIds.size);
  summaryView.textContent = view[0].toUpperCase() + view.slice(1);

  if (view === "manager") {
    renderManager();
    updateMaximizeLabels();
    return;
  }

  if (view === "week") {
    renderWeek();
    updateMaximizeLabels();
    return;
  }

  if (view === "month") {
    renderMonth();
    updateMaximizeLabels();
    return;
  }

  renderDay();
  updateMaximizeLabels();
}

async function openDashboard(pin) {
  portalPin = pin;
  sessionStorage.setItem("diorPortalPin", pin);
  loginPanel.classList.add("is-hidden");
  dashboard.classList.remove("is-hidden");
  await loadConfig();
  await loadSchedule();
  calendarDate.value = calendarDate.value || todayIso();
  await loadBookings();
}

pinForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setPinStatus("");
  const pin = new FormData(pinForm).get("pin");

  try {
    await openDashboard(pin);
  } catch (error) {
    sessionStorage.removeItem("diorPortalPin");
    setPinStatus(error.message, "error");
  }
});

async function switchCalendarView(nextView) {
  viewButtons.forEach((item) => item.classList.toggle("is-active", item.dataset.view === nextView));
  view = nextView;
  await loadBookings();
}

viewButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const nextView = button.dataset.view;
    if (view === "manager" && nextView !== "manager" && hasUnsavedScheduleChanges()) {
      openUnsavedScheduleModal(nextView);
      return;
    }
    await switchCalendarView(nextView);
  });
});

[calendarStaff, calendarDate].forEach((control) => {
  control?.addEventListener("change", loadBookings);
});

refreshCalendar?.addEventListener("click", async () => {
  calendarDate.value = todayIso();
  selectedBookingId = "";
  editingBookingId = "";
  bookingDetailsPinned = false;
  await loadSchedule();
  await loadBookings();
});

managePeopleButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  const isOpen = settingsMenu.hidden;
  settingsMenu.hidden = !isOpen;
  managePeopleButton.setAttribute("aria-expanded", String(isOpen));
});

calendarDate.value = todayIso();

async function saveScheduleDraft(statusElement = document.querySelector("#manager-status")) {
  const saveButtons = document.querySelectorAll("#save-schedule, [data-manager-save-leave]");
  const weekly = cloneSchedule(scheduleDraft.weekly || {});
  const overrideDates = cloneSchedule(scheduleDraftOverrides);

  saveButtons.forEach((button) => {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = "Saving...";
  });

  try {
    const response = await fetch("/api/schedule", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Portal-Pin": portalPin
      },
      body: JSON.stringify({
        weekly,
        ...(Object.keys(overrideDates).length ? { overrideDates } : {})
      })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to save schedule.");
    }

    scheduleData = data.schedule;
    resetScheduleDraft();
    if (statusElement) {
      statusElement.textContent = "Schedule saved.";
      statusElement.dataset.type = "";
    }
    return true;
  } catch (error) {
    if (statusElement) {
      statusElement.textContent = error.message;
      statusElement.dataset.type = "error";
    }
    return false;
  } finally {
    saveButtons.forEach((button) => {
      button.disabled = false;
      button.textContent = button.dataset.originalText || "Save Schedule";
      delete button.dataset.originalText;
    });
  }
}

calendarBoard?.addEventListener("click", async (event) => {
  const maximizeButton = event.target.closest("[data-maximize-calendar]");

  if (maximizeButton) {
    toggleCalendarMaximize();
    return;
  }

  const managerWeekButton = event.target.closest("[data-manager-week-direction]");

  if (managerWeekButton) {
    moveManagerWeek(Number(managerWeekButton.dataset.managerWeekDirection));
    return;
  }

  const navigationButton = event.target.closest("[data-calendar-direction]");

  if (navigationButton) {
    await moveCalendar(Number(navigationButton.dataset.calendarDirection));
    return;
  }

  const saveButton = event.target.closest("#save-schedule");

  if (!saveButton) {
    return;
  }

  if (await saveScheduleDraft()) {
    await loadBookings();
  }
});

async function moveCalendar(direction) {
  const current = new Date(`${calendarDate.value || todayIso()}T12:00:00`);

  if (view === "month") {
    current.setDate(1);
    current.setMonth(current.getMonth() + direction);
  } else {
    current.setDate(current.getDate() + direction * (view === "week" ? 7 : 1));
  }

  calendarDate.value = toIso(current);
  selectedBookingId = "";
  editingBookingId = "";
  bookingDetailsPinned = false;
  await loadBookings();
}

function toggleCalendarMaximize() {
  const isMaximized = calendarBoard.classList.toggle("is-calendar-maximized");
  document.body.classList.toggle("calendar-maximized", isMaximized);
  updateMaximizeLabels();
}

function updateMaximizeLabels() {
  const isMaximized = calendarBoard.classList.contains("is-calendar-maximized");

  document.querySelectorAll("[data-maximize-label]").forEach((label) => {
    label.textContent = isMaximized ? "Exit" : "Maximize";
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }

  if (calendarBoard.classList.contains("is-calendar-maximized")) {
    calendarBoard.classList.remove("is-calendar-maximized");
    document.body.classList.remove("calendar-maximized");
    updateMaximizeLabels();
  }
});

window.addEventListener("beforeunload", (event) => {
  if (view !== "manager" || !hasUnsavedScheduleChanges()) {
    return;
  }

  event.preventDefault();
  event.returnValue = "";
});

calendarBoard?.addEventListener("change", async (event) => {
  const weekInput = event.target.closest("#manager-week-date");

  if (weekInput) {
    calendarDate.value = weekInput.value || todayIso();
    renderCalendar();
    return;
  }

  const weeklyInput = event.target.closest("[data-weekly-staff]");

  if (weeklyInput) {
    const staffId = weeklyInput.dataset.weeklyStaff;
    const day = Number(weeklyInput.value);
    const days = new Set(scheduleDraft.weekly?.[staffId] || []);
    weeklyInput.checked ? days.add(day) : days.delete(day);
    scheduleDraft.weekly = scheduleDraft.weekly || {};
    scheduleDraft.weekly[staffId] = [...days].sort((a, b) => a - b);
    renderCalendar();
    return;
  }

  const dateInput = event.target.closest("[data-date-staff]");

  if (dateInput) {
    setDraftOverride(calendarDate.value || todayIso(), dateInput.dataset.dateStaff, dateInput.checked);
    renderCalendar();
    return;
  }

  const weekOverrideInput = event.target.closest("[data-week-date]");

  if (weekOverrideInput) {
    setDraftOverride(
      weekOverrideInput.dataset.weekDate,
      weekOverrideInput.dataset.weekDateStaff,
      weekOverrideInput.checked
    );
    renderCalendar();
  }
});

calendarBoard?.addEventListener("click", (event) => {
  const createSlot = event.target.closest("[data-create-slot]");

  if (createSlot) {
    closeBookingDetails();
    openStaffBookingModal({
      date: createSlot.dataset.date,
      time: createSlot.dataset.time,
      staffId: createSlot.dataset.staffId
    });
    return;
  }

  const editButton = event.target.closest("[data-edit-booking]");

  if (editButton) {
    editingBookingId = editButton.dataset.editBooking;
    selectedBookingId = editingBookingId;
    bookingDetailsPinned = true;
    renderCalendar();
    return;
  }

  if (event.target.closest("[data-cancel-edit-booking]")) {
    editingBookingId = "";
    renderCalendar();
    return;
  }

  if (event.target.closest("[data-close-booking-details]")) {
    closeBookingDetails();
    return;
  }

  const cancelButton = event.target.closest("[data-staff-cancel-booking]");

  if (cancelButton) {
    const booking = bookings.find((item) => item.id === cancelButton.dataset.staffCancelBooking);

    if (booking) {
      openStaffCancelModal(booking);
    }

    return;
  }

  const button = event.target.closest("[data-booking-id]");

  if (!button) {
    return;
  }

  showBookingDetails(button.dataset.bookingId, true);
});

calendarBoard?.addEventListener("pointerover", (event) => {
  if (!calendarBoard.classList.contains("is-calendar-maximized") || bookingDetailsPinned) {
    return;
  }

  const bookingButton = event.target.closest(".schedule-event[data-booking-id]");

  if (bookingButton) {
    showBookingDetails(bookingButton.dataset.bookingId, false);
  }
});

calendarBoard?.addEventListener("pointerout", (event) => {
  if (!calendarBoard.classList.contains("is-calendar-maximized") || bookingDetailsPinned) {
    return;
  }

  const bookingButton = event.target.closest(".schedule-event[data-booking-id]");

  if (!bookingButton) {
    return;
  }

  const nextTarget = event.relatedTarget;

  if (nextTarget instanceof Element && nextTarget.closest(".schedule-event[data-booking-id]") === bookingButton) {
    return;
  }

  scheduleBookingPreviewClose();
});

calendarBoard?.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-edit-booking-form]");

  if (!form) {
    return;
  }

  event.preventDefault();
  const bookingId = form.dataset.editBookingForm;
  const formData = Object.fromEntries(new FormData(form).entries());
  const selectedStaff = staff.find((person) => person.id === formData.staffId);
  const nameParts = formData.customerName.trim().split(/\s+/).filter(Boolean);
  const status = form.querySelector("#staff-edit-status");
  const submitButton = form.querySelector("button[type='submit']");

  submitButton.disabled = true;
  submitButton.textContent = "Saving...";
  status.textContent = "";

  try {
    const response = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Portal-Pin": portalPin
      },
      body: JSON.stringify({
        customerName: formData.customerName.trim(),
        firstName: nameParts[0] || "",
        lastName: nameParts.at(-1) || "",
        service: formData.service.trim(),
        staffId: formData.staffId,
        staffName: selectedStaff?.name || formData.staffId,
        date: formData.date,
        time: formData.time,
        phone: formData.phone.trim(),
        email: formData.email.trim().toLowerCase(),
        notes: formData.notes.trim()
      })
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to save appointment.");
    }

    editingBookingId = "";
    selectedBookingId = bookingId;
    await loadBookings();
    calendarBoard.insertAdjacentHTML("afterbegin", '<p class="form-status staff-action-status" role="status">Appointment updated.</p>');
  } catch (error) {
    status.textContent = error.message;
    status.dataset.type = "error";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Save Changes";
  }
});

function renderCustomerSearchResults(customers) {
  const results = document.querySelector("#staff-customer-results");

  if (!results) {
    return;
  }

  results.innerHTML = customers.length
    ? customers.map((customer) => `
        <button
          class="staff-customer-result"
          type="button"
          data-select-customer
          data-first-name="${escapeHtml(customer.firstName)}"
          data-last-name="${escapeHtml(customer.lastName)}"
          data-phone="${escapeHtml(customer.phone)}"
          data-email="${escapeHtml(customer.email || "")}"
          data-sms-consent="${customer.smsConsent ? "true" : "false"}"
        >
          <span class="staff-customer-result-info">
            <strong>${escapeHtml(customer.firstName)} ${escapeHtml(customer.lastName)}</strong>
            <small>${escapeHtml(customer.phone)}</small>
            <small>${escapeHtml(customer.email || "No email saved")}</small>
          </span>
        </button>
      `).join("")
    : "<p>No saved customers match that search.</p>";
}

document.addEventListener("input", (event) => {
  const searchInput = event.target.closest("#staff-customer-search");

  if (searchInput) {
    clearTimeout(customerSearchTimer);
    const query = searchInput.value.trim();
    const results = document.querySelector("#staff-customer-results");

    if (!query) {
      results.innerHTML = "<p>Start typing to search past customers.</p>";
      return;
    }

    results.innerHTML = "<p>Searching customers...</p>";
    customerSearchTimer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/customers?q=${encodeURIComponent(query)}`, {
          headers: { "X-Portal-Pin": portalPin }
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to search customers.");
        }

        renderCustomerSearchResults(data.customers || []);
      } catch (error) {
        results.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
      }
    }, 220);
    return;
  }

  const serviceSearch = event.target.closest("#staff-booking-service");
  if (serviceSearch) {
    const form = serviceSearch.closest("#staff-booking-form");
    resetStaffBookingBypass(form);
    const menu = form?.querySelector("#staff-booking-service-options");
    if (menu) {
      menu.innerHTML = staffBookingServiceOptions(serviceSearch.value);
      menu.classList.add("is-open");
      serviceSearch.setAttribute("aria-expanded", "true");
    }
    updateStaffBookingClosingLimit(form);
    return;
  }

  const workerSearch = event.target.closest("#staff-booking-worker");
  if (workerSearch) {
    const form = workerSearch.closest("#staff-booking-form");
    resetStaffBookingBypass(form);
    const menu = form?.querySelector("#staff-booking-worker-options");
    form.querySelector("#staff-booking-worker-id").value = "";
    if (menu) {
      menu.innerHTML = staffBookingWorkerOptions(workerSearch.value);
      menu.classList.add("is-open");
      workerSearch.setAttribute("aria-expanded", "true");
    }
    return;
  }

  const phoneInput = event.target.closest("#staff-booking-form input[name='phone']");

  if (phoneInput) {
    resetStaffBookingBypass(phoneInput.closest("#staff-booking-form"));
    phoneInput.value = formatPhone(phoneInput.value);
  }
});

document.addEventListener("focusin", (event) => {
  const serviceSearch = event.target.closest("#staff-booking-service");
  if (serviceSearch) {
    const menu = serviceSearch.closest("#staff-booking-form")?.querySelector("#staff-booking-service-options");
    if (menu) {
      menu.innerHTML = staffBookingServiceOptions();
      menu.classList.add("is-open");
      serviceSearch.setAttribute("aria-expanded", "true");
    }
    return;
  }

  const workerSearch = event.target.closest("#staff-booking-worker");
  if (workerSearch) {
    const menu = workerSearch.closest("#staff-booking-form")?.querySelector("#staff-booking-worker-options");
    if (menu) {
      menu.innerHTML = staffBookingWorkerOptions();
      menu.classList.add("is-open");
      workerSearch.setAttribute("aria-expanded", "true");
    }
  }
});

document.addEventListener("change", (event) => {
  const form = event.target.closest("#staff-booking-form");

  if (form) {
    resetStaffBookingBypass(form);
    if (event.target.matches("[name='service'], [name='date'], [name='time']")) {
      updateStaffBookingClosingLimit(form);
    }
  }
});

function resetStaffBookingBypass(form) {
  if (!form) return;
  form.dataset.bypassConstraints = "";
  form.querySelector("[data-bypass-staff-booking]")?.classList.add("is-hidden");
}

function showStaffBookingBypass(form, message) {
  const status = form.querySelector("#staff-booking-status");
  const bypassButton = form.querySelector("[data-bypass-staff-booking]");
  form.dataset.bypassConstraints = "";
  status.textContent = `${message} Staff can override this and book anyway if needed.`;
  status.dataset.type = "error";
  bypassButton?.classList.remove("is-hidden");
}

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("#staff-booking-form");

  if (!form) {
    return;
  }

  event.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  const status = form.querySelector("#staff-booking-status");
  const submitButton = form.querySelector("button[type='submit']");
  const bypassButton = form.querySelector("[data-bypass-staff-booking]");
  const isBypassSubmit = form.dataset.bypassConstraints === "true";
  data.phone = phoneDigits(data.phone);
  data.bypassConstraints = isBypassSubmit;

  if (!staff.some((person) => person.id === data.staffId)) {
    status.textContent = "Choose a nail tech from the matching list.";
    status.dataset.type = "error";
    form.querySelector("#staff-booking-worker")?.focus();
    return;
  }

  if (data.phone.length !== 10) {
    status.textContent = "Enter a full 10 digit phone number.";
    status.dataset.type = "error";
    return;
  }

  submitButton.disabled = true;
  if (bypassButton) bypassButton.disabled = true;
  submitButton.textContent = isBypassSubmit ? "Booking Anyway..." : "Creating...";
  status.textContent = "";
  status.dataset.type = "";

  try {
    const response = await fetch("/api/staff-bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Portal-Pin": portalPin
      },
      body: JSON.stringify(data)
    });
    const result = await response.json();

    if (!response.ok) {
      if (result.canBypass) {
        showStaffBookingBypass(form, result.error || "That appointment conflicts with the schedule.");
        return;
      }
      throw new Error(result.error || "Unable to create appointment.");
    }

    closeStaffBookingModal();
    selectedBookingId = result.booking.id;
    bookingDetailsPinned = true;
    const sentChannels = (result.booking.notifications || [])
      .filter((notification) => notification.ok)
      .map((notification) => notification.channel === "sms" ? "text" : notification.channel);
    const notice = sentChannels.length ? ` Confirmation sent by ${sentChannels.join(" and ")}.` : "";
    await loadBookings();
    calendarBoard.insertAdjacentHTML("afterbegin", `<p class="form-status staff-action-status" role="status">Appointment created.${notice}</p>`);
  } catch (error) {
    status.textContent = error.message;
    status.dataset.type = "error";
  } finally {
    submitButton.disabled = false;
    if (bypassButton) bypassButton.disabled = false;
    submitButton.textContent = "Create Appointment";
  }
});

document.addEventListener("click", async (event) => {
  const bypassButton = event.target.closest("[data-bypass-staff-booking]");
  if (bypassButton) {
    const form = bypassButton.closest("#staff-booking-form");
    if (form) {
      form.dataset.bypassConstraints = "true";
      form.requestSubmit();
    }
    return;
  }

  const selectedService = event.target.closest("[data-staff-booking-service]");
  if (selectedService) {
    const form = selectedService.closest("#staff-booking-form");
    const input = form?.querySelector("#staff-booking-service");
    const menu = form?.querySelector("#staff-booking-service-options");
    if (input && menu) {
      resetStaffBookingBypass(form);
      input.value = selectedService.dataset.staffBookingService;
      input.setAttribute("aria-expanded", "false");
      menu.classList.remove("is-open");
      updateStaffBookingClosingLimit(form);
    }
    return;
  }

  const selectedWorker = event.target.closest("[data-staff-booking-worker]");
  if (selectedWorker) {
    const form = selectedWorker.closest("#staff-booking-form");
    const input = form?.querySelector("#staff-booking-worker");
    const idInput = form?.querySelector("#staff-booking-worker-id");
    const menu = form?.querySelector("#staff-booking-worker-options");
    if (input && idInput && menu) {
      resetStaffBookingBypass(form);
      input.value = selectedWorker.dataset.staffBookingWorkerName;
      idInput.value = selectedWorker.dataset.staffBookingWorker;
      input.setAttribute("aria-expanded", "false");
      menu.classList.remove("is-open");
    }
    return;
  }

  const settingsChoice = event.target.closest("[data-open-people]");
  if (settingsChoice) {
    await openPeopleModal(settingsChoice.dataset.openPeople);
    return;
  }

  if (!event.target.closest(".settings-menu-wrap") && !settingsMenu.hidden) {
    settingsMenu.hidden = true;
    managePeopleButton.setAttribute("aria-expanded", "false");
  }

  if (!event.target.closest(".staff-booking-search-select")) {
    document.querySelectorAll(".staff-booking-search-select .search-select-menu").forEach((menu) => menu.classList.remove("is-open"));
    document.querySelectorAll(".staff-booking-search-select [role='combobox']").forEach((input) => input.setAttribute("aria-expanded", "false"));
  }

  const savePeopleButton = event.target.closest("[data-save-people]");
  if (savePeopleButton) {
    const form = savePeopleButton.closest("#employee-record-form, #customer-record-form, #service-record-form");
    if (form) {
      await savePeopleForm(form);
    }
    return;
  }

  if (event.target.closest("[data-manager-stay]")) {
    closeUnsavedScheduleModal();
    return;
  }

  if (event.target.closest("[data-manager-discard]")) {
    const nextView = pendingManagerView;
    resetScheduleDraft();
    closeUnsavedScheduleModal();
    await switchCalendarView(nextView);
    return;
  }

  const saveAndLeave = event.target.closest("[data-manager-save-leave]");
  if (saveAndLeave) {
    const nextView = pendingManagerView;
    const status = document.querySelector("#unsaved-schedule-status");
    if (await saveScheduleDraft(status)) {
      closeUnsavedScheduleModal();
      await switchCalendarView(nextView);
    }
    return;
  }

  if (event.target.id === "unsaved-schedule-modal") {
    closeUnsavedScheduleModal();
    return;
  }

  if (event.target.closest("[data-close-people]") || event.target.id === "people-modal") {
    document.querySelector("#people-modal")?.remove();
    return;
  }

  const peopleRecord = event.target.closest("[data-edit-people-record]");
  if (peopleRecord) {
    fillPeopleForm(peopleRecord.dataset.editPeopleRecord);
    return;
  }

  const removePeopleButton = event.target.closest("[data-remove-people-record]");
  if (removePeopleButton) {
    await removePeopleRecord(removePeopleButton.dataset.removePeopleRecord);
    return;
  }

  if (event.target.closest("[data-clear-people-form]")) {
    clearPeopleForm();
    return;
  }

  const selectedCustomer = event.target.closest("[data-select-customer]");

  if (selectedCustomer) {
    const form = selectedCustomer.closest("#staff-booking-modal")?.querySelector("#staff-booking-form");

    if (form) {
      form.elements.firstName.value = selectedCustomer.dataset.firstName;
      form.elements.lastName.value = selectedCustomer.dataset.lastName;
      form.elements.phone.value = selectedCustomer.dataset.phone;
      form.elements.email.value = selectedCustomer.dataset.email;
      form.elements.smsConsent.checked = selectedCustomer.dataset.smsConsent === "true";
      document.querySelector("#staff-customer-search").value = `${selectedCustomer.dataset.firstName} ${selectedCustomer.dataset.lastName}`;
      document.querySelector("#staff-customer-results").innerHTML = "<p>Saved customer selected.</p>";
    }
    return;
  }

  if (event.target.closest("[data-close-staff-booking]") || event.target.id === "staff-booking-modal") {
    closeStaffBookingModal();
    return;
  }

  if (event.target.closest("#staff-keep-appointment") || event.target.id === "staff-cancel-modal") {
    closeStaffCancelModal();
    return;
  }

  const confirmButton = event.target.closest("#staff-confirm-cancel");

  if (!confirmButton || !pendingStaffCancel) {
    return;
  }

  confirmButton.disabled = true;
  confirmButton.textContent = "Cancelling...";

  try {
    const response = await fetch(`/api/bookings/${pendingStaffCancel.id}/cancel`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Portal-Pin": portalPin
      }
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to cancel appointment.");
    }

    const sentChannels = (result.booking?.cancellationNotifications || [])
      .filter((notification) => notification.ok)
      .map((notification) => notification.channel === "sms" ? "text" : notification.channel);
    const notice = sentChannels.length
      ? ` Cancellation notice sent by ${sentChannels.join(" and ")}.`
      : " Cancellation saved. Email/text cancellation notice could not be sent yet.";

    closeStaffCancelModal();
    selectedBookingId = "";
    bookingDetailsPinned = false;
    await loadBookings();
    calendarBoard.insertAdjacentHTML("afterbegin", `<p class="form-status staff-action-status" role="status">Appointment cancelled.${notice}</p>`);
  } catch (error) {
    confirmButton.disabled = false;
    confirmButton.textContent = "Cancel Appointment";
    const status = document.querySelector("#staff-cancel-status");

    if (status) {
      status.textContent = error.message;
      status.dataset.type = "error";
    }
  }
});

document.addEventListener("input", (event) => {
  if (event.target.matches("[data-people-filter]")) {
    filterPeopleRecords(event.target.value);
  }
});

async function savePeopleForm(form) {
  const status = form.querySelector("[data-people-status]");
  const submitButton = form.querySelector("[data-save-people]");
  const data = Object.fromEntries(new FormData(form));
  const isEmployee = form.getAttribute("id") === "employee-record-form";
  const isService = form.getAttribute("id") === "service-record-form";
  const birthday = isEmployee || isService ? { value: "", valid: true } : normalizeBirthdayInput(data.birthday);
  if (!birthday.valid) {
    status.textContent = "Enter date of birth as MM/DD/YYYY.";
    return;
  }
  const id = data.id;
  const endpoint = isEmployee ? "/api/staff-records" : isService ? "/api/services" : "/api/customers";
  const payload = isEmployee
    ? {
        name: data.name,
        phone: data.phone,
        email: data.email,
        active: data.active === "on"
      }
    : isService
      ? {
          name: data.name,
          category: data.category,
          price: Number(data.price),
          durationMinutes: Number(data.durationMinutes),
          active: data.active === "on"
        }
      : {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email,
        birthday: birthday.value,
        smsConsent: data.smsConsent === "on"
      };

  submitButton.disabled = true;
  submitButton.textContent = "Saving...";
  status.textContent = "";

  try {
    const response = await fetch(`${endpoint}${id ? `/${encodeURIComponent(id)}` : ""}`, {
      method: id ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Portal-Pin": portalPin
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Unable to save record.");
    }

    if (isEmployee) {
      const hadDraft = hasUnsavedScheduleChanges();
      const previousDraft = cloneSchedule(scheduleDraft);
      const previousDraftOverrides = cloneSchedule(scheduleDraftOverrides);
      await loadConfig();
      const scheduleResponse = await fetch("/api/schedule", { headers: { "X-Portal-Pin": portalPin } });
      const scheduleResult = await scheduleResponse.json();
      scheduleData = scheduleResult.schedule;
      if (hadDraft) {
        scheduleDraft = {
          weekly: { ...scheduleData.weekly, ...previousDraft.weekly },
          overrides: { ...scheduleData.overrides, ...previousDraft.overrides }
        };
        scheduleDraftOverrides = previousDraftOverrides;
      } else {
        resetScheduleDraft();
      }
    } else if (isService) {
      await loadConfig();
    }

    await loadPeopleRecords();
    renderPeopleWorkspace();
    const nextForm = document.querySelector(isEmployee ? "#employee-record-form" : "#customer-record-form");
    const nextStatus = nextForm?.querySelector("[data-people-status]");
    if (nextStatus) {
      nextStatus.textContent = `${isEmployee ? "Employee" : isService ? "Service" : "Customer"} saved successfully.`;
      nextStatus.dataset.type = "success";
    }
    if (isEmployee) {
      await loadBookings();
    }
  } catch (error) {
    status.textContent = error.message;
    status.dataset.type = "error";
  } finally {
    submitButton.disabled = false;
    const label = isEmployee ? "Employee" : isService ? "Service" : "Customer";
    submitButton.textContent = id ? `Save ${label}` : `Add ${label}`;
  }
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeStaffCancelModal();
    closeStaffBookingModal();
  }
});

if (portalPin) {
  openDashboard(portalPin).catch(() => {
    sessionStorage.removeItem("diorPortalPin");
    portalPin = "";
  });
}

setInterval(updateCurrentTimeMarker, 60_000);
setInterval(async () => {
  if (!portalPin || editingBookingId || document.hidden) return;
  try {
    await loadBookings();
  } catch (error) {
    console.warn("Calendar refresh failed", error);
  }
}, 60_000);
