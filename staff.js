const loginPanel = document.querySelector("#portal-login");
const dashboard = document.querySelector("#staff-dashboard");
const pinForm = document.querySelector("#pin-form");
const pinStatus = document.querySelector("#pin-status");
const calendarStaff = document.querySelector("#calendar-staff");
const calendarDate = document.querySelector("#calendar-date");
const calendarBoard = document.querySelector("#calendar-board");
const refreshCalendar = document.querySelector("#refresh-calendar");
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
let pendingStaffCancel = null;

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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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
  const weekday = date.toLocaleDateString([], { weekday: "short" });
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${weekday} ${month}/${day}/${year}`;
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

async function loadConfig() {
  const response = await fetch("/api/config");
  const config = await response.json();
  staff = config.staff.filter((person) => person.id !== "any");
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
      <a href="mailto:${booking.email}">${booking.email}</a>
      ${notes}
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

function maximizeButton(label = "calendar") {
  return `
    <button class="calendar-maximize-button" type="button" data-maximize-calendar aria-label="Maximize ${label}">
      <span data-maximize-label>Maximize</span>
    </button>
  `;
}

function renderSchedule(columns, days, compact = false) {
  const range = scheduleRange(days);
  const labels = scheduleLabels(range.open, range.close);
  const totalMinutes = range.close - range.open;

  return `
    <div class="schedule-calendar" style="--calendar-minutes: ${totalMinutes}; --schedule-columns: ${columns.length};">
      <div class="schedule-header">
        <div class="schedule-corner"></div>
        ${columns.map((column) => `<div class="schedule-heading">${escapeHtml(column.title)}</div>`).join("")}
      </div>
      <div class="schedule-body">
        <div class="schedule-times">
          ${labels.map((minutes) => `
            <span style="--time-offset: ${Math.max(0, minutes - range.open)};">${displayTime(minutesToTime(minutes))}</span>
          `).join("")}
        </div>
        ${columns.map((column) => {
          return `
          <section class="schedule-column" aria-label="${escapeHtml(column.title)}">
            ${labels.map((minutes) => `
              <div class="schedule-line" style="--line-offset: ${Math.max(0, minutes - range.open)};"></div>
            `).join("")}
            ${groupedBookingsByTime(column.bookings).map((group) => renderScheduleEvent(group[0], range.open, compact, group.length, group)).join("")}
          </section>
        `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderDay() {
  const date = calendarDate.value || todayIso();
  const selectedStaffId = calendarStaff.value || "all";
  const isSingleWorker = selectedStaffId !== "all";
  const visibleStaff = selectedStaffId === "all"
    ? staff
    : staff.filter((person) => person.id === selectedStaffId);
  const columns = visibleStaff.map((person) => ({
    title: `${person.name} - ${displayDate(date)}`,
    bookings: bookings
      .filter((booking) => booking.date === date && booking.staffId === person.id)
      .sort((a, b) => a.time.localeCompare(b.time))
  }));
  const appointmentCount = columns.reduce((sum, column) => sum + column.bookings.length, 0);

  calendarBoard.innerHTML = `
    <div class="calendar-day" data-calendar-panel>
      <div class="calendar-day-heading">
        <div>
          <h2>${displayDate(date)}</h2>
          <span>${appointmentCount} appointment${appointmentCount === 1 ? "" : "s"}</span>
        </div>
        ${maximizeButton("day calendar")}
      </div>
      ${columns.length ? `
        <div class="staff-calendar-layout ${isSingleWorker ? "staff-calendar-layout-wide" : ""}">
          ${renderSchedule(columns, [date], true)}
          ${renderBookingDetails()}
        </div>
      ` : '<p class="slot-empty">No nail techs available.</p>'}
    </div>
  `;
}

function renderWeek() {
  const range = getRange();
  const start = new Date(`${range.from}T12:00:00`);
  const days = Array.from({ length: 7 }, (_, index) => toIso(addDays(start, index)));
  const selectedStaffId = calendarStaff.value || "all";
  const selectedStaffName = staff.find((person) => person.id === selectedStaffId)?.name;
  const columns = days.map((day) => ({
    title: displayDate(day),
    bookings: bookings
      .filter((booking) => booking.date === day)
      .sort((a, b) => a.time.localeCompare(b.time))
  }));
  const appointmentCount = columns.reduce((sum, column) => sum + column.bookings.length, 0);

  calendarBoard.innerHTML = `
    <div class="calendar-day" data-calendar-panel>
      <div class="calendar-day-heading">
        <div>
          <h2>${selectedStaffName ? `${selectedStaffName}'s week` : "All workers week"}</h2>
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
            <span>Email</span>
            <input name="email" type="email" value="${escapeHtml(booking.email)}" required />
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
        <button class="button button-secondary button-compact" type="button" data-edit-booking="${escapeHtml(booking.id)}">Edit</button>
      </div>
      <dl>
        <div><dt>Service</dt><dd>${escapeHtml(booking.service)}</dd></div>
        <div><dt>Nail tech</dt><dd>${escapeHtml(booking.staffName)}</dd></div>
        <div><dt>Time reserved</dt><dd>${appointmentTimeRange(booking)} (${Number(booking.durationMinutes || 60)} minutes)</dd></div>
        <div><dt>Phone</dt><dd><a href="tel:${escapeHtml(booking.phone)}">${escapeHtml(booking.phone)}</a></dd></div>
        <div><dt>Email</dt><dd><a href="mailto:${escapeHtml(booking.email)}">${escapeHtml(booking.email)}</a></dd></div>
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
        <div>
          <h2>${monthName}</h2>
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
  const override = scheduleData.overrides?.[dateString]?.[person.id];

  if (typeof override === "boolean") {
    return override;
  }

  const weeklyDays = scheduleData.weekly?.[person.id] || person.workDays || [];
  return weeklyDays.includes(day);
}

function isWeeklyDayChecked(staffId, day) {
  return (scheduleData.weekly?.[staffId] || []).includes(day);
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
        <h3>Selected week: ${displayDate(weekDates[0])} - ${displayDate(weekDates[6])}</h3>
        <p>Use this for one-week exceptions. Only boxes you change here are saved as date-specific changes.</p>
        <div class="week-override-table">
          <div class="week-override-header">
            <span>Employee</span>
            ${weekDates.map((day) => `<span>${displayDate(day)}</span>`).join("")}
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
                  <span>Working</span>
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
  const workerIds = new Set(bookings.map((booking) => booking.staffId));
  summaryCount.textContent = String(bookings.length);
  summaryWorkers.textContent = String(workerIds.size);
  summaryView.textContent = view[0].toUpperCase() + view.slice(1);

  if (view === "manager") {
    renderManager();
    return;
  }

  if (view === "week") {
    renderWeek();
    return;
  }

  if (view === "month") {
    renderMonth();
    return;
  }

  renderDay();
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

viewButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    viewButtons.forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    view = button.dataset.view;
    await loadBookings();
  });
});

[calendarStaff, calendarDate, refreshCalendar].forEach((control) => {
  control?.addEventListener("change", loadBookings);
  control?.addEventListener("click", () => {
    if (control === refreshCalendar) {
      loadBookings();
    }
  });
});

calendarDate.value = todayIso();

calendarBoard?.addEventListener("click", async (event) => {
  const maximizeButton = event.target.closest("[data-maximize-calendar]");

  if (maximizeButton) {
    const panel = maximizeButton.closest("[data-calendar-panel]");
    await toggleCalendarMaximize(panel);
    return;
  }

  const saveButton = event.target.closest("#save-schedule");

  if (!saveButton) {
    return;
  }

  const weekly = {};
  const overrides = {};
  const overrideDates = {};
  const date = calendarDate.value || todayIso();
  const managerStatus = document.querySelector("#manager-status");

  staff.forEach((person) => {
    weekly[person.id] = [...document.querySelectorAll(`[data-weekly-staff="${person.id}"]:checked`)]
      .map((input) => Number(input.value));
    const dateInput = document.querySelector(`[data-date-staff="${person.id}"]`);
    if (dateInput?.dataset.dirty === "true") {
      overrides[person.id] = Boolean(dateInput.checked);
    }
  });

  document.querySelectorAll("[data-week-date]").forEach((input) => {
    if (input.dataset.dirty !== "true") {
      return;
    }

    const dateValue = input.dataset.weekDate;
    const staffId = input.dataset.weekDateStaff;
    overrideDates[dateValue] = overrideDates[dateValue] || {};
    overrideDates[dateValue][staffId] = input.checked;
  });

  saveButton.disabled = true;
  saveButton.textContent = "Saving...";

  try {
    const response = await fetch("/api/schedule", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Portal-Pin": portalPin
      },
      body: JSON.stringify({
        weekly,
        ...(Object.keys(overrides).length ? { date, overrides } : {}),
        ...(Object.keys(overrideDates).length ? { overrideDates } : {})
      })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to save schedule.");
    }

    scheduleData = data.schedule;
    managerStatus.textContent = "Schedule saved.";
    managerStatus.dataset.type = "";
    await loadBookings();
  } catch (error) {
    managerStatus.textContent = error.message;
    managerStatus.dataset.type = "error";
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Save Schedule";
  }
});

async function toggleCalendarMaximize(panel) {
  if (!panel) {
    return;
  }

  const fallbackPanel = document.querySelector(".is-calendar-maximized");

  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }

  if (fallbackPanel) {
    fallbackPanel.classList.remove("is-calendar-maximized");
    document.body.classList.remove("calendar-maximized");
    updateMaximizeLabels();
    return;
  }

  try {
    if (panel.requestFullscreen) {
      await panel.requestFullscreen();
      return;
    }
  } catch (error) {
  }

  panel.classList.add("is-calendar-maximized");
  document.body.classList.add("calendar-maximized");
  updateMaximizeLabels();
}

function updateMaximizeLabels() {
  const isMaximized = Boolean(document.fullscreenElement || document.querySelector(".is-calendar-maximized"));

  document.querySelectorAll("[data-maximize-label]").forEach((label) => {
    label.textContent = isMaximized ? "Exit" : "Maximize";
  });
}

document.addEventListener("fullscreenchange", updateMaximizeLabels);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }

  const fallbackPanel = document.querySelector(".is-calendar-maximized");

  if (fallbackPanel) {
    fallbackPanel.classList.remove("is-calendar-maximized");
    document.body.classList.remove("calendar-maximized");
    updateMaximizeLabels();
  }
});

calendarBoard?.addEventListener("change", async (event) => {
  const weekInput = event.target.closest("#manager-week-date");

  if (weekInput) {
    calendarDate.value = weekInput.value || todayIso();
    await loadBookings();
    return;
  }

  const overrideInput = event.target.closest("[data-date-staff], [data-week-date]");

  if (overrideInput) {
    overrideInput.dataset.dirty = "true";
  }
});

calendarBoard?.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-booking]");

  if (editButton) {
    editingBookingId = editButton.dataset.editBooking;
    selectedBookingId = editingBookingId;
    renderCalendar();
    return;
  }

  if (event.target.closest("[data-cancel-edit-booking]")) {
    editingBookingId = "";
    renderCalendar();
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

  selectedBookingId = button.dataset.bookingId;
  editingBookingId = "";
  renderCalendar();
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

document.addEventListener("click", async (event) => {
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
      .map((notification) => notification.channel);
    const notice = sentChannels.length
      ? ` Cancellation notice sent by ${sentChannels.join(" and ")}.`
      : " Cancellation saved. Email/text cancellation notice could not be sent yet.";

    closeStaffCancelModal();
    selectedBookingId = "";
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

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeStaffCancelModal();
  }
});

if (portalPin) {
  openDashboard(portalPin).catch(() => {
    sessionStorage.removeItem("diorPortalPin");
    portalPin = "";
  });
}
