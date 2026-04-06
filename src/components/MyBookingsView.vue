<template>
  <div id="my-bookings-view">
    <h2 class="page-title">
      <i class="fa-solid fa-list-check"></i> นัดหมายของฉัน
    </h2>

    <div v-if="isLoading" class="loading-spinner">
      <i class="fas fa-spinner fa-spin"></i>
      <p>กำลังโหลดข้อมูลนัดหมายของท่าน...</p>
    </div>

    <template v-else>
      <!-- No bookings -->
      <div
        v-if="bookings.length === 0"
        class="booking-summary"
        style="border-left-color: var(--status-yellow); text-align: center"
      >
        <p class="summary-item">
          <i class="fa-solid fa-circle-info"></i> ไม่พบรายการนัดหมายล่วงหน้า
        </p>
      </div>

      <!-- Bookings Table -->
      <div v-else class="slots-table-container">
        <table class="slots-table">
          <thead>
            <tr>
              <th>วันที่นัด</th>
              <th>เวลา</th>
              <th>ชื่อหมอ</th>
              <th>การดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="booking in bookings" :key="booking.booking_id">
              <td data-label="วันที่นัด">{{ formatThaiDate(booking.booking_date, false) }}</td>
              <td data-label="เวลา">{{ booking.booking_time.slice(0, 5) }} น.</td>
              <td data-label="ชื่อหมอ">{{ booking.therapist_name }}</td>
              <td data-label="ดำเนินการ">
                <div class="action-buttons-cell">
                  <button
                    class="btn btn-slot btn-print-save"
                    style="background-color: var(--secondary-accent)"
                    @click="handlePrintSave(booking)"
                  >
                    <i :class="['fa-solid', isMobile() ? 'fa-download' : 'fa-print']"></i>
                    {{ isMobile() ? 'บันทึก' : 'พิมพ์' }}
                  </button>
                  <button
                    class="btn btn-slot btn-cancel"
                    style="background-color: var(--status-red)"
                    @click="handleCancel(booking)"
                  >
                    <i class="fa-solid fa-trash-can"></i> ยกเลิก
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <div class="btn-action-group">
      <button class="btn btn-secondary" @click="emit('back')">
        <i class="fa-solid fa-home"></i> กลับหน้าหลัก
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Swal from 'sweetalert2'
import { useSupabase } from '../composables/useSupabase'
import { useHelpers } from '../composables/useHelpers'
import { useSlip } from '../composables/useSlip'
import type { Patient, Booking } from '../types'

const props = defineProps<{
  patient: Patient
}>()

const emit = defineEmits<{
  (e: 'back'): void
}>()

const { findMyBookings, cancelBooking } = useSupabase()
const { formatThaiDate, isMobile } = useHelpers()
const { createPrintSlip, captureAndSaveSlip } = useSlip()

const isLoading = ref(true)
const bookings = ref<Booking[]>([])

// ----------------------------------------------------------------
//  Load bookings on mount
// ----------------------------------------------------------------
async function loadBookings() {
  isLoading.value = true
  try {
    const { data, error } = await findMyBookings(props.patient.patient_id)
    if (error) throw error
    bookings.value = data ?? []
  } catch (err) {
    console.error('Error loading bookings:', err)
    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลนัดหมายได้ กรุณาลองใหม่อีกครั้ง', 'error')
    bookings.value = []
  } finally {
    isLoading.value = false
  }
}

// ----------------------------------------------------------------
//  Print / Save
// ----------------------------------------------------------------
function handlePrintSave(booking: Booking) {
  if (isMobile()) {
    captureAndSaveSlip(booking)
  } else {
    createPrintSlip(booking)
  }
}

// ----------------------------------------------------------------
//  Cancel booking
// ----------------------------------------------------------------
async function handleCancel(booking: Booking) {
  const detailsHtml = `
    <div style="text-align:left;padding:0 1rem;font-size:1rem;">
      <p><strong>ผู้จอง:</strong> ${booking.patient_first_name} ${booking.patient_last_name}</p>
      <hr>
      <p><strong>วันที่:</strong> ${formatThaiDate(booking.booking_date, true)}</p>
      <p><strong>เวลา:</strong> ${booking.booking_time.slice(0, 5)} น.</p>
      <p><strong>ชื่อหมอ:</strong> ${booking.therapist_name}</p>
    </div>
    <br>
    <p>คุณต้องการยกเลิกนัดหมายนี้ใช่หรือไม่?</p>
  `

  const result = await Swal.fire({
    title: 'ยืนยันการยกเลิกนัดหมาย?',
    html: detailsHtml,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ยืนยันยกเลิก',
    cancelButtonText: 'ปิด',
    confirmButtonColor: 'var(--status-red)',
  })

  if (!result.isConfirmed) return

  Swal.fire({
    title: 'กำลังยกเลิกนัดหมาย...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  })

  try {
    const { data: res, error } = await cancelBooking(booking)
    if (error) throw error

    if (res?.success) {
      await Swal.fire('สำเร็จ', 'ยกเลิกนัดหมายเรียบร้อยแล้ว', 'success')
      await loadBookings()
    } else {
      Swal.fire('เกิดข้อผิดพลาด', res?.message || 'ไม่สามารถยกเลิกได้', 'error')
    }
  } catch (err) {
    console.error(err)
    Swal.fire('เกิดข้อผิดพลาด', 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง', 'error')
  }
}

onMounted(() => {
  loadBookings()
})
</script>
