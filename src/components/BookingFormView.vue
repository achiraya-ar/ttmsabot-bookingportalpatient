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
            placeholder="กรอกเลขบัตรประชาชน 13 หลัก"
            maxlength="13"
            :disabled="isCheckingPatient"
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
        <p class="patient-verify-hint" :class="{ 'is-verified': isSecondaryVerified }">
          <i :class="isSecondaryVerified ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-info'"></i>
          {{
            isSecondaryVerified
              ? 'ยืนยันผู้ป่วยที่ลงทะเบียนแล้ว'
              : 'ต้องเป็นผู้ป่วยที่ลงทะเบียนไว้แล้วเท่านั้น'
          }}
        </p>
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
          :readonly="isPrimaryBooker || isSecondaryVerified"
          :disabled="!isPrimaryBooker && !isSecondaryVerified"
          :required="!isPrimaryBooker"
        />
      </div>

      <div class="form-group">
        <label for="patientLastName">นามสกุล</label>
        <input
          id="patientLastName"
          v-model="lastName"
          type="text"
          :readonly="isPrimaryBooker || isSecondaryVerified"
          :disabled="!isPrimaryBooker && !isSecondaryVerified"
          :required="!isPrimaryBooker"
        />
      </div>

      <div class="form-group">
        <label for="patientPhone">เบอร์โทรศัพท์</label>
        <input
          id="patientPhone"
          v-model="phone"
          type="tel"
          :readonly="isPrimaryBooker || isSecondaryVerified"
          :disabled="!isPrimaryBooker && !isSecondaryVerified"
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
          v-if="!isPrimaryBooker"
          type="button"
          id="cancel-secondary-booking"
          class="btn btn-cancel"
          :disabled="isSubmitting"
          @click="handleCancelRemaining"
        >
          <i class="fa-solid fa-xmark"></i> ยกเลิกการจองคนที่ {{ bookingPersonNumber }}
        </button>
        <button
          type="submit"
          id="submit-booking-btn"
          class="btn"
          :disabled="!pdpaAccepted || isSubmitting || (!isPrimaryBooker && !isSecondaryVerified)"
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
import { ref, computed, inject, onMounted, watch } from 'vue'
import Swal from 'sweetalert2'
import { useSupabase } from '../composables/useSupabase'
import { useHelpers } from '../composables/useHelpers'
import { useSlip } from '../composables/useSlip'
import type { Patient, Filters, BookingInfo, PageOptions } from '../types'

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
  (e: 'next-person', options: PageOptions): void
  (e: 'cancel-remaining'): void
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
const verifiedSecondaryPatient = ref<Patient | null>(null)

const isSecondaryVerified = computed(() => {
  const verified = verifiedSecondaryPatient.value
  return !!verified && verified.patient_id === patientId.value.trim()
})

// If the ID is edited after verification, clear the fetched data so the
// secondary patient must be verified again before booking.
watch(patientId, (newId) => {
  if (isPrimaryBooker.value) return
  const verified = verifiedSecondaryPatient.value
  if (verified && newId.trim() !== verified.patient_id) {
    verifiedSecondaryPatient.value = null
    firstName.value = ''
    lastName.value = ''
    phone.value = ''
  }
})

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
      verifiedSecondaryPatient.value = null
      firstName.value = ''
      lastName.value = ''
      phone.value = ''
      Swal.fire({
        icon: 'warning',
        title: 'ไม่พบข้อมูลการลงทะเบียน',
        html: `ไม่พบเลขบัตรประชาชนนี้ในฐานข้อมูลผู้รับบริการ<br>ระบบอนุญาตให้จองคิวเฉพาะผู้ที่ลงทะเบียนแล้วเท่านั้น<br><br>กรุณาติดต่อลงทะเบียนล่วงหน้าที่ <strong>กลุ่มงานการแพทย์แผนไทย โรงพยาบาลสระโบสถ์</strong><br>หรือโทร <strong>082-202-9667</strong> (ในวันและเวลาราชการ)`,
        confirmButtonText: 'รับทราบ',
      })
      return
    }

    if (patient.patient_id.trim() === props.patient.patient_id.trim()) {
      verifiedSecondaryPatient.value = null
      firstName.value = ''
      lastName.value = ''
      phone.value = ''
      Swal.fire(
        'ไม่สามารถจองซ้ำได้',
        'เลขบัตรประชาชนนี้เป็นของผู้ใช้ที่เข้าสู่ระบบอยู่ กรุณากรอกเลขบัตรประชาชนของเพื่อนหรือผู้ร่วมเดินทาง',
        'warning',
      )
      return
    }

    verifiedSecondaryPatient.value = patient
    firstName.value = patient.first_name
    lastName.value = patient.last_name
    phone.value = patient.phone_number
    Swal.fire(
      'พบข้อมูลผู้ป่วยที่ลงทะเบียนแล้ว',
      `ยืนยันข้อมูลของคุณ ${patient.first_name} ${patient.last_name} เรียบร้อย`,
      'success',
    )
  } catch (err) {
    console.error(err)
    Swal.fire('เกิดข้อผิดพลาด', 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง', 'error')
  } finally {
    isCheckingPatient.value = false
  }
}

// ----------------------------------------------------------------
//  Cancel the remaining bookings in this multi-person flow
// ----------------------------------------------------------------
async function handleCancelRemaining() {
  const personNumber = bookingPersonNumber.value
  const remainingPeople = peopleCount.value - props.previouslyBookedCount

  const result = await Swal.fire({
    title: `ยกเลิกการจองคนที่ ${personNumber}?`,
    html:
      remainingPeople > 1
        ? `ระบบจะยกเลิกการจองสำหรับคนที่ ${personNumber} และคนถัดไป<br>การจองที่สำเร็จแล้วจะยังคงอยู่`
        : `ระบบจะยกเลิกการจองสำหรับคนที่ ${personNumber}<br>การจองที่สำเร็จแล้วจะยังคงอยู่`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ยืนยันยกเลิก',
    cancelButtonText: 'ไม่ยกเลิก',
    confirmButtonColor: 'var(--status-red)',
  })

  if (!result.isConfirmed) return

  await Swal.fire({
    icon: 'success',
    title: `ยกเลิกการจองคนที่ ${personNumber} แล้ว`,
    text: 'การจองที่สำเร็จก่อนหน้าจะยังคงอยู่',
    timer: 1800,
    showConfirmButton: false,
  })

  emit('cancel-remaining')
}

// ----------------------------------------------------------------
//  Submit booking
// ----------------------------------------------------------------
async function handleSubmit() {
  if (!pdpaAccepted.value) {
    Swal.fire('ข้อผิดพลาด', 'กรุณายินยอมในนโยบายคุ้มครองข้อมูลส่วนบุคคล', 'warning')
    return
  }

  // Secondary patients must be registered and verified before booking.
  if (!isPrimaryBooker.value) {
    const verified = verifiedSecondaryPatient.value
    if (!isSecondaryVerified.value || !verified) {
      Swal.fire({
        icon: 'warning',
        title: 'กรุณาตรวจสอบข้อมูลก่อนจอง',
        text: 'กรุณาตรวจสอบเลขบัตรประชาชนของผู้เข้ารับบริการคนนี้ และต้องเป็นผู้ที่ลงทะเบียนแล้วเท่านั้น',
      })
      return
    }

    patientId.value = verified.patient_id
    firstName.value = verified.first_name
    lastName.value = verified.last_name
    phone.value = verified.phone_number
  }

  if (!patientId.value.trim() || !firstName.value.trim() || !lastName.value.trim() || !phone.value.trim()) {
    Swal.fire(
      'ข้อมูลไม่ครบถ้วน',
      'ไม่พบข้อมูลผู้เข้ารับบริการที่ครบถ้วน กรุณาตรวจสอบเลขบัตรประชาชนอีกครั้ง',
      'warning',
    )
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
        const nextPersonNumber = newBookedCount + 1
        const nextChoice = await Swal.fire({
          title: `จองคิวสำหรับคนที่ ${nextPersonNumber} ต่อหรือไม่?`,
          html: `การจองของคนที่ ${newBookedCount} สำเร็จแล้ว<br>หากไม่ต้องการจองต่อ ท่านสามารถยกเลิกการจองคนที่ ${nextPersonNumber} ได้`,
          icon: 'question',
          showDenyButton: true,
          allowOutsideClick: false,
          allowEscapeKey: false,
          confirmButtonText: `จองคนที่ ${nextPersonNumber} ต่อ`,
          denyButtonText: `ยกเลิกการจองคนที่ ${nextPersonNumber}`,
          denyButtonColor: 'var(--status-red)',
        })

        if (nextChoice.isDenied) {
          await Swal.fire({
            icon: 'success',
            title: `ยกเลิกการจองคนที่ ${nextPersonNumber} แล้ว`,
            text: 'การจองที่สำเร็จแล้วจะยังคงอยู่',
          })
          emit('cancel-remaining')
          return
        }

        // Navigate back to slots with the updated booked count so the next
        // person gets the correct booking form.
        emit('next-person', {
          date: props.date,
          filters: { ...props.filters },
          previouslyBookedCount: newBookedCount,
        })
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
