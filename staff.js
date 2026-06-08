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
let scheduleData = { weekly: {}, overrides: {} };

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

function scheduleRange(days) {
  const ranges = days.map(getHours);
  return {
    open: Math.min(...ranges.map((range) => timeToMinutes(range.open))),
    close: Math.max(...ranges.map((range) => timeToMinutes(range.close)))
  };
}

function getRange() {
  const selected = new Date(`${calendarDate.value || todayIso()}T12:00:00`);

  if (view === "day") {
    return { from: toIso(selected), to: toIso(selected) };
  }

  if (view === "week") {
    const day = selected.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = addDays(selected, mondayOffset);
    return { from: toIso(monday), to: toIso(addDays(monday, 6)) };
  }

  const first = new Date(selected.getFullYear(), selected.getMonth(), 1, 12);
  const last = new Date(selected.getFullYear(), selected.getMonth() + 1, 0, 12);
  return { from: toIso(first), to: toIso(last) };
}

function setPinStatus(message, type = "") {
  pinStatus.textContent = message;
  pinStatus.dataset.type = type;
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
    <article class="appointment-card">
      <div>
        <strong>${displayTime(booking.time)} - ${displayTime(addHour(booking.time))}</strong>
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

function addHour(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return `${String(hours + 1).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function scheduleLabels(open, close) {
  const firstHour = Math.floor(open / 60) * 60;
  const labels = [];

  for (let minutes = firstHour; minutes <= close; minutes += 60) {
    labels.push(minutes);
  }

  return labels;
}

function renderScheduleEvent(booking, open, compact = false) {
  const start = timeToMinutes(booking.time);
  const duration = Number(booking.durationMinutes || 60);
  const notes = booking.notes ? `<span class="schedule-event-notes">${escapeHtml(booking.notes)}</span>` : "";
  const eventClass = compact ? "schedule-event schedule-event-compact" : "schedule-event";

  return `
    <button
      class="${eventClass}"
      style="--event-start: ${Math.max(0, start - open)}; --event-duration: ${duration};"
      title="${escapeHtml(`${booking.customerName} - ${booking.service}`)}"
      type="button"
      data-booking-id="${escapeHtml(booking.id)}"
    >
      <strong>${displayTime(booking.time)} ${escapeHtml(booking.customerName)}</strong>
      <span>${escapeHtml(booking.service)}</span>
      <span>${escapeHtml(booking.staffName)}</span>
      ${compact ? "" : `<span>${escapeHtml(booking.phone)}</span>${notes}`}
    </button>
  `;
}

function renderSchedule(columns, days, compact = false) {
  const range = scheduleRange(days);
  const labels = scheduleLabels(range.open, range.close);
  const totalMinutes = range.close - range.open;

  return `
    <div class="schedule-calendar" style="--calendar-minutes: ${totalMinutes};">
      <div class="schedule-header" style="grid-template-columns: 5.2rem repeat(${columns.length}, minmax(12rem, 1fr));">
        <div class="schedule-corner"></div>
        ${columns.map((column) => `<div class="schedule-heading">${escapeHtml(column.title)}</div>`).join("")}
      </div>
      <div class="schedule-body">
        <div class="schedule-times">
          ${labels.map((minutes) => `
            <span style="--time-offset: ${Math.max(0, minutes - range.open)};">${displayTime(minutesToTime(minutes))}</span>
          `).join("")}
        </div>
        <div class="schedule-columns" style="grid-template-columns: repeat(${columns.length}, minmax(12rem, 1fr));">
          ${columns.map((column) => `
            <section class="schedule-column" aria-label="${escapeHtml(column.title)}">
              ${labels.map((minutes) => `
                <div class="schedule-line" style="--line-offset: ${Math.max(0, minutes - range.open)};"></div>
              `).join("")}
              ${column.bookings.map((booking) => renderScheduleEvent(booking, range.open, compact)).join("")}
            </section>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderDay() {
  const date = calendarDate.value || todayIso();
  const selectedStaffId = calendarStaff.value || "all";
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
    <div class="calendar-day">
      <div class="calendar-day-heading">
        <h2>${displayDate(date)}</h2>
        <span>${appointmentCount} appointment${appointmentCount === 1 ? "" : "s"}</span>
      </div>
      ${columns.length ? `
        <div class="staff-calendar-layout">
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
    <div class="calendar-day">
      <div class="calendar-day-heading">
        <h2>${selectedStaffName ? `${selectedStaffName}'s week` : "All workers week"}</h2>
        <span>${appointmentCount} appointment${appointmentCount === 1 ? "" : "s"}</span>
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

  return `
    <aside class="week-detail-panel">
      <span>${displayDate(booking.date)} at ${displayTime(booking.time)}</span>
      <h2>${escapeHtml(booking.customerName)}</h2>
      <dl>
        <div><dt>Service</dt><dd>${escapeHtml(booking.service)}</dd></div>
        <div><dt>Nail tech</dt><dd>${escapeHtml(booking.staffName)}</dd></div>
        <div><dt>Phone</dt><dd><a href="tel:${escapeHtml(booking.phone)}">${escapeHtml(booking.phone)}</a></dd></div>
        <div><dt>Email</dt><dd><a href="mailto:${escapeHtml(booking.email)}">${escapeHtml(booking.email)}</a></dd></div>
        <div><dt>Notes</dt><dd>${escapeHtml(booking.notes || "None")}</dd></div>
      </dl>
    </aside>
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
    <div class="month-calendar">
      <div class="month-calendar-heading">
        <h2>${monthName}</h2>
        <span>Employee work schedule</span>
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
                  ? workingStaff.map((person) => `<span>${escapeHtml(person.name)}</span>`).join("")
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
          <p>Checked means this employee normally works that weekday every week.</p>
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
          <p>Smaller date override. Checked means working this date only.</p>
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
        <p>Use this to set or adjust a future week without changing the normal weekly schedule.</p>
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
    overrides[person.id] = Boolean(dateInput?.checked);
  });

  document.querySelectorAll("[data-week-date]").forEach((input) => {
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
      body: JSON.stringify({ weekly, date, overrides, overrideDates })
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

calendarBoard?.addEventListener("change", async (event) => {
  const weekInput = event.target.closest("#manager-week-date");

  if (!weekInput) {
    return;
  }

  calendarDate.value = weekInput.value || todayIso();
  await loadBookings();
});

calendarBoard?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-booking-id]");

  if (!button) {
    return;
  }

  selectedBookingId = button.dataset.bookingId;
  renderCalendar();
});

if (portalPin) {
  openDashboard(portalPin).catch(() => {
    sessionStorage.removeItem("diorPortalPin");
    portalPin = "";
  });
}
