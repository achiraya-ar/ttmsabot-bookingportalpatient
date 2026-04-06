// =====================================================================
//      ระบบจองคิวแพทย์แผนไทย - Patient Portal v2.13 (UX & Bug Fix)
//      อัปเดต: แก้ไขการบันทึกภาพ และปรับปรุง Popup ไม่ให้ปิดอัตโนมัติ
// =====================================================================

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// --- การตั้งค่าหลัก (อ่านจาก Vite environment: import.meta.env) ---
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing Supabase configuration. Define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env (Vite) environment.",
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- ค่าคงที่และ Global State ---
const SUPABASE_ERROR_CODE_NO_ROWS = "PGRST116";
let currentPatient = null;
let currentDate = new Date();
let currentFilters = {};

// --- Helper Functions ---
function formatDateToYYYYMMDD(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function formatThaiDate(dateString, withWeekday = true) {
  if (!dateString) return "";
  const date = new Date(dateString + "T00:00:00");
  const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Bangkok",
  };
  if (withWeekday) {
    options.weekday = "long";
  }
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", options).format(date);
}
function validateThaiId(id) {
  if (id == null || id.length !== 13 || !/^[0-9]\d+$/.test(id)) {
    return false;
  }
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(id.charAt(i)) * (13 - i);
  }
  const check = (11 - (sum % 11)) % 10;
  return check === parseInt(id.charAt(12));
}
function isMobile() {
  return window.innerWidth <= 768;
}
function animateCounter(element, targetNumber) {
  if (isNaN(targetNumber) || targetNumber === null) {
    element.textContent = "N/A";
    return;
  }
  const duration = 1500;
  const startNumber = 0;
  const startTime = performance.now();
  function update(currentTime) {
    const elapsedTime = currentTime - startTime;
    const progress = Math.min(elapsedTime / duration, 1);
    const currentNumber = Math.floor(
      progress * (targetNumber - startNumber) + startNumber,
    );
    element.textContent = currentNumber.toLocaleString("en-US");
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = targetNumber.toLocaleString("en-US");
    }
  }
  requestAnimationFrame(update);
}

// --- [EDITED] โค้ดสร้าง HTML ใบนัดหมายดีไซน์ใหม่สำหรับผู้สูงวัย ---
function generateSlipHTML(booking) {
  const patientFullName =
    `${booking.patientFirstName || booking.patient_first_name || ""} ${booking.patientLastName || booking.patient_last_name || ""}`.trim();
  const patientPhone = booking.patientPhone || booking.patient_phone || "-";
  const therapistName =
    booking.therapist || booking.therapist_name || "ไม่ระบุ";
  const bookingDate = booking.date || booking.booking_date;
  const bookingTime = (booking.time || booking.booking_time).slice(0, 5);

  return `
    <div class="slip-container classic-design elderly-friendly" id="slip-to-print">
      <div class="slip-header">
        <h2>โรงพยาบาลสระโบสถ์</h2>
        <p>กลุ่มงานการแพทย์แผนไทย</p>
        <h1>ใบนัดหมาย</h1>
      </div>

      <div class="slip-body">
        <div class="slip-section">
          <h3>ข้อมูลการนัดหมาย</h3>
          <div class="detail-grid">
            <p><strong>วันที่:</strong> <span>${formatThaiDate(bookingDate)}</span></p>
            <p><strong>เวลา:</strong> <span>${bookingTime} น.</span></p>
            <p><strong>ชื่อหมอ:</strong> <span>${therapistName}</span></p>
          </div>
        </div>

        <div class="slip-section">
          <h3>ข้อมูลผู้ป่วย</h3>
          <div class="detail-grid">
            <p><strong>ชื่อ-นามสกุล:</strong> <span>${patientFullName}</span></p>
            <p><strong>เบอร์โทรศัพท์:</strong> <span>${patientPhone}</span></p>
          </div>
        </div>
      </div>

      <div class="slip-footer">
        <p class="instruction-line">กรุณามาก่อนเวลานัด และแสดงใบนัดนี้แก่เจ้าหน้าที่</p>
        <p class="phone-number">สอบถามเพิ่มเติม โทร. <strong>082-202-9667</strong></p>
      </div>
    </div>
  `;
}

function createPrintSlip(booking) {
  const printContentHtml = generateSlipHTML(booking);
  const printElement = document.createElement("div");
  printElement.id = "appointment-slip-print-container";
  printElement.innerHTML = printContentHtml;
  document.body.appendChild(printElement);
  window.print();
  document.body.removeChild(printElement);
}
async function captureAndSaveSlip(booking) {
  const slipHtml = generateSlipHTML(booking);
  const slipElement = document.createElement("div");
  slipElement.style.position = "absolute";
  slipElement.style.left = "-9999px";
  slipElement.innerHTML = slipHtml;
  document.body.appendChild(slipElement);
  try {
    const canvas = await html2canvas(
      slipElement.querySelector(".slip-container"),
      { scale: 2 },
    );
    const imageURL = canvas.toDataURL("image/png");
    const downloadLink = document.createElement("a");
    downloadLink.href = imageURL;
    downloadLink.download = `ใบนัด-${booking.date || booking.booking_date}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  } catch (err) {
    console.error("Error capturing slip:", err);
    Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถบันทึกรูปภาพได้", "error");
  } finally {
    document.body.removeChild(slipElement);
  }
}
function generateCalendarLink(booking) {
  const title = encodeURIComponent(
    `นัดหมายแพทย์แผนไทย: ${booking.therapist || booking.therapist_name}`,
  );
  const description = encodeURIComponent(
    `นัดหมายกับ ${booking.therapist || booking.therapist_name} ที่โรงพยาบาลสระโบสถ์`,
  );
  const location = encodeURIComponent(
    "กลุ่มงานการแพทย์แผนไทย โรงพยาบาลสระโบสถ์",
  );
  const [year, month, day] = (booking.date || booking.booking_date).split("-");
  const [hours, minutes] = (booking.time || booking.booking_time).split(":");
  const startTime = new Date(year, month - 1, day, hours, minutes);
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
  const formatDateForGoogle = (date) =>
    date.toISOString().replace(/-|:|\.\d\d\d/g, "");
  const startDateGoogle = formatDateForGoogle(startTime);
  const endDateGoogle = formatDateForGoogle(endTime);
  const googleLink = `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDateGoogle}/${endDateGoogle}&details=${description}&location=${location}`;
  window.open(googleLink, "_blank");
}

// ==================================================================================
//  UI Logic & Rendering
// ==================================================================================
document.addEventListener("DOMContentLoaded", function () {
  const appContent = document.getElementById("app-content");

  function showLoading(targetElement, message = "กำลังโหลดข้อมูล...") {
    targetElement.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i><p>${message}</p></div>`;
  }
  function handleError(error) {
    console.error("An error occurred:", error);
    Swal.fire(
      "เกิดข้อผิดพลาด",
      `ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง: ${error.message || ""}`,
      "error",
    );
    if (!currentPatient) {
      renderLoginScreen();
    } else {
      renderPageLayout("dashboard");
    }
  }

  // --- Authentication Flow ---
  function initializePortal() {
    const savedPatientData = localStorage.getItem("patientData");
    if (savedPatientData) {
      renderWelcomeBackScreen(JSON.parse(savedPatientData));
    } else {
      renderLoginScreen();
    }
    attachPdpaModalListeners();
  }

  function renderLoginScreen() {
    const loginHtml = `<div id="login-view"><h2 class="page-title"><i class="fa-solid fa-id-card"></i> ยืนยันตัวตนเพื่อเข้าสู่ระบบ</h2><p>กรุณากรอกเลขประจำตัวประชาชน 13 หลักของท่าน เพื่อตรวจสอบข้อมูลและดำเนินการนัดหมาย</p><form id="patient-login-form" novalidate><div class="form-group"><label for="patientIdInput">เลขประจำตัวประชาชน</label><input type="tel" id="patientIdInput" required pattern="[0-9]{13}" inputmode="numeric" placeholder="กรอกเลข 13 หลัก" maxlength="13" autocomplete="off"></div><button type="submit" class="btn btn-full-width"><i class="fa-solid fa-arrow-right-to-bracket"></i> ตรวจสอบและเข้าสู่ระบบ</button></form></div>`;
    appContent.innerHTML = loginHtml;
    document
      .getElementById("patient-login-form")
      .addEventListener("submit", handlePatientLogin);
  }

  function renderWelcomeBackScreen(patientData) {
    const welcomeHtml = `<div id="welcome-back-view"><h2 class="page-title"><i class="fa-solid fa-hand-sparkles"></i> ยินดีต้อนรับอีกครั้ง</h2><p class="welcome-name">คุณ ${patientData.first_name} ${patientData.last_name}</p><div class="btn-action-group"><button id="confirm-login-btn" class="btn btn-full-width"><i class="fa-solid fa-check"></i> เข้าสู่ระบบ</button></div><a href="#" id="change-user-link">ไม่ใช่คุณ? เปลี่ยนผู้ใช้</a></div>`;
    appContent.innerHTML = welcomeHtml;
    document
      .getElementById("confirm-login-btn")
      .addEventListener("click", () => loginSuccess(patientData));
    document
      .getElementById("change-user-link")
      .addEventListener("click", (e) => {
        e.preventDefault();
        handleLogout();
      });
  }

  async function handlePatientLogin(event) {
    event.preventDefault();
    const patientIdInput = document.getElementById("patientIdInput");
    const patientId = patientIdInput.value;
    if (!validateThaiId(patientId)) {
      Swal.fire("ข้อมูลไม่ถูกต้อง", "รูปแบบเลขบัตรประชาชนไม่ถูกต้อง", "error");
      return;
    }
    showLoading(appContent, "กำลังตรวจสอบข้อมูล...");
    try {
      const { data: patient, error } =
        await checkPatientRegistration(patientId);
      if (error || !patient) {
        Swal.fire({
          icon: "warning",
          title: "ไม่พบข้อมูลการลงทะเบียน",
          html: `ขออภัย ระบบไม่พบข้อมูลของท่านในฐานข้อมูลผู้รับบริการ<br><br>กรุณาติดต่อเพื่อลงทะเบียนล่วงหน้าที่ <strong>กลุ่มงานการแพทย์แผนไทย โรงพยาบาลสระโบสถ์</strong><br>หรือสอบถามข้อมูลเพิ่มเติมที่หมายเลขโทรศัพท์:<br><strong>082-202-9667</strong> (ในวันและเวลาราชการ)`,
          confirmButtonText: "รับทราบ",
        }).then(() => renderLoginScreen());
      } else {
        loginSuccess(patient);
      }
    } catch (err) {
      handleError(err);
    }
  }

  function loginSuccess(patientData) {
    currentPatient = patientData;
    localStorage.setItem("patientData", JSON.stringify(patientData));
    renderPageLayout("dashboard");
  }
  function handleLogout() {
    currentPatient = null;
    localStorage.removeItem("patientData");
    Swal.fire({
      icon: "success",
      title: "ออกจากระบบสำเร็จ",
      showConfirmButton: false,
      timer: 1500,
    });
    renderLoginScreen();
  }

  // --- Core Page Layout Renderer ---
  function renderPageLayout(pageName, options = {}) {
    window.scrollTo(0, 0);
    if (!currentPatient) {
      initializePortal();
      return;
    }
    const loggedInHeaderHtml = `<div class="dashboard-header"><div class="welcome-message"><h3>สวัสดี, คุณ ${currentPatient.first_name} ${currentPatient.last_name}</h3><p>ยินดีต้อนรับเข้าสู่ระบบนัดหมายออนไลน์</p></div><button id="logout-btn" class="btn btn-secondary"><i class="fa-solid fa-right-from-bracket"></i> ออกจากระบบ</button></div>`;
    const pageContentContainerHtml = `<div id="page-content"></div>`;
    appContent.innerHTML = loggedInHeaderHtml + pageContentContainerHtml;
    document
      .getElementById("logout-btn")
      .addEventListener("click", handleLogout);
    const pageContentDiv = document.getElementById("page-content");
    switch (pageName) {
      case "dashboard":
        renderPatientDashboard(pageContentDiv);
        break;
      case "bookingFlowStart":
        renderBookingFlowStart(pageContentDiv);
        break;
      case "myBookings":
        renderMyBookings(pageContentDiv);
        break;
      case "slots":
        renderBookingSlots(
          pageContentDiv,
          options.date,
          options.filters,
          options.previouslyBookedCount,
        );
        break;
      case "bookingForm":
        renderBookingForm(
          pageContentDiv,
          options.date,
          options.time,
          options.therapist,
          options.filters,
          options.previouslyBookedCount,
        );
        break;
    }
  }

  // --- Page-Specific Renderers ---
  function renderPatientDashboard(targetElement) {
    currentFilters = {};
    const dashboardContent = `<div id="patient-dashboard"><div id="next-appointment-placeholder"></div><div class="home-actions"><a href="#" id="go-to-booking" class="btn-home-action btn-primary"><div class="action-icon"><i class="fa-solid fa-calendar-plus"></i></div><div class="action-text"><span>จองคิวใหม่</span><small>ค้นหาและเลือกวันเวลาที่สะดวก</small></div></a><a href="#" id="go-to-my-bookings" class="btn-home-action btn-secondary"><div class="action-icon"><i class="fa-solid fa-list-check"></i></div><div class="action-text"><span>นัดหมายของฉัน</span><small>ตรวจสอบและยกเลิกการจอง</small></div></a></div><div id="stats-container-placeholder" class="subtle-stats-bar"><span class="loading-text">กำลังโหลดสถิติ...</span></div></div>`;
    targetElement.innerHTML = dashboardContent;
    document.getElementById("go-to-booking").addEventListener("click", (e) => {
      e.preventDefault();
      currentDate = new Date();
      renderPageLayout("bookingFlowStart");
    });
    document
      .getElementById("go-to-my-bookings")
      .addEventListener("click", (e) => {
        e.preventDefault();
        renderPageLayout("myBookings");
      });
    loadNextAppointment(
      document.getElementById("next-appointment-placeholder"),
    );
    loadDashboardStats(document.getElementById("stats-container-placeholder"));
  }

  async function renderBookingFlowStart(targetElement) {
    showLoading(targetElement, "กำลังเตรียมหน้าจองคิว...");
    try {
      const { data: lastBooking, error } = await findLastBookingHistory(
        currentPatient.patient_id,
      );
      if (error && error.code !== SUPABASE_ERROR_CODE_NO_ROWS) throw error;
      let rebookHtml = "";
      if (lastBooking && lastBooking.therapist_name) {
        rebookHtml = `<div class="rebook-card"><i class="fa-solid fa-star"></i><div class="rebook-info"><h4>กลับมาใช้บริการอีกครั้งใช่ไหมคะ?</h4><p>ครั้งล่าสุดคุณได้นัดหมายกับ <strong>${lastBooking.therapist_name}</strong></p></div><button id="rebook-btn" class="btn" data-therapist="${lastBooking.therapist_name}">จองกับท่านเดิม</button></div>`;
      }
      targetElement.innerHTML = `<div id="booking-start-view">${rebookHtml}<div id="calendar-wrapper"></div></div>`;
      await renderCalendar(
        document.getElementById("calendar-wrapper"),
        currentDate.getMonth(),
        currentDate.getFullYear(),
      );
      if (document.getElementById("rebook-btn")) {
        document.getElementById("rebook-btn").addEventListener("click", (e) => {
          const therapist = e.target.dataset.therapist;
          document.getElementById("therapist-filter").value = therapist;
          document.getElementById("people-filter").value = "1";
          currentFilters = { therapist: therapist, people: "1" };
          updateCalendarView();
        });
      }
      if (Object.keys(currentFilters).length > 0) {
        if (currentFilters.people)
          document.getElementById("people-filter").value =
            currentFilters.people;
        if (currentFilters.therapist)
          document.getElementById("therapist-filter").value =
            currentFilters.therapist;
        attachCalendarListeners.updateTimeSlotsBasedOnTherapist();
        if (currentFilters.timeSlot)
          document.getElementById("timeslot-filter").value =
            currentFilters.timeSlot;
        updateCalendarView();
      }
    } catch (err) {
      handleError(err);
    }
  }

  async function renderCalendar(targetElement, month, year) {
    currentDate = new Date(year, month, 1);
    try {
      const { data: options, error } = await getFilterOptions();
      if (error) throw error;
      let peopleOptionsHtml = "";
      if (options.maxPeople > 0) {
        for (let i = 1; i <= options.maxPeople; i++) {
          peopleOptionsHtml += `<option value="${i}">${i} คน</option>`;
        }
      } else {
        peopleOptionsHtml = '<option value="1">1 คน</option>';
      }
      const monthName = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
        month: "long",
        year: "numeric",
      }).format(currentDate);
      let calendarHtml = `<div id="calendar-view"><h2 class="page-title"><i class="fa-solid fa-magnifying-glass"></i>ค้นหาคิวว่าง</h2><div class="filter-container"><div class="filter-grid"><div class="filter-group"><label for="people-filter"><i class="fa-solid fa-users"></i> จำนวนคน</label><select id="people-filter">${peopleOptionsHtml}</select></div><div class="filter-group"><label for="therapist-filter"><i class="fa-solid fa-user-doctor"></i> เลือกหมอ (กรณีมาคนเดียว)</label><select id="therapist-filter"><option value="">หมอทุกคน</option>${options.therapists.map((t) => `<option value="${t}">${t}</option>`).join("")}</select></div><div class="filter-group"><label for="timeslot-filter"><i class="fa-solid fa-clock"></i> เลือกเวลา</label><select id="timeslot-filter"><option value="">ทุกช่วงเวลา</option>${options.timeSlots.map((t) => `<option value="${t}">${t} น.</option>`).join("")}</select></div></div><div class="filter-actions"><button id="reset-filters" class="btn-reset">ล้างค่าตัวกรอง</button><button id="search-button" class="btn btn-search-filter"><i class="fa-solid fa-search"></i> ค้นหาคิว</button></div></div><div class="calendar-header" id="calendar-header"><button id="prev-month" class="btn"><i class="fas fa-chevron-left"></i></button><h2 id="calendar-month-year">${monthName}</h2><button id="next-month" class="btn"><i class="fas fa-chevron-right"></i></button></div><div id="calendar-grid-wrapper"><div class="initial-message">กรุณาเลือกเงื่อนไขและกดปุ่ม "ค้นหาคิว"</div></div><div class="calendar-legend"><div class="legend-item"><span class="legend-color" style="background-color: var(--status-green);"></span>ว่าง</div><div class="legend-item"><span class="legend-color" style="background-color: var(--status-red);"></span>เต็ม/ไม่มีคิว</div><div class="legend-item"><span class="legend-color" style="background-color: var(--status-disabled-bg);"></span>ปิดทำการ</div></div><div class="btn-action-group"><button id="back-to-dashboard" class="btn btn-secondary"><i class="fa-solid fa-home"></i> กลับหน้าหลัก</button></div></div>`;
      targetElement.innerHTML = calendarHtml;
      attachCalendarListeners(options);
    } catch (err) {
      handleError(err);
    }
  }

  async function renderMyBookings(targetElement) {
    showLoading(targetElement, "กำลังโหลดข้อมูลนัดหมายของท่าน...");
    try {
      const { data: bookings, error } = await findMyBookings(
        currentPatient.patient_id,
      );
      if (error) throw error;
      let resultsHtml = `<h2 class="page-title"><i class="fa-solid fa-list-check"></i> นัดหมายของฉัน</h2>`;
      if (bookings.length === 0) {
        resultsHtml += `<div class="booking-summary" style="border-left-color: var(--status-yellow); text-align: center;"><p class="summary-item"><i class="fa-solid fa-circle-info"></i> ไม่พบรายการนัดหมายล่วงหน้า</p></div>`;
      } else {
        resultsHtml += `<div class="slots-table-container"><table class="slots-table"><thead><tr><th>วันที่นัด</th><th>เวลา</th><th>ชื่อหมอ</th><th>การดำเนินการ</th></tr></thead><tbody>${bookings.map((b) => `<tr data-booking-info='${JSON.stringify(b)}'><td data-label="วันที่นัด">${formatThaiDate(b.booking_date, false)}</td><td data-label="เวลา">${b.booking_time.slice(0, 5)} น.</td><td data-label="ชื่อหมอ">${b.therapist_name}</td><td data-label="ดำเนินการ"><div class="action-buttons-cell"><button class="btn btn-slot btn-print-save" style="background-color: var(--secondary-accent);"><i class="fa-solid ${isMobile() ? "fa-download" : "fa-print"}"></i> ${isMobile() ? "บันทึก" : "พิมพ์"}</button><button class="btn btn-slot btn-cancel" style="background-color: var(--status-red);"><i class="fa-solid fa-trash-can"></i> ยกเลิก</button></div></td></tr>`).join("")}</tbody></table></div>`;
      }
      resultsHtml += `<div class="btn-action-group"><button id="back-to-dashboard" class="btn btn-secondary"><i class="fa-solid fa-home"></i> กลับหน้าหลัก</button></div>`;
      targetElement.innerHTML = resultsHtml;
      document
        .getElementById("back-to-dashboard")
        .addEventListener("click", () => renderPageLayout("dashboard"));
      if (bookings.length > 0) {
        attachMyBookingsListeners();
      }
    } catch (err) {
      handleError(err);
    }
  }

  async function renderBookingSlots(
    targetElement,
    date,
    filters = {},
    previouslyBookedCount = 0,
  ) {
    showLoading(
      targetElement,
      `กำลังโหลดตารางเวลาสำหรับ <span class="loading-message-small">${formatThaiDate(date)}</span>...`,
    );
    try {
      const { data: slotData, error } = await getAvailableSlots(
        date,
        false,
        filters,
      );
      if (error) throw error;
      let pageHtml = `<div id="slots-view">`;
      if (!slotData || slotData.therapists.length === 0) {
        pageHtml += `<h2 class="page-title"><i class="fa-solid fa-clock"></i>ตารางจองนัดหมาย</h2><p>วันที่เลือก: <strong>${formatThaiDate(date)}</strong></p><div class="booking-summary" style="border-left-color: var(--status-yellow); text-align: center;"><p class="summary-item"><i class="fa-solid fa-circle-info"></i> ขออภัย วันนี้ไม่มีคิวว่างตามเงื่อนไขที่ท่านเลือก</p></div>`;
      } else {
        pageHtml += `<h2 class="page-title"><i class="fa-solid fa-clock"></i>ตารางจองนัดหมาย</h2><p>วันที่เลือก: <strong>${formatThaiDate(date)}</strong></p><div class="slots-table-container"><table class="slots-table"><thead><tr><th>เวลา</th>${slotData.therapists.map((t) => `<th>${t}</th>`).join("")}</tr></thead><tbody>${slotData.slots.map((slot) => `<tr><td data-label="เวลา">${slot.time}</td>${slotData.therapists.map((th) => `<td data-label="${th}">${renderSlotButton(slot.time, th, slot.availability[th], date)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      }
      pageHtml += `<div class="btn-action-group"><button id="back-to-calendar" class="btn btn-secondary"><i class="fa-solid fa-arrow-left"></i> กลับไปที่ปฏิทิน</button></div></div>`;
      targetElement.innerHTML = pageHtml;
      attachSlotsListeners(filters, previouslyBookedCount);
    } catch (err) {
      handleError(err);
    }
  }

  function renderSlotButton(time, therapist, status, date) {
    if (status === "AVAILABLE") {
      return `<button class="btn btn-slot btn-book" data-date="${date}" data-time="${time}" data-therapist="${therapist}">จอง</button>`;
    }
    if (status === "FULL") {
      return `<button class="btn btn-slot btn-full" disabled>เต็ม</button>`;
    }
    return `<span>-</span>`;
  }
  function renderBookingForm(
    targetElement,
    date,
    time,
    therapist,
    filters = {},
    previouslyBookedCount = 0,
  ) {
    showLoading(targetElement, "กำลังเตรียมฟอร์มจอง...");
    const peopleCount = parseInt(filters.people || "1");
    const bookingPersonNumber = previouslyBookedCount + 1;
    const isPrimaryBooker = bookingPersonNumber === 1;
    let formTitle = "ยืนยันข้อมูลการจอง";
    if (peopleCount > 1) {
      formTitle = `ข้อมูลการจอง (คนที่ ${bookingPersonNumber}/${peopleCount})`;
    }
    const patientId = isPrimaryBooker ? currentPatient.patient_id : "";
    const firstName = isPrimaryBooker ? currentPatient.first_name : "";
    const lastName = isPrimaryBooker ? currentPatient.last_name : "";
    const phone = isPrimaryBooker ? currentPatient.phone_number : "";
    const isReadonly = isPrimaryBooker;
    const personCheckHTML = !isPrimaryBooker
      ? `<div class="form-group person-check-group"><label for="patientId">เลขบัตรประชาชน (คนที่ ${bookingPersonNumber})</label><div class="input-with-button"><input type="tel" id="patientId" value="" required pattern="[0-9]{13}" inputmode="numeric" maxlength="13"><button type="button" id="check-secondary-patient" class="btn btn-secondary">ตรวจสอบ</button></div></div>`
      : `<div class="form-group"><label for="patientId">เลขบัตรประชาชน</label><input type="tel" id="patientId" value="${patientId}" readonly></div>`;
    const formHtml = `<div id="form-view"><h2 class="page-title"><i class="fa-solid fa-file-lines"></i>${formTitle}</h2><div class="booking-summary"><p class="summary-item"><i class="fa-solid fa-user-doctor"></i>  <strong>ชื่อหมอ:</strong> ${therapist}</p><p class="summary-item"><i class="fa-solid fa-calendar-alt"></i>  <strong>วันที่:</strong> ${formatThaiDate(date)}</p><p class="summary-item"><i class="fa-solid fa-clock"></i>  <strong>เวลา:</strong> ${time} น.</p></div><form id="booking-form" class="booking-form" novalidate>${personCheckHTML}<div class="form-group"><label for="patientFirstName">ชื่อ</label><input type="text" id="patientFirstName" value="${firstName}" ${isReadonly ? "readonly" : "required"}></div><div class="form-group"><label for="patientLastName">นามสกุล</label><input type="text" id="patientLastName" value="${lastName}" ${isReadonly ? "readonly" : "required"}></div><div class="form-group"><label for="patientPhone">เบอร์โทรศัพท์</label><input type="tel" id="patientPhone" value="${phone}" ${isReadonly ? "readonly" : "required"}></div><div class="pdpa-consent-container"><label class="pdpa-checkbox-group"><input type="checkbox" id="pdpa-consent" required><span class="pdpa-text">ข้าพเจ้ารับทราบและยินยอมตาม <a href="#" class="pdpa-link">นโยบายคุ้มครองข้อมูลส่วนบุคคล</a></span></label></div><div class="btn-action-group"><button type="button" id="back-to-slots" class="btn btn-secondary"><i class="fa-solid fa-arrow-left"></i> กลับ</button><button type="submit" id="submit-booking-btn" class="btn" disabled><i class="fa-solid fa-check"></i> ยืนยันการจอง</button></div></form></div>`;
    targetElement.innerHTML = formHtml;
    attachFormListeners(date, time, therapist, filters, previouslyBookedCount);
  }

  async function loadNextAppointment(placeholder) {
    try {
      const { data, error } = await findMyBookings(currentPatient.patient_id);
      if (error) throw error;
      if (data && data.length > 0) {
        const nextBooking = data[0];
        const bookingDate = new Date(nextBooking.booking_date + "T00:00:00");
        const day = bookingDate.getDate();
        const month = bookingDate.toLocaleDateString("th-TH", {
          month: "short",
        });
        placeholder.innerHTML = `<div class="next-appointment-card"><div class="appointment-date-stub"><span class="day">${day}</span><span class="month">${month}</span></div><div class="card-content"><h4>นัดหมายครั้งถัดไปของท่าน</h4><p><i class="fa-solid fa-clock"></i> <strong>เวลา:</strong> ${nextBooking.booking_time.slice(0, 5)} น.</p><p><i class="fa-solid fa-user-doctor"></i> <strong>กับ:</strong> ${nextBooking.therapist_name}</p></div></div>`;
      } else {
        placeholder.innerHTML = `<div class="next-appointment-card no-booking"><div class="card-icon"><i class="fa-solid fa-calendar-xmark"></i></div><div class="card-content"><h4>ยังไม่มีนัดหมายล่วงหน้า</h4><p>ท่านสามารถกด "จองคิวใหม่" เพื่อเริ่มการนัดหมายได้เลย</p></div></div>`;
      }
    } catch (err) {
      placeholder.innerHTML = `<div class="next-appointment-card error"><p>ไม่สามารถโหลดข้อมูลนัดหมายได้</p></div>`;
      console.error("Error loading next appointment:", err);
    }
  }

  async function loadDashboardStats(statsContainer) {
    try {
      const { data, error } = await getDashboardStats();
      if (error) throw error;
      if (statsContainer) {
        statsContainer.innerHTML = `<span class="stat-group"><i class="fa-solid fa-calendar-check"></i>จองคิวเดือนนี้:<span class="stat-number" id="monthly-counter">0</span> ครั้ง</span><span class="stat-divider">|</span><span class="stat-group"><i class="fa-solid fa-chart-line"></i>จำนวนการจองคิวสะสม:<span class="stat-number" id="total-counter">0</span> ครั้ง</span>`;
        animateCounter(
          document.getElementById("monthly-counter"),
          data.monthlyBookings,
        );
        animateCounter(
          document.getElementById("total-counter"),
          data.totalBookings,
        );
      }
    } catch (err) {
      console.error("Could not load dashboard stats:", err);
      if (statsContainer)
        statsContainer.innerHTML = `<span class="loading-text">ไม่สามารถโหลดสถิติได้</span>`;
    }
  }

  async function updateCalendarView() {
    const gridWrapper = document.getElementById("calendar-grid-wrapper");
    if (!gridWrapper) return;
    showLoading(gridWrapper, "กำลังค้นหาคิว...");
    const searchButton = document.getElementById("search-button");
    if (searchButton) searchButton.disabled = true;
    const filters = {
      people: document.getElementById("people-filter").value,
      therapist: document.getElementById("therapist-filter").value,
      timeSlot: document.getElementById("timeslot-filter").value,
    };
    currentFilters = filters;
    const hasActiveFilters =
      filters.therapist ||
      filters.timeSlot ||
      (filters.people && parseInt(filters.people, 10) > 1);
    try {
      const { data: response, error } = await getCalendarData(
        currentDate.getMonth(),
        currentDate.getFullYear(),
        false,
        filters,
      );
      if (error) throw error;
      if (response.status === "FOUND_IN_FUTURE") {
        const popupMessage = hasActiveFilters
          ? {
              icon: "warning",
              title: "ไม่พบคิวว่างตามเงื่อนไข",
              text: "ไม่พบคิวว่างตามเงื่อนไขที่ท่านระบุในเดือนปัจจุบัน ระบบกำลังแสดงเดือนถัดไปที่มีคิวว่างแทน",
            }
          : {
              icon: "info",
              title: "เดือนนี้คิวเต็มแล้ว",
              text: "ระบบกำลังแสดงเดือนถัดไปที่มีคิวว่างให้โดยอัตโนมัติ",
              timer: 3000,
              showConfirmButton: false,
            };
        await Swal.fire(popupMessage);
        currentDate = new Date(response.newYear, response.newMonth, 1);
        await renderCalendar(
          document.getElementById("calendar-wrapper"),
          currentDate.getMonth(),
          currentDate.getFullYear(),
        );
        return updateCalendarView();
      } else if (response.status === "NOT_FOUND" && hasActiveFilters) {
        Swal.fire({
          icon: "warning",
          title: "ไม่พบคิวว่าง",
          text: "ไม่พบคิวว่างตามเงื่อนไขที่คุณเลือก กรุณาลองเปลี่ยนเงื่อนไขการค้นหา",
        });
      }
      const statusData = response.data;
      document.getElementById("calendar-month-year").textContent =
        new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
          month: "long",
          year: "numeric",
        }).format(currentDate);
      const firstDayIndex = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1,
      ).getDay();
      const daysInMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0,
      ).getDate();
      const dayNames = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"]
        .map((d) => `<div class="day-name">${d}</div>`)
        .join("");
      const emptyDays = Array(firstDayIndex).fill("<div></div>").join("");
      const dateCells = [...Array(daysInMonth).keys()]
        .map((i) => {
          const day = i + 1;
          const dateStr = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
          const status = statusData[dateStr] || "DISABLED";
          return `<div class="calendar-day date-${status.toLowerCase()}" data-date="${dateStr}">${day}</div>`;
        })
        .join("");
      gridWrapper.innerHTML = `<div class="calendar-grid">${dayNames}${emptyDays}${dateCells}</div>`;
      document
        .querySelectorAll(".calendar-day.date-available")
        .forEach((day) =>
          day.addEventListener("click", () =>
            renderPageLayout("slots", {
              date: day.dataset.date,
              filters: filters,
            }),
          ),
        );
      if (
        response.status === "FOUND_IN_CURRENT" ||
        response.status === "FOUND_IN_FUTURE"
      ) {
        const calendarHeader = document.getElementById("calendar-header");
        if (calendarHeader) {
          calendarHeader.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    } catch (err) {
      handleError(err);
    } finally {
      if (searchButton) searchButton.disabled = false;
    }
  }

  async function handleBookingSubmit(
    bookingInfo,
    filters,
    previouslyBookedCount,
  ) {
    const confirmationHtml = `<div style="text-align: left; padding: 0 1rem; font-size: 1rem;"><p><strong>ชื่อ-สกุล:</strong> ${bookingInfo.patientFirstName} ${bookingInfo.patientLastName}</p><p><strong>เบอร์โทร:</strong> ${bookingInfo.patientPhone}</p><hr><p><strong>ชื่อหมอ:</strong> ${bookingInfo.therapist}</p><p><strong>วันที่:</strong> ${formatThaiDate(bookingInfo.date)}</p><p><strong>เวลา:</strong> ${bookingInfo.time} น.</p></div>`;
    const result = await Swal.fire({
      title: "ยืนยันการจอง?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "ยืนยัน",
      cancelButtonText: "ยกเลิก",
      html: confirmationHtml,
    });
    if (result.isConfirmed) {
      Swal.fire({
        title: "กำลังดำเนินการจอง",
        text: "กรุณารอสักครู่...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });
      try {
        const { data: res, error } = await processBooking(bookingInfo);
        if (error) throw error;
        if (res.success) {
          const peopleCount = parseInt(filters.people || "1");
          const newBookedCount = previouslyBookedCount + 1;
          Swal.fire({
            title: `จองสำเร็จ! ${peopleCount > 1 ? `(คนที่ ${newBookedCount}/${peopleCount})` : ""}`,
            icon: "success",
            html: `<div id="slip-for-mobile">${generateSlipHTML(bookingInfo)}</div>`,
            showCloseButton: true,
            showConfirmButton: true,
            confirmButtonText: isMobile()
              ? '<i class="fa-solid fa-download"></i> บันทึกเป็นรูปภาพ'
              : '<i class="fa-solid fa-print"></i> พิมพ์ใบนัด',
            ...(isMobile() && {
              showDenyButton: true,
              denyButtonText:
                '<i class="fa-solid fa-calendar-plus"></i> เพิ่มลงในปฏิทิน',
            }),
            preConfirm: () => {
              isMobile()
                ? captureAndSaveSlip(bookingInfo)
                : createPrintSlip(bookingInfo);
              return false;
            },
            preDeny: () => {
              generateCalendarLink(bookingInfo);
              return false;
            },
          }).then(() => {
            if (peopleCount > 1 && newBookedCount < peopleCount) {
              Swal.fire({
                title: `จองคิวคนถัดไป (คนที่ ${newBookedCount + 1})`,
                text: 'กรุณากดปุ่ม "จอง" ในช่องที่ว่าง เพื่อจองคิวให้คนถัดไป',
                icon: "info",
                timer: 3500,
                showConfirmButton: false,
              });
              renderPageLayout("slots", {
                date: bookingInfo.date,
                filters: filters,
                previouslyBookedCount: newBookedCount,
              });
            } else {
              if (peopleCount > 1) {
                Swal.fire(
                  "เสร็จสมบูรณ์!",
                  `การจองคิวสำหรับ ${peopleCount} ท่านเรียบร้อยแล้ว`,
                  "success",
                );
              }
              renderPageLayout("dashboard");
            }
          });
        } else {
          Swal.fire("จองไม่สำเร็จ", res.message, "error").then(() => {
            renderPageLayout("slots", {
              date: bookingInfo.date,
              filters: filters,
              previouslyBookedCount: previouslyBookedCount,
            });
          });
        }
      } catch (err) {
        handleError(err);
      }
    }
  }

  function handleCancelClick(bookingInfo) {
    const detailsHtml = `<div style="text-align: left; padding: 0 1rem; font-size: 1rem;"><p><strong>ผู้จอง:</strong> ${bookingInfo.patient_first_name} ${bookingInfo.patient_last_name}</p><hr><p><strong>วันที่:</strong> ${formatThaiDate(bookingInfo.booking_date, true)}</p><p><strong>เวลา:</strong> ${bookingInfo.booking_time.slice(0, 5)} น.</p><p><strong>ชื่อหมอ:</strong> ${bookingInfo.therapist_name}</p></div><br><p>คุณต้องการยกเลิกนัดหมายนี้ใช่หรือไม่?</p>`;
    Swal.fire({
      title: "ยืนยันการยกเลิกนัดหมาย?",
      html: detailsHtml,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ยืนยันยกเลิก",
      cancelButtonText: "ปิด",
      confirmButtonColor: "var(--status-red)",
    }).then(async (result) => {
      if (result.isConfirmed) {
        Swal.fire({
          title: "กำลังยกเลิกนัดหมาย...",
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
        });
        try {
          const { data: res, error } = await cancelBooking(bookingInfo);
          if (error) throw error;
          if (res.success) {
            await Swal.fire("สำเร็จ", "ยกเลิกนัดหมายเรียบร้อยแล้ว", "success");
            renderPageLayout("myBookings");
          } else {
            Swal.fire("เกิดข้อผิดพลาด", res.message, "error");
          }
        } catch (err) {
          handleError(err);
        }
      }
    });
  }

  // --- Event Listener Attachers ---
  function attachPdpaModalListeners() {
    const pdpaModal = document.getElementById("pdpa-modal");
    if (!pdpaModal) return;
    document.body.addEventListener("click", (e) => {
      if (e.target.matches(".pdpa-link")) {
        e.preventDefault();
        pdpaModal.style.display = "flex";
      }
    });
    pdpaModal.addEventListener("click", (e) => {
      if (
        e.target.id === "close-pdpa-modal" ||
        e.target.classList.contains("modal-overlay")
      ) {
        pdpaModal.style.display = "none";
      }
    });
  }

  function attachSlotsListeners(filters, previouslyBookedCount) {
    document
      .getElementById("back-to-calendar")
      .addEventListener("click", (e) => {
        e.preventDefault();
        renderPageLayout("bookingFlowStart");
      });
    document.querySelectorAll(".btn-book").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const { date, time, therapist } = e.target.dataset;
        renderPageLayout("bookingForm", {
          date,
          time,
          therapist,
          filters,
          previouslyBookedCount,
        });
      });
    });
  }

  function attachFormListeners(
    date,
    time,
    therapist,
    filters,
    previouslyBookedCount,
  ) {
    document.getElementById("back-to-slots").addEventListener("click", () => {
      renderPageLayout("slots", {
        date: date,
        filters: filters,
        previouslyBookedCount: previouslyBookedCount,
      });
    });
    const pdpaCheckbox = document.getElementById("pdpa-consent");
    const submitButton = document.getElementById("submit-booking-btn");
    pdpaCheckbox.addEventListener("change", () => {
      submitButton.disabled = !pdpaCheckbox.checked;
    });
    const checkBtn = document.getElementById("check-secondary-patient");
    if (checkBtn) {
      checkBtn.addEventListener("click", async () => {
        const patientId = document.getElementById("patientId").value;
        if (!validateThaiId(patientId)) {
          Swal.fire(
            "ข้อมูลไม่ถูกต้อง",
            "รูปแบบเลขบัตรประชาชนไม่ถูกต้อง",
            "error",
          );
          return;
        }
        const { data: patient, error } =
          await checkPatientRegistration(patientId);
        if (error || !patient) {
          Swal.fire(
            "ไม่พบข้อมูล",
            "ไม่พบข้อมูลผู้ป่วยท่านนี้ในระบบ กรุณาตรวจสอบหรือติดต่อเจ้าหน้าที่เพื่อลงทะเบียน",
            "warning",
          );
        } else {
          document.getElementById("patientFirstName").value =
            patient.first_name;
          document.getElementById("patientLastName").value = patient.last_name;
          document.getElementById("patientPhone").value = patient.phone_number;
          Swal.fire(
            "พบข้อมูล!",
            `ดึงข้อมูลของ คุณ ${patient.first_name} เรียบร้อย`,
            "success",
          );
        }
      });
    }
    document
      .getElementById("booking-form")
      .addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.target;
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }
        if (!pdpaCheckbox.checked) {
          Swal.fire(
            "ข้อผิดพลาด",
            "กรุณายินยอมในนโยบายคุ้มครองข้อมูลส่วนบุคคล",
            "warning",
          );
          return;
        }
        const bookingInfo = {
          date,
          time,
          therapist,
          patientId: document.getElementById("patientId").value,
          patientFirstName: document.getElementById("patientFirstName").value,
          patientLastName: document.getElementById("patientLastName").value,
          patientPhone: document.getElementById("patientPhone").value,
        };
        handleBookingSubmit(bookingInfo, filters, previouslyBookedCount);
      });
  }

  function attachMyBookingsListeners() {
    document.querySelectorAll(".btn-print-save").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const bookingData = JSON.parse(
          e.target.closest("tr").dataset.bookingInfo,
        );
        isMobile()
          ? captureAndSaveSlip(bookingData)
          : createPrintSlip(bookingData);
      });
    });
    document.querySelectorAll(".btn-cancel").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const bookingData = JSON.parse(
          e.target.closest("tr").dataset.bookingInfo,
        );
        handleCancelClick(bookingData);
      });
    });
  }

  function attachCalendarListeners(options) {
    document
      .getElementById("back-to-dashboard")
      .addEventListener("click", () => renderPageLayout("dashboard"));
    document.getElementById("prev-month").addEventListener("click", () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      updateCalendarView();
    });
    document.getElementById("next-month").addEventListener("click", () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      updateCalendarView();
    });
    document
      .getElementById("search-button")
      .addEventListener("click", updateCalendarView);
    document.getElementById("reset-filters").addEventListener("click", () => {
      document.getElementById("people-filter").value = "1";
      document.getElementById("therapist-filter").value = "";
      document.getElementById("timeslot-filter").value = "";
      document.getElementById("therapist-filter").disabled = false;
      currentFilters = {};
      document.getElementById("calendar-grid-wrapper").innerHTML =
        `<div class="initial-message">กรุณาเลือกเงื่อนไขและกดปุ่ม "ค้นหาคิว"</div>`;
    });
    const peopleFilter = document.getElementById("people-filter");
    const therapistFilter = document.getElementById("therapist-filter");
    const timeSlotFilter = document.getElementById("timeslot-filter");
    const updateTimeSlotsBasedOnTherapist = () => {
      const selectedTherapist = therapistFilter.value;
      timeSlotFilter.innerHTML = "";
      timeSlotFilter.add(new Option("ทุกช่วงเวลา", ""));
      let timesToShow = [];
      if (selectedTherapist && options.therapistTimeMap[selectedTherapist]) {
        timesToShow = options.therapistTimeMap[selectedTherapist];
      } else {
        timesToShow = options.timeSlots;
      }
      timesToShow.forEach((time) => {
        timeSlotFilter.add(new Option(`${time} น.`, time));
      });
    };
    peopleFilter.addEventListener("change", () => {
      const isMultiplePeople = peopleFilter.value > 1;
      therapistFilter.disabled = isMultiplePeople;
      if (isMultiplePeople) {
        therapistFilter.value = "";
        updateTimeSlotsBasedOnTherapist();
      }
    });
    therapistFilter.addEventListener("change", () => {
      if (therapistFilter.value !== "") {
        peopleFilter.value = "1";
      }
      updateTimeSlotsBasedOnTherapist();
    });
    attachCalendarListeners.updateTimeSlotsBasedOnTherapist =
      updateTimeSlotsBasedOnTherapist;
  }

  // --- Initialize the application ---
  initializePortal();
});

// ==================================================================================
//  Supabase Data Functions
// ==================================================================================
async function checkPatientRegistration(patientId) {
  try {
    const { data, error } = await supabase
      .from("bookings_register")
      .select("*")
      .eq("patient_id", patientId)
      .single();
    if (error && error.code !== SUPABASE_ERROR_CODE_NO_ROWS) throw error;
    return { data, error: data ? null : error };
  } catch (e) {
    return { data: null, error: e };
  }
}

async function getFilterOptions() {
  try {
    const { data: schedulesData, error } = await supabase
      .from("schedules")
      .select("therapist_name, time_slots, visibility")
      .eq("visibility", "public");
    if (error) throw error;
    const uniqueTherapists = [
      ...new Set(schedulesData.map((row) => row.therapist_name.trim())),
    ].sort();
    const maxPeople = uniqueTherapists.length;
    const allTimeSlots = new Set();
    const therapistTimeMap = {};
    schedulesData.forEach((row) => {
      if (row.time_slots && row.time_slots.length > 0) {
        const therapist = row.therapist_name.trim();
        if (!therapistTimeMap[therapist]) {
          therapistTimeMap[therapist] = new Set();
        }
        row.time_slots.forEach((slot) => {
          const trimmedSlot = slot.trim();
          therapistTimeMap[therapist].add(trimmedSlot);
          allTimeSlots.add(trimmedSlot);
        });
      }
    });
    for (const therapist in therapistTimeMap) {
      therapistTimeMap[therapist] = Array.from(
        therapistTimeMap[therapist],
      ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }
    const sortedTimeSlots = Array.from(allTimeSlots).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
    return {
      data: {
        therapists: uniqueTherapists,
        timeSlots: sortedTimeSlots,
        maxPeople: maxPeople,
        therapistTimeMap: therapistTimeMap,
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: e };
  }
}

async function getCalendarData(
  month,
  year,
  isManagerMode = false,
  filters = {},
) {
  async function _checkMonthAvailability(checkMonth, checkYear) {
    const startDate = new Date(checkYear, checkMonth, 1);
    const endDate = new Date(checkYear, checkMonth + 1, 0);
    const firstDayOfMonth = formatDateToYYYYMMDD(startDate);
    const lastDayOfMonth = formatDateToYYYYMMDD(endDate);
    const [
      { data: holidaysData, error: e1 },
      { data: schedulesData, error: e2 },
      { data: bookingsData, error: e3 },
      { data: blockagesData, error: e4 },
    ] = await Promise.all([
      supabase
        .from("holidays")
        .select("holiday_date")
        .gte("holiday_date", firstDayOfMonth)
        .lte("holiday_date", lastDayOfMonth),
      supabase
        .from("schedules")
        .select("therapist_name, day_of_week, time_slots, visibility")
        .eq("visibility", "public"),
      supabase
        .from("bookings")
        .select("booking_date, booking_time, therapist_name")
        .gte("booking_date", firstDayOfMonth)
        .lte("booking_date", lastDayOfMonth),
      supabase
        .from("blockages")
        .select("block_date, block_time, therapist_name")
        .gte("block_date", firstDayOfMonth)
        .lte("block_date", lastDayOfMonth),
    ]);
    const error = e1 || e2 || e3 || e4;
    if (error) throw error;
    const todayString = formatDateToYYYYMMDD(new Date());
    const maxBookingDate = new Date();
    maxBookingDate.setDate(maxBookingDate.getDate() + 30);
    const maxBookingDateString = formatDateToYYYYMMDD(maxBookingDate);
    const holidays = holidaysData.map((h) => h.holiday_date);
    const peopleToFind = parseInt(filters.people || "1");
    const calendarStatus = {};
    let isAnyDayAvailable = false;
    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const dateString = formatDateToYYYYMMDD(d);
      const dayOfWeek = d.getDay();
      if (
        dateString < todayString ||
        dateString > maxBookingDateString ||
        holidays.includes(dateString) ||
        dayOfWeek === 0 ||
        dayOfWeek === 6
      ) {
        calendarStatus[dateString] = "DISABLED";
        continue;
      }
      const todaysSchedules = schedulesData.filter((s) => {
        if (s.day_of_week != dayOfWeek) return false;
        if (filters.therapist && s.therapist_name.trim() !== filters.therapist)
          return false;
        return true;
      });
      if (todaysSchedules.length < peopleToFind) {
        calendarStatus[dateString] = "FULL";
        continue;
      }
      const bookingsOnDate = bookingsData.filter(
        (b) => b.booking_date === dateString,
      );
      const blockagesOnDate = blockagesData.filter(
        (bl) => bl.block_date === dateString,
      );
      const timeSlotsToday = new Set();
      todaysSchedules.forEach((s) => {
        if (s.time_slots)
          s.time_slots.forEach((slot) => timeSlotsToday.add(slot.trim()));
      });
      let isDayAvailable = false;
      for (const time of Array.from(timeSlotsToday).sort((a, b) =>
        a.localeCompare(b),
      )) {
        if (filters.timeSlot && time !== filters.timeSlot) continue;
        let availableTherapists = 0;
        for (const schedule of todaysSchedules) {
          const therapistName = schedule.therapist_name.trim();
          if (schedule.time_slots && schedule.time_slots.includes(time)) {
            const isBooked = bookingsOnDate.some(
              (b) =>
                b.booking_time.slice(0, 5) === time &&
                b.therapist_name.trim() === therapistName,
            );
            const isBlocked = blockagesOnDate.some(
              (bl) =>
                bl.block_time.slice(0, 5) === time &&
                bl.therapist_name.trim() === therapistName,
            );
            if (!isBooked && !isBlocked) availableTherapists++;
          }
        }
        if (availableTherapists >= peopleToFind) {
          isDayAvailable = true;
          break;
        }
      }
      calendarStatus[dateString] = isDayAvailable ? "AVAILABLE" : "FULL";
      if (isDayAvailable) isAnyDayAvailable = true;
    }
    return { calendarStatus, isAnyDayAvailable };
  }
  try {
    const initialCheck = await _checkMonthAvailability(month, year);
    if (initialCheck.isAnyDayAvailable) {
      return {
        data: {
          status: "FOUND_IN_CURRENT",
          data: initialCheck.calendarStatus,
          newMonth: month,
          newYear: year,
        },
        error: null,
      };
    }
    for (let i = 1; i <= 6; i++) {
      const nextDate = new Date(year, month + i, 1);
      const futureCheck = await _checkMonthAvailability(
        nextDate.getMonth(),
        nextDate.getFullYear(),
      );
      if (futureCheck.isAnyDayAvailable) {
        return {
          data: {
            status: "FOUND_IN_FUTURE",
            data: futureCheck.calendarStatus,
            newMonth: nextDate.getMonth(),
            newYear: nextDate.getFullYear(),
          },
          error: null,
        };
      }
    }
    return {
      data: {
        status: "NOT_FOUND",
        data: initialCheck.calendarStatus,
        newMonth: month,
        newYear: year,
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: e };
  }
}

async function getAvailableSlots(
  dateString,
  isManagerMode = false,
  filters = {},
) {
  try {
    const dayOfWeek = new Date(dateString + "T00:00:00").getDay();
    const [
      { data: bookingsOnDate, error: e1 },
      { data: blockedSlotsForDate, error: e2 },
      { data: allSchedules, error: e3 },
    ] = await Promise.all([
      supabase
        .from("bookings")
        .select("booking_time, therapist_name")
        .eq("booking_date", dateString),
      supabase
        .from("blockages")
        .select("block_time, therapist_name")
        .eq("block_date", dateString),
      supabase
        .from("schedules")
        .select("therapist_name, day_of_week, time_slots, visibility")
        .eq("visibility", "public"),
    ]);
    const error = e1 || e2 || e3;
    if (error) throw error;
    const todaysSchedules = allSchedules.filter(
      (s) => s.day_of_week == dayOfWeek,
    );
    if (todaysSchedules.length === 0) {
      return { data: { therapists: [], slots: [] }, error: null };
    }
    let therapistsToday = [
      ...new Set(todaysSchedules.map((s) => s.therapist_name.trim())),
    ].sort();
    if (filters.therapist) {
      therapistsToday = therapistsToday.filter((t) => t === filters.therapist);
    }
    const allSlotsToday = new Set();
    todaysSchedules.forEach((s) => {
      if (s.time_slots)
        s.time_slots.forEach((slot) => allSlotsToday.add(slot.trim()));
    });
    let sortedSlots = Array.from(allSlotsToday).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
    if (filters.timeSlot) {
      sortedSlots = sortedSlots.filter((t) => t === filters.timeSlot);
    }
    const slotsResult = sortedSlots.map((time) => {
      const slotInfo = { time: time, availability: {} };
      therapistsToday.forEach((therapistName) => {
        const therapistSchedule = todaysSchedules.find(
          (s) => s.therapist_name.trim() === therapistName,
        );
        const hasSlot =
          therapistSchedule &&
          therapistSchedule.time_slots &&
          therapistSchedule.time_slots.includes(time);
        if (hasSlot) {
          const isBooked = bookingsOnDate.some(
            (b) =>
              b.booking_time.slice(0, 5) === time &&
              b.therapist_name.trim() === therapistName,
          );
          const isBlocked = blockedSlotsForDate.some(
            (b) =>
              b.block_time.slice(0, 5) === time &&
              b.therapist_name.trim() === therapistName,
          );
          slotInfo.availability[therapistName] =
            isBooked || isBlocked ? "FULL" : "AVAILABLE";
        } else {
          slotInfo.availability[therapistName] = "NOT_AVAILABLE";
        }
      });
      return slotInfo;
    });
    return {
      data: { therapists: therapistsToday, slots: slotsResult },
      error: null,
    };
  } catch (e) {
    return { data: null, error: e };
  }
}

async function processBooking(bookingInfo) {
  try {
    const newBookingId = `BK-${bookingInfo.date.replace(/-/g, "")}-${bookingInfo.time.replace(":", "")}-${bookingInfo.therapist.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const payload = {
      date: bookingInfo.date,
      time: bookingInfo.time,
      therapist: bookingInfo.therapist,
      patientId: bookingInfo.patientId,
      patientFirstName: bookingInfo.patientFirstName,
      patientLastName: bookingInfo.patientLastName,
      patientPhone: bookingInfo.patientPhone,
      bookingId: newBookingId,
    };
    const { data, error } = await supabase.rpc("process_booking", {
      booking_info: payload,
    });
    if (error) throw error;
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
}

async function findMyBookings(patientId) {
  try {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("patient_id", patientId.trim())
      .gte("booking_date", formatDateToYYYYMMDD(new Date()))
      .order("booking_date", { ascending: true })
      .order("booking_time", { ascending: true });
    if (error) throw error;
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
}
async function findLastBookingHistory(patientId) {
  try {
    const { data, error } = await supabase
      .from("bookings")
      .select("therapist_name")
      .eq("patient_id", patientId.trim())
      .order("booking_date", { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== SUPABASE_ERROR_CODE_NO_ROWS) throw error;
    return { data, error: data ? null : error };
  } catch (e) {
    return { data: null, error: e };
  }
}

async function cancelBooking(bookingData) {
  try {
    const { error: insertError } = await supabase
      .from("cancellations")
      .insert([
        {
          reason: "ยกเลิกโดยผู้ป่วย",
          booking_id: bookingData.booking_id,
          original_timestamp: bookingData.created_at,
          booking_date: bookingData.booking_date,
          booking_time: bookingData.booking_time,
          therapist_name: bookingData.therapist_name,
          patient_id: bookingData.patient_id,
          patient_first_name: bookingData.patient_first_name,
          patient_last_name: bookingData.patient_last_name,
          patient_phone: bookingData.patient_phone,
          original_status: bookingData.status,
        },
      ]);
    if (insertError) throw insertError;
    const { error: deleteError } = await supabase
      .from("bookings")
      .delete()
      .eq("booking_id", bookingData.booking_id);
    if (deleteError) throw deleteError;
    return {
      data: { success: true, message: "ยกเลิกการจองสำเร็จ" },
      error: null,
    };
  } catch (e) {
    return { data: null, error: e };
  }
}

async function getDashboardStats() {
  try {
    const now = new Date();
    const startOfMonth = formatDateToYYYYMMDD(
      new Date(now.getFullYear(), now.getMonth(), 1),
    );
    const endOfMonth = formatDateToYYYYMMDD(
      new Date(now.getFullYear(), now.getMonth() + 1, 0),
    );
    const [{ data: statsData, error: e1 }, { count: monthlyCount, error: e2 }] =
      await Promise.all([
        supabase.from("stats").select("metric_name, value"),
        supabase
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .gte("created_at", startOfMonth + "T00:00:00Z")
          .lte("created_at", endOfMonth + "T23:59:59Z"),
      ]);
    const error = e1 || e2;
    if (error) throw error;
    const manualCount =
      statsData.find((s) => s.metric_name === "ManualInitialCount")?.value || 0;
    const systemCount =
      statsData.find((s) => s.metric_name === "SystemBookingCount")?.value || 0;
    return {
      data: {
        totalBookings: manualCount + systemCount,
        monthlyBookings: monthlyCount,
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: e };
  }
}
