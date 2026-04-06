<template>
  <div id="slots-view">
    <h2 class="page-title">
      <i class="fa-solid fa-clock"></i>ตารางจองนัดหมาย
    </h2>
    <p>วันที่เลือก: <strong>{{ formatThaiDate(date) }}</strong></p>

    <div v-if="isLoading" class="loading-spinner">
      <i class="fas fa-spinner fa-spin"></i>
      <p>กำลังโหลดตารางเวลา...</p>
    </div>

    <template v-else>
      <!-- No slots available -->
      <div
        v-if="!slotData || slotData.therapists.length === 0"
        class="booking-summary"
        style="border-left-color: var(--status-yellow); text-align: center"
      >
        <p class="summary-item">
          <i class="fa-solid fa-circle-info"></i>
          ขออภัย วันนี้ไม่มีคิวว่างตามเงื่อนไขที่ท่านเลือก
        </p>
      </div>

      <!-- Slots Table -->
      <div v-else class="slots-table-container">
        <table class="slots-table">
          <thead>
            <tr>
              <th>เวลา</th>
              <th v-for="therapist in slotData.therapists" :key="therapist">{{ therapist }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="slot in slotData.slots" :key="slot.time">
              <td data-label="เวลา">{{ slot.time }}</td>
              <td
                v-for="therapist in slotData.therapists"
                :key="therapist"
                :data-label="therapist"
              >
                <button
                  v-if="slot.availability[therapist] === 'AVAILABLE'"
                  class="btn btn-slot btn-book"
                  @click="handleBook(slot.time, therapist)"
                >
                  จอง
                </button>
                <button
                  v-else-if="slot.availability[therapist] === 'FULL'"
                  class="btn btn-slot btn-full"
                  disabled
                >
                  เต็ม
                </button>
                <span v-else>-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <div class="btn-action-group">
      <button class="btn btn-secondary" @click="emit('back')">
        <i class="fa-solid fa-arrow-left"></i> กลับไปที่ปฏิทิน
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Swal from 'sweetalert2'
import { useSupabase } from '../composables/useSupabase'
import { useHelpers } from '../composables/useHelpers'
import type { Filters, SlotsData, PageOptions } from '../types'

const props = defineProps<{
  date: string
  filters: Filters
  previouslyBookedCount: number
}>()

const emit = defineEmits<{
  (e: 'go-to-form', opts: PageOptions): void
  (e: 'back'): void
}>()

const { getAvailableSlots } = useSupabase()
const { formatThaiDate } = useHelpers()

const isLoading = ref(true)
const slotData = ref<SlotsData | null>(null)

async function loadSlots() {
  isLoading.value = true
  try {
    const { data, error } = await getAvailableSlots(props.date, props.filters)
    if (error) throw error
    slotData.value = data
  } catch (err) {
    console.error(err)
    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดตารางเวลาได้ กรุณาลองใหม่อีกครั้ง', 'error')
  } finally {
    isLoading.value = false
  }
}

function handleBook(time: string, therapist: string) {
  emit('go-to-form', {
    date: props.date,
    time,
    therapist,
    filters: props.filters,
    previouslyBookedCount: props.previouslyBookedCount,
  })
}

onMounted(() => {
  loadSlots()
})
</script>
