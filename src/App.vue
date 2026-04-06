<template>
  <div id="app-container">
    <header class="app-header">
      <h1><i class="fa-solid fa-spa icon-header"></i> กลุ่มงานการแพทย์แผนไทย โรงพยาบาลสระโบสถ์</h1>
      <p>ระบบนัดหมายเข้ารับบริการออนไลน์</p>
    </header>

    <main id="app-content">
      <!-- Login Screen -->
      <LoginView
        v-if="currentPage === 'login'"
        @login-success="handleLoginSuccess"
      />

      <!-- Welcome Back Screen -->
      <WelcomeBackView
        v-else-if="currentPage === 'welcomeBack'"
        :patient="currentPatient!"
        @confirm-login="handleConfirmLogin"
        @change-user="handleLogout"
      />

      <!-- Logged-in pages (dashboard, booking, etc.) -->
      <template v-else-if="currentPatient">
        <!-- Dashboard Header -->
        <div class="dashboard-header">
          <div class="welcome-message">
            <h3>สวัสดี, คุณ {{ currentPatient.first_name }} {{ currentPatient.last_name }}</h3>
            <p>ยินดีต้อนรับเข้าสู่ระบบนัดหมายออนไลน์</p>
          </div>
          <button class="btn btn-secondary" @click="handleLogout">
            <i class="fa-solid fa-right-from-bracket"></i> ออกจากระบบ
          </button>
        </div>

        <DashboardView
          v-if="currentPage === 'dashboard'"
          :patient="currentPatient"
          @go-to-booking="navigateTo('bookingFlowStart')"
          @go-to-my-bookings="navigateTo('myBookings')"
        />

        <BookingFlowStartView
          v-else-if="currentPage === 'bookingFlowStart'"
          :patient="currentPatient"
          :initial-filters="currentFilters"
          @go-to-slots="(opts) => navigateTo('slots', opts)"
          @back="navigateTo('dashboard')"
          @update-filters="(f) => (currentFilters = f)"
        />

        <MySlotsView
          v-else-if="currentPage === 'slots'"
          :date="pageOptions.date!"
          :filters="pageOptions.filters || {}"
          :previously-booked-count="pageOptions.previouslyBookedCount || 0"
          @go-to-form="(opts) => navigateTo('bookingForm', opts)"
          @back="navigateTo('bookingFlowStart')"
        />

        <BookingFormView
          v-else-if="currentPage === 'bookingForm'"
          :patient="currentPatient"
          :date="pageOptions.date!"
          :time="pageOptions.time!"
          :therapist="pageOptions.therapist!"
          :filters="pageOptions.filters || {}"
          :previously-booked-count="pageOptions.previouslyBookedCount || 0"
          @back="navigateTo('slots', pageOptions)"
          @booking-complete="handleBookingComplete"
        />

        <MyBookingsView
          v-else-if="currentPage === 'myBookings'"
          :patient="currentPatient"
          @back="navigateTo('dashboard')"
        />
      </template>

      <!-- Fallback loading -->
      <div v-else class="loading-spinner">
        <i class="fas fa-spinner fa-spin"></i>
        <p>กำลังเตรียมระบบ...</p>
      </div>
    </main>

    <footer class="app-footer">
      <p>© 2025 โรงพยาบาลสระโบสถ์ | พัฒนาโดย: อชิรญาณ์ รมยศิริไทย</p>
    </footer>
  </div>

  <!-- PDPA Modal -->
  <div id="pdpa-modal" class="modal-overlay" v-show="showPdpaModal" @click.self="showPdpaModal = false">
    <div class="modal-content">
      <div class="modal-header">
        <h2>นโยบายคุ้มครองข้อมูลส่วนบุคคล</h2>
        <button class="modal-close-btn" @click="showPdpaModal = false">×</button>
      </div>
      <div class="modal-body">
        <p><strong>สำหรับระบบจองคิวนัดหมายออนไลน์ งานแพทย์แผนไทย โรงพยาบาลสระโบสถ์</strong></p>
        <p><strong>มีผลบังคับใช้ตั้งแต่วันที่: 24 กรกฎาคม 2568</strong></p>
        <hr />
        <p>
          โรงพยาบาลสระโบสถ์ ("โรงพยาบาล") ให้ความสำคัญอย่างยิ่งต่อการคุ้มครองข้อมูลส่วนบุคคลของผู้รับบริการทุกท่าน
          ("ท่าน") นโยบายฉบับนี้จัดทำขึ้นเพื่อชี้แจงรายละเอียดเกี่ยวกับการเก็บรวบรวม ใช้
          หรือเปิดเผยข้อมูลส่วนบุคคลของท่าน ผ่านระบบจองคิวนัดหมายออนไลน์นี้
          ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 ("PDPA")
        </p>

        <h4>1. ข้อมูลส่วนบุคคลที่เราเก็บรวบรวม</h4>
        <p>เราจะเก็บรวบรวมข้อมูลส่วนบุคคลของท่านเท่าที่จำเป็น ผ่านแบบฟอร์มการจองคิว ดังต่อไปนี้:</p>
        <ul>
          <li>ชื่อ - นามสกุล</li>
          <li>เลขประจำตัวประชาชน 13 หลัก</li>
          <li>หมายเลขโทรศัพท์</li>
        </ul>

        <h4>2. วัตถุประสงค์ในการเก็บรวบรวมและใช้ข้อมูล</h4>
        <p>เราเก็บรวบรวมและใช้ข้อมูลของท่านเพื่อวัตถุประสงค์ดังต่อไปนี้:</p>
        <ul>
          <li><strong>เพื่อการนัดหมาย:</strong> ใช้ในการสร้าง, ยืนยัน, และจัดการคิวนัดหมายของท่าน</li>
          <li>
            <strong>เพื่อการยืนยันตัวตน:</strong>
            ใช้เลขประจำตัวประชาชนเพื่อตรวจสอบและยืนยันตัวตนของท่านเมื่อเข้ารับบริการ
          </li>
          <li>
            <strong>เพื่อการติดต่อสื่อสาร:</strong>
            ใช้หมายเลขโทรศัพท์ในการติดต่อท่านกรณีจำเป็น เช่น ยืนยันนัดหมาย หรือ การเลื่อนนัด
          </li>
          <li>
            <strong>เพื่อการให้บริการทางการแพทย์:</strong>
            ใช้ข้อมูลดังกล่าวเป็นส่วนหนึ่งของกระบวนการจัดเตรียมการให้บริการ
          </li>
        </ul>

        <h4>3. การเก็บรักษาข้อมูล</h4>
        <p>
          โรงพยาบาลจะจัดเก็บข้อมูลส่วนบุคคลของท่านไว้ในระบบที่มีมาตรการรักษาความปลอดภัยที่เหมาะสม
          และจะเก็บรักษาไว้เป็นระยะเวลาเท่าที่จำเป็นตามวัตถุประสงค์และตามที่กฎหมายกำหนด
        </p>

        <h4>4. การติดต่อเรา</h4>
        <p>
          หากท่านมีข้อสงสัยเกี่ยวกับนโยบายฉบับนี้ สามารถติดต่อได้ที่:<br />
          <strong>งานแพทย์แผนไทย โรงพยาบาลสระโบสถ์</strong><br />
          <strong>โทรศัพท์:</strong> 036-776240 ต่อ 144
        </p>
        <hr />
        <p>
          การที่ท่านดำเนินการจองคิวในระบบนี้ต่อไป ถือว่าท่านได้อ่านและเข้าใจเนื้อหาในนโยบายฉบับนี้
          และได้ให้ความยินยอมแก่โรงพยาบาลในการเก็บรวบรวมและใช้ข้อมูลส่วนบุคคลของท่านตามวัตถุประสงค์ที่ระบุไว้ข้างต้นทุกประการ
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, provide, onMounted } from 'vue'
import Swal from 'sweetalert2'
import type { Patient, PageName, PageOptions, Filters } from './types'

import LoginView from './components/LoginView.vue'
import WelcomeBackView from './components/WelcomeBackView.vue'
import DashboardView from './components/DashboardView.vue'
import BookingFlowStartView from './components/BookingFlowStartView.vue'
import MySlotsView from './components/MySlotsView.vue'
import BookingFormView from './components/BookingFormView.vue'
import MyBookingsView from './components/MyBookingsView.vue'

// ----------------------------------------------------------------
//  State
// ----------------------------------------------------------------
const currentPage = ref<PageName>('login')
const currentPatient = ref<Patient | null>(null)
const currentFilters = ref<Filters>({})
const pageOptions = ref<PageOptions>({})
const showPdpaModal = ref(false)

// Provide PDPA modal toggle to child components
provide('openPdpaModal', () => {
  showPdpaModal.value = true
})

// ----------------------------------------------------------------
//  Navigation helper
// ----------------------------------------------------------------
function navigateTo(page: PageName, options: PageOptions = {}) {
  window.scrollTo(0, 0)
  pageOptions.value = options
  currentPage.value = page
}

// ----------------------------------------------------------------
//  Auth Handlers
// ----------------------------------------------------------------
function handleLoginSuccess(patient: Patient) {
  currentPatient.value = patient
  localStorage.setItem('patientData', JSON.stringify(patient))
  navigateTo('dashboard')
}

function handleConfirmLogin(patient: Patient) {
  currentPatient.value = patient
  navigateTo('dashboard')
}

function handleLogout() {
  currentPatient.value = null
  currentFilters.value = {}
  localStorage.removeItem('patientData')
  Swal.fire({ icon: 'success', title: 'ออกจากระบบสำเร็จ', showConfirmButton: false, timer: 1500 })
  navigateTo('login')
}

// ----------------------------------------------------------------
//  Booking Complete
// ----------------------------------------------------------------
function handleBookingComplete() {
  navigateTo('dashboard')
}

// ----------------------------------------------------------------
//  Initialise portal on mount
// ----------------------------------------------------------------
onMounted(() => {
  const saved = localStorage.getItem('patientData')
  if (saved) {
    try {
      const patient = JSON.parse(saved) as Patient
      currentPatient.value = patient
      navigateTo('welcomeBack')
    } catch {
      localStorage.removeItem('patientData')
      navigateTo('login')
    }
  } else {
    navigateTo('login')
  }
})
</script>
