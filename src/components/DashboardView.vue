<template>
  <div id="patient-dashboard">
    <!-- Next Appointment Card -->
    <div v-if="loadingAppointment" class="loading-spinner">
      <i class="fas fa-spinner fa-spin"></i>
      <p>กำลังโหลดนัดหมาย...</p>
    </div>

    <template v-else>
      <!-- Has upcoming booking -->
      <div v-if="nextBooking" class="next-appointment-card">
        <div class="appointment-date-stub">
          <span class="day">{{ appointmentDay }}</span>
          <span class="month">{{ appointmentMonth }}</span>
        </div>
        <div class="card-content">
          <h4>นัดหมายครั้งถัดไปของท่าน</h4>
          <p>
            <i class="fa-solid fa-clock"></i>
            <strong>เวลา:</strong> {{ nextBooking.booking_time.slice(0, 5) }} น.
          </p>
          <p>
            <i class="fa-solid fa-user-doctor"></i>
            <strong>กับ:</strong> {{ nextBooking.therapist_name }}
          </p>
        </div>
      </div>

      <!-- No upcoming booking -->
      <div v-else class="next-appointment-card no-booking">
        <div class="card-icon">
          <i class="fa-solid fa-calendar-xmark"></i>
        </div>
        <div class="card-content">
          <h4>ยังไม่มีนัดหมายล่วงหน้า</h4>
          <p>ท่านสามารถกด "จองคิวใหม่" เพื่อเริ่มการนัดหมายได้เลย</p>
        </div>
      </div>
    </template>

    <!-- Action Buttons -->
    <div class="home-actions">
      <a href="#" class="btn-home-action btn-primary" @click.prevent="emit('go-to-booking')">
        <div class="action-icon"><i class="fa-solid fa-calendar-plus"></i></div>
        <div class="action-text">
          <span>จองคิวใหม่</span>
          <small>ค้นหาและเลือกวันเวลาที่สะดวก</small>
        </div>
      </a>
      <a href="#" class="btn-home-action btn-secondary" @click.prevent="emit('go-to-my-bookings')">
        <div class="action-icon"><i class="fa-solid fa-list-check"></i></div>
        <div class="action-text">
          <span>นัดหมายของฉัน</span>
          <small>ตรวจสอบและยกเลิกการจอง</small>
        </div>
      </a>
    </div>

    <!-- Stats Bar -->
    <div class="subtle-stats-bar">
      <template v-if="loadingStats">
        <span class="loading-text">กำลังโหลดสถิติ...</span>
      </template>
      <template v-else-if="stats">
        <span class="stat-group">
          <i class="fa-solid fa-calendar-check"></i>
          จองคิวเดือนนี้:
          <span ref="monthlyCounterEl" class="stat-number">0</span> ครั้ง
        </span>
        <span class="stat-divider">|</span>
        <span class="stat-group">
          <i class="fa-solid fa-chart-line"></i>
          จำนวนการจองคิวสะสม:
          <span ref="totalCounterEl" class="stat-number">0</span> ครั้ง
        </span>
      </template>
      <template v-else>
        <span class="loading-text">ไม่สามารถโหลดสถิติได้</span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useSupabase } from '../composables/useSupabase'
import { useHelpers } from '../composables/useHelpers'
import type { Patient, Booking, DashboardStats } from '../types'

const props = defineProps<{
  patient: Patient
}>()

const emit = defineEmits<{
  (e: 'go-to-booking'): void
  (e: 'go-to-my-bookings'): void
}>()

const { findMyBookings, getDashboardStats } = useSupabase()
const { animateCounter } = useHelpers()

const loadingAppointment = ref(true)
const loadingStats = ref(true)
const nextBooking = ref<Booking | null>(null)
const stats = ref<DashboardStats | null>(null)

const monthlyCounterEl = ref<HTMLElement | null>(null)
const totalCounterEl = ref<HTMLElement | null>(null)

const appointmentDay = computed(() => {
  if (!nextBooking.value) return ''
  return new Date(nextBooking.value.booking_date + 'T00:00:00').getDate()
})

const appointmentMonth = computed(() => {
  if (!nextBooking.value) return ''
  return new Date(nextBooking.value.booking_date + 'T00:00:00').toLocaleDateString('th-TH', {
    month: 'short',
  })
})

async function loadNextAppointment() {
  try {
    const { data, error } = await findMyBookings(props.patient.patient_id)
    if (error) throw error
    nextBooking.value = data && data.length > 0 ? data[0] : null
  } catch (err) {
    console.error('Error loading next appointment:', err)
    nextBooking.value = null
  } finally {
    loadingAppointment.value = false
  }
}

async function loadStats() {
  try {
    const { data, error } = await getDashboardStats()
    if (error) throw error
    stats.value = data

    // Animate counters after DOM updates
    await nextTick()
    if (data && monthlyCounterEl.value) {
      animateCounter(monthlyCounterEl.value, data.monthlyBookings)
    }
    if (data && totalCounterEl.value) {
      animateCounter(totalCounterEl.value, data.totalBookings)
    }
  } catch (err) {
    console.error('Could not load dashboard stats:', err)
    stats.value = null
  } finally {
    loadingStats.value = false
  }
}

onMounted(() => {
  loadNextAppointment()
  loadStats()
})
</script>
