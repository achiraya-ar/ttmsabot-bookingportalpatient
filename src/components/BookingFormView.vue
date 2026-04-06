<template>
  <div id="form-view">
    <h2 class="page-title">
      <i class="fa-solid fa-file-lines"></i>{{ formTitle }}
    </h2>

    <!-- Booking Summary -->
    <div class="booking-summary">
      <p class="summary-item">
        <i class="fa-solid fa-user-doctor"></i>
        <strong>ชื่อหมอ:</strong> {{ therapist }}
      </p>
      <p class="summary-item">
        <i class="fa-solid fa-calendar-alt"></i>
        <strong>วันที่:</strong> {{ formatThaiDate(date) }}
      </p>
      <p class="summary-item">
        <i class="fa-solid fa-clock"></i>
        <strong>เวลา:</strong> {{ time }} น.
      </p>
    </div>

    <form id="booking-form" class="booking-form" novalidate @submit.prevent="handleSubmit">
      <!-- Secondary patient ID check (non-primary booker) -->
      <div v-if="!isPrimaryBooker" class="form-group person-check-group">
        <label :for="'patientId'">เลขบัตรประชาชน (คนที่ {{ bookingPersonNumber }})</label>
        <div class="input-with-button">
          <input
            id="patientId"
            v-model="patientId"
            type="tel"
            required
            pattern="[0-9]{13}"
            inputmode="numeric"
            maxlength="13"
          />
          <button
            type="button"
            id="check-secondary-patient"
            class="btn btn-secondary"
            :disabled="isCheckingPatient"
            @click="checkSecondaryPatient"
          >
            <i v-if="isCheckingPatient" class="fas fa-spinner fa-spin"></i>
            <span v-else>ตรวจสอบ</span>
          </button>
        </div>
      </div>

      <!-- Primary patient ID (readonly) -->
      <div v-else class="form-group">
        <label for="patientId">เลขบัตรประชาชน</label>
        <input id="patientId" v-model="patientId" type="tel" readonly />
      </div>

      <div class="form-group">
        <label for="patientFirstName">ชื่อ</label>
        <input
          id="patientFirstName"
          v-model="firstName"
          type="text"
          :readonly="isPrimaryBooker"
          :required="!isPrimaryBooker"
        />
      </div>

      <div class="form-group">
        <label for="patientLastName">นามสกุล</label>
        <input
          id="patientLastName"
          v-model="lastName"
          type="text"
          :readonly="isPrimaryBooker"
          :required="!isPrimaryBooker"
        />
      </div>

      <div class="form-group">
        <label for="patientPhone">เบอร์โทรศัพท์</label>
        <input
          id="patientPhone"
          v-model="phone"
          type="tel"
          :readonly="isPrimaryBooker"
          :required="!isPrimaryBooker"
        />
      </div>

      <!-- PDPA Consent -->
      <div class="pdpa-consent-container">
        <label class="pdpa-checkbox-group">
          <input
            id="pdpa-consent"
            v-model="pdpaAccepted"
            type="checkbox"
            required
          />
          <span class="pdpa-text">
            ข้าพเจ้ารับทราบและยินยอมตาม
            <a href="#" class="pdpa-link" @click.prevent="openPdpaModal">นโยบายคุ้มครองข้อมูลส่วนบุคคล</a>
          </span>
        </label>
      </div>

      <div class="btn-action-group">
        <button type="button" class="btn btn-secondary" @click="emit('back')">
          <i class="fa-solid fa-arrow-left"></i> กลับ
        </button>
        <button
          type="submit"
          id="submit-booking-btn"
          class="btn"
          :disabled="!pdpaAccepted || isSubmitting"
        >
          <i v-if="isSubmitting" class="fas fa-spinner fa-spin"></i>
          <i v-else class="fa-solid fa-check"></i>
          {{ isSubmitting ? 'กำลังดำเนินการ...' : 'ยืนยันการจอง' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted } from 'vue'
import Swal from 'sweetalert2'
import { useSupabase } from '../composables/useSupabase'
import { useHelpers } from '../composables/useHelpers'
import { useSlip } from '../composables/useSlip'
import type { Patient, Filters, BookingInfo } from '../types'

const props = defineProps<{
  patient: Patient
  date: string
  time: string
  therapist: string
  filters: Filters
  previouslyBookedCount: number
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'booking-complete'): void
}>()

const { checkPatientRegistration, processBooking } = useSupabase()
const { formatThaiDate, validateThaiId, isMobile } = useHelpers()
const { generateSlipHTML, createPrintSlip, captureAndSaveSlip, generateCalendarLink } = useSlip()

// Inject PDPA modal opener from App.vue
const openPdpaModal = inject<() => void>('openPdpaModal', () => {})

// ----------------------------------------------------------------
//  Computed
// ----------------------------------------------------------------
const bookingPersonNumber = computed(() => props.previouslyBookedCount + 1)
const isPrimaryBooker = computed(() => bookingPersonNumber.value === 1)
const peopleCount = computed(() => parseInt(props.filters.people || '1'))

const formTitle = computed(() => {
  if (peopleCount.value > 1) {
    return `ข้อมูลการจอง (คนที่ ${bookingPersonNumber.value}/${peopleCount.value})`
  }
  return 'ยืนยันข้อมูลการจอง'
})

// ----------------------------------------------------------------
//  Form state
// ----------------------------------------------------------------
const patientId = ref('')
const firstName = ref('')
const lastName = ref('')
const phone = ref('')
const pdpaAccepted = ref(false)
const isCheckingPatient = ref(false)
const isSubmitting = ref(false)

// ----------------------------------------------------------------
//  Secondary patient check
// ----------------------------------------------------------------
async function checkSecondaryPatient() {
  const id = patientId.value.trim()
  if (!validateThaiId(id)) {
    Swal.fire('ข้อมูลไม่ถูกต้อง', 'รูปแบบเลขบัตรประชาชนไม่ถูกต้อง', 'error')
    return
  }

  isCheckingPatient.value = true
  try {
    const { data: patient, error } = await checkPatientRegistration(id)
    if (error || !patient) {
      Swal.fire(
        'ไม่พบข้อมูล',
        'ไม่พบข้อมูลผู้ป่วยท่านนี้ในระบบ กรุณาตรวจสอบหรือติดต่อเจ้าหน้าที่เพื่อลงทะเบียน',
        'warning',
      )
      return
    }
    firstName.value = patient.first_name
    lastName.value = patient.last_name
    phone.value = patient.phone_number
    Swal.fire('พบข้อมูล!', `ดึงข้อมูลของ คุณ ${patient.first_name} เรียบร้อย`, 'success')
  } catch (err) {
    console.error(err)
    Swal.fire('เกิดข้อผิดพลาด', 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง', 'error')
  } finally {
    isCheckingPatient.value = false
  }
}

// ----------------------------------------------------------------
//  Submit booking
// ----------------------------------------------------------------
async function handleSubmit() {
  if (!pdpaAccepted.value) {
    Swal.fire('ข้อผิดพลาด', 'กรุณายินยอมในนโยบายคุ้มครองข้อมูลส่วนบุคคล', 'warning')
    return
  }

  const bookingInfo: BookingInfo = {
    date: props.date,
    time: props.time,
    therapist: props.therapist,
    patientId: patientId.value,
    patientFirstName: firstName.value,
    patientLastName: lastName.value,
    patientPhone: phone.value,
  }

  // Confirmation dialog
  const confirmationHtml = `
    <div style="text-align:left;padding:0 1rem;font-size:1rem;">
      <p><strong>ชื่อ-สกุล:</strong> ${bookingInfo.patientFirstName} ${bookingInfo.patientLastName}</p>
      <p><strong>เบอร์โทร:</strong> ${bookingInfo.patientPhone}</p>
      <hr>
      <p><strong>ชื่อหมอ:</strong> ${bookingInfo.therapist}</p>
      <p><strong>วันที่:</strong> ${formatThaiDate(bookingInfo.date)}</p>
      <p><strong>เวลา:</strong> ${bookingInfo.time} น.</p>
    </div>
  `

  const result = await Swal.fire({
    title: 'ยืนยันการจอง?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก',
    html: confirmationHtml,
  })

  if (!result.isConfirmed) return

  // Show loading
  Swal.fire({
    title: 'กำลังดำเนินการจอง',
    text: 'กรุณารอสักครู่...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  })

  isSubmitting.value = true
  try {
    const { data: res, error } = await processBooking(bookingInfo)
    if (error) throw error

    if (res && res.success) {
      const newBookedCount = props.previouslyBookedCount + 1
      const slipHtml = generateSlipHTML(bookingInfo)
      const mobile = isMobile()

      await Swal.fire({
        title: `จองสำเร็จ! ${peopleCount.value > 1 ? `(คนที่ ${newBookedCount}/${peopleCount.value})` : ''}`,
        icon: 'success',
        html: `<div id="slip-for-mobile">${slipHtml}</div>`,
        showCloseButton: true,
        showConfirmButton: true,
        confirmButtonText: mobile
          ? '<i class="fa-solid fa-download"></i> บันทึกเป็นรูปภาพ'
          : '<i class="fa-solid fa-print"></i> พิมพ์ใบนัด',
        ...(mobile && {
          showDenyButton: true,
          denyButtonText: '<i class="fa-solid fa-calendar-plus"></i> เพิ่มลงในปฏิทิน',
        }),
        preConfirm: () => {
          mobile ? captureAndSaveSlip(bookingInfo) : createPrintSlip(bookingInfo)
          return false
        },
        preDeny: () => {
          generateCalendarLink(bookingInfo)
          return false
        },
      })

      // Multi-person flow
      if (peopleCount.value > 1 && newBookedCount < peopleCount.value) {
        Swal.fire({
          title: `จองคิวคนถัดไป (คนที่ ${newBookedCount + 1})`,
          text: 'กรุณากดปุ่ม "จอง" ในช่องที่ว่าง เพื่อจองคิวให้คนถัดไป',
          icon: 'info',
          timer: 3500,
          showConfirmButton: false,
        })
        // Navigate back to slots with updated count
        emit('back') // parent will re-render slots with previouslyBookedCount = newBookedCount
      } else {
        if (peopleCount.value > 1) {
          await Swal.fire('เสร็จสมบูรณ์!', `การจองคิวสำหรับ ${peopleCount.value} ท่านเรียบร้อยแล้ว`, 'success')
        }
        emit('booking-complete')
      }
    } else {
      await Swal.fire('จองไม่สำเร็จ', res?.message || 'เกิดข้อผิดพลาด', 'error')
      emit('back')
    }
  } catch (err) {
    console.error(err)
    Swal.fire('เกิดข้อผิดพลาด', 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง', 'error')
  } finally {
    isSubmitting.value = false
  }
}

// ----------------------------------------------------------------
//  Initialise form fields
// ----------------------------------------------------------------
onMounted(() => {
  if (isPrimaryBooker.value) {
    patientId.value = props.patient.patient_id
    firstName.value = props.patient.first_name
    lastName.value = props.patient.last_name
    phone.value = props.patient.phone_number
  }
})
</script>
