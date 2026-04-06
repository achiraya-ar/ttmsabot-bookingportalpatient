<template>
  <div id="booking-start-view">
    <!-- Rebook Card -->
    <div v-if="lastTherapist" class="rebook-card">
      <i class="fa-solid fa-star"></i>
      <div class="rebook-info">
        <h4>กลับมาใช้บริการอีกครั้งใช่ไหมคะ?</h4>
        <p>ครั้งล่าสุดคุณได้นัดหมายกับ <strong>{{ lastTherapist }}</strong></p>
      </div>
      <button class="btn" @click="handleRebook">จองกับท่านเดิม</button>
    </div>

    <!-- Calendar Wrapper -->
    <div id="calendar-wrapper">
      <div id="calendar-view">
        <h2 class="page-title">
          <i class="fa-solid fa-magnifying-glass"></i>ค้นหาคิวว่าง
        </h2>

        <!-- Filters -->
        <div class="filter-container">
          <div class="filter-grid">
            <div class="filter-group">
              <label for="people-filter"><i class="fa-solid fa-users"></i> จำนวนคน</label>
              <select id="people-filter" v-model="filters.people" @change="onPeopleChange">
                <option v-for="n in maxPeople" :key="n" :value="String(n)">{{ n }} คน</option>
              </select>
            </div>
            <div class="filter-group">
              <label for="therapist-filter">
                <i class="fa-solid fa-user-doctor"></i> เลือกหมอ (กรณีมาคนเดียว)
              </label>
              <select
                id="therapist-filter"
                v-model="filters.therapist"
                :disabled="isTherapistDisabled"
                @change="onTherapistChange"
              >
                <option value="">หมอทุกคน</option>
                <option v-for="t in therapists" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div class="filter-group">
              <label for="timeslot-filter">
                <i class="fa-solid fa-clock"></i> เลือกเวลา
              </label>
              <select id="timeslot-filter" v-model="filters.timeSlot">
                <option value="">ทุกช่วงเวลา</option>
                <option v-for="t in visibleTimeSlots" :key="t" :value="t">{{ t }} น.</option>
              </select>
            </div>
          </div>
          <div class="filter-actions">
            <button class="btn-reset" @click="resetFilters">ล้างค่าตัวกรอง</button>
            <button id="search-button" class="btn btn-search-filter" :disabled="isSearching" @click="searchCalendar">
              <i class="fa-solid fa-search"></i> ค้นหาคิว
            </button>
          </div>
        </div>

        <!-- Calendar Header -->
        <div class="calendar-header" id="calendar-header">
          <button class="btn" @click="prevMonth"><i class="fas fa-chevron-left"></i></button>
          <h2>{{ monthYearLabel }}</h2>
          <button class="btn" @click="nextMonth"><i class="fas fa-chevron-right"></i></button>
        </div>

        <!-- Calendar Grid -->
        <div id="calendar-grid-wrapper">
          <div v-if="!hasSearched" class="initial-message">
            กรุณาเลือกเงื่อนไขและกดปุ่ม "ค้นหาคิว"
          </div>
          <div v-else-if="isSearching" class="loading-spinner">
            <i class="fas fa-spinner fa-spin"></i>
            <p>กำลังค้นหาคิว...</p>
          </div>
          <div v-else class="calendar-grid">
            <div v-for="d in dayNames" :key="d" class="day-name">{{ d }}</div>
            <div v-for="_ in firstDayIndex" :key="'empty-' + _"></div>
            <div
              v-for="day in daysInMonth"
              :key="day"
              class="calendar-day"
              :class="`date-${(calendarStatus[dateStr(day)] || 'disabled').toLowerCase()}`"
              @click="onDayClick(day)"
            >
              {{ day }}
            </div>
          </div>
        </div>

        <!-- Legend -->
        <div class="calendar-legend">
          <div class="legend-item">
            <span class="legend-color" style="background-color: var(--status-green)"></span>ว่าง
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background-color: var(--status-red)"></span>เต็ม/ไม่มีคิว
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background-color: var(--status-disabled-bg)"></span>ปิดทำการ
          </div>
        </div>

        <div class="btn-action-group">
          <button class="btn btn-secondary" @click="emit('back')">
            <i class="fa-solid fa-home"></i> กลับหน้าหลัก
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Swal from 'sweetalert2'
import { useSupabase } from '../composables/useSupabase'
import { useHelpers } from '../composables/useHelpers'
import type { Patient, Filters, CalendarStatusMap, PageOptions } from '../types'

const props = defineProps<{
  patient: Patient
  initialFilters: Filters
}>()

const emit = defineEmits<{
  (e: 'go-to-slots', opts: PageOptions): void
  (e: 'back'): void
  (e: 'update-filters', filters: Filters): void
}>()

const { getFilterOptions, getCalendarData, findLastBookingHistory } = useSupabase()
const { formatDateToYYYYMMDD } = useHelpers()

// ----------------------------------------------------------------
//  State
// ----------------------------------------------------------------
const currentDate = ref(new Date())
const filters = ref<Filters>({
  people: props.initialFilters.people || '1',
  therapist: props.initialFilters.therapist || '',
  timeSlot: props.initialFilters.timeSlot || '',
})

const therapists = ref<string[]>([])
const allTimeSlots = ref<string[]>([])
const therapistTimeMap = ref<Record<string, string[]>>({})
const maxPeople = ref(1)
const calendarStatus = ref<CalendarStatusMap>({})
const isSearching = ref(false)
const hasSearched = ref(false)
const lastTherapist = ref('')
const isTherapistDisabled = ref(false)

// ----------------------------------------------------------------
//  Computed
// ----------------------------------------------------------------
const monthYearLabel = computed(() =>
  new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    month: 'long',
    year: 'numeric',
  }).format(currentDate.value),
)

const firstDayIndex = computed(
  () => new Date(currentDate.value.getFullYear(), currentDate.value.getMonth(), 1).getDay(),
)

const daysInMonth = computed(
  () =>
    new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 0).getDate(),
)

const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

const visibleTimeSlots = computed(() => {
  const t = filters.value.therapist
  if (t && therapistTimeMap.value[t]) {
    return therapistTimeMap.value[t]
  }
  return allTimeSlots.value
})

// ----------------------------------------------------------------
//  Helpers
// ----------------------------------------------------------------
function dateStr(day: number): string {
  const y = currentDate.value.getFullYear()
  const m = (currentDate.value.getMonth() + 1).toString().padStart(2, '0')
  const d = day.toString().padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ----------------------------------------------------------------
//  Filter handlers
// ----------------------------------------------------------------
function onPeopleChange() {
  const multiple = parseInt(filters.value.people || '1') > 1
  isTherapistDisabled.value = multiple
  if (multiple) {
    filters.value.therapist = ''
    onTherapistChange()
  }
}

function onTherapistChange() {
  // reset timeslot when therapist changes
  filters.value.timeSlot = ''
}

function resetFilters() {
  filters.value = { people: '1', therapist: '', timeSlot: '' }
  isTherapistDisabled.value = false
  calendarStatus.value = {}
  hasSearched.value = false
}

// ----------------------------------------------------------------
//  Calendar navigation
// ----------------------------------------------------------------
function prevMonth() {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() - 1,
    1,
  )
  if (hasSearched.value) searchCalendar()
}

function nextMonth() {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() + 1,
    1,
  )
  if (hasSearched.value) searchCalendar()
}

// ----------------------------------------------------------------
//  Search calendar
// ----------------------------------------------------------------
async function searchCalendar() {
  isSearching.value = true
  hasSearched.value = true
  emit('update-filters', { ...filters.value })

  const hasActiveFilters =
    filters.value.therapist ||
    filters.value.timeSlot ||
    (filters.value.people && parseInt(filters.value.people, 10) > 1)

  try {
    const { data: response, error } = await getCalendarData(
      currentDate.value.getMonth(),
      currentDate.value.getFullYear(),
      { ...filters.value },
    )

    if (error) throw error
    if (!response) return

    if (response.status === 'FOUND_IN_FUTURE') {
      const msg = hasActiveFilters
        ? {
            icon: 'warning' as const,
            title: 'ไม่พบคิวว่างตามเงื่อนไข',
            text: 'ไม่พบคิวว่างตามเงื่อนไขที่ท่านระบุในเดือนปัจจุบัน ระบบกำลังแสดงเดือนถัดไปที่มีคิวว่างแทน',
          }
        : {
            icon: 'info' as const,
            title: 'เดือนนี้คิวเต็มแล้ว',
            text: 'ระบบกำลังแสดงเดือนถัดไปที่มีคิวว่างให้โดยอัตโนมัติ',
            timer: 3000,
            showConfirmButton: false,
          }
      await Swal.fire(msg)
      currentDate.value = new Date(response.newYear, response.newMonth, 1)
      isSearching.value = false
      return searchCalendar()
    }

    if (response.status === 'NOT_FOUND' && hasActiveFilters) {
      Swal.fire({
        icon: 'warning',
        title: 'ไม่พบคิวว่าง',
        text: 'ไม่พบคิวว่างตามเงื่อนไขที่คุณเลือก กรุณาลองเปลี่ยนเงื่อนไขการค้นหา',
      })
    }

    calendarStatus.value = response.data

    // Scroll calendar into view
    const header = document.getElementById('calendar-header')
    if (header) header.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (err) {
    console.error(err)
    Swal.fire('เกิดข้อผิดพลาด', 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง', 'error')
  } finally {
    isSearching.value = false
  }
}

// ----------------------------------------------------------------
//  Day click
// ----------------------------------------------------------------
function onDayClick(day: number) {
  const ds = dateStr(day)
  if ((calendarStatus.value[ds] || '').toUpperCase() !== 'AVAILABLE') return
  emit('go-to-slots', {
    date: ds,
    filters: { ...filters.value },
    previouslyBookedCount: 0,
  })
}

// ----------------------------------------------------------------
//  Rebook
// ----------------------------------------------------------------
function handleRebook() {
  filters.value.therapist = lastTherapist.value
  filters.value.people = '1'
  isTherapistDisabled.value = false
  searchCalendar()
}

// ----------------------------------------------------------------
//  Mount: load filter options + last booking
// ----------------------------------------------------------------
onMounted(async () => {
  try {
    const [{ data: opts }, { data: lastBooking }] = await Promise.all([
      getFilterOptions(),
      findLastBookingHistory(props.patient.patient_id),
    ])

    if (opts) {
      therapists.value = opts.therapists
      allTimeSlots.value = opts.timeSlots
      therapistTimeMap.value = opts.therapistTimeMap
      maxPeople.value = opts.maxPeople || 1
    }

    if (lastBooking?.therapist_name) {
      lastTherapist.value = lastBooking.therapist_name
    }

    // Restore filters if navigating back
    if (
      props.initialFilters.therapist ||
      props.initialFilters.timeSlot ||
      (props.initialFilters.people && parseInt(props.initialFilters.people) > 1)
    ) {
      filters.value = {
        people: props.initialFilters.people || '1',
        therapist: props.initialFilters.therapist || '',
        timeSlot: props.initialFilters.timeSlot || '',
      }
      isTherapistDisabled.value = parseInt(filters.value.people || '1') > 1
      await searchCalendar()
    }
  } catch (err) {
    console.error('Error loading filter options:', err)
    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลตัวกรองได้', 'error')
  }
})

// expose for formatting
const _formatDateToYYYYMMDD = formatDateToYYYYMMDD
void _formatDateToYYYYMMDD
</script>
