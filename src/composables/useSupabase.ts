// =====================================================================
//  Supabase Data-Access Composable
//  All database interaction functions, fully typed
// =====================================================================

import { supabase } from '../lib/supabase'
import type {
  Patient,
  Booking,
  BookingInfo,
  SlotsData,
  SlotInfo,
  SlotAvailability,
  CalendarResult,
  CalendarStatusMap,
  CalendarDayStatus,
  FilterOptions,
  Filters,
  DashboardStats,
  ProcessBookingResult,
  CancelBookingResult,
} from '../types'
import { useHelpers } from './useHelpers'

const SUPABASE_ERROR_CODE_NO_ROWS = 'PGRST116'

export function useSupabase() {
  const { formatDateToYYYYMMDD } = useHelpers()

  // ----------------------------------------------------------------
  //  Patient Registration Check
  // ----------------------------------------------------------------
  async function checkPatientRegistration(
    patientId: string,
  ): Promise<{ data: Patient | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('bookings_register')
        .select('*')
        .eq('patient_id', patientId)
        .single()

      if (error && error.code !== SUPABASE_ERROR_CODE_NO_ROWS) throw error
      return { data: data ?? null, error: data ? null : (error as Error | null) }
    } catch (e) {
      return { data: null, error: e as Error }
    }
  }

  // ----------------------------------------------------------------
  //  Filter Options (therapists, time slots, max people)
  // ----------------------------------------------------------------
  async function getFilterOptions(): Promise<{ data: FilterOptions | null; error: Error | null }> {
    try {
      const { data: schedulesData, error } = await supabase
        .from('schedules')
        .select('therapist_name, time_slots, visibility')
        .eq('visibility', 'public')

      if (error) throw error

      const uniqueTherapists = [
        ...new Set((schedulesData ?? []).map((row: { therapist_name: string }) => row.therapist_name.trim())),
      ].sort() as string[]

      const maxPeople = uniqueTherapists.length
      const allTimeSlots = new Set<string>()
      const therapistTimeMap: Record<string, Set<string>> = {}

      ;(schedulesData ?? []).forEach(
        (row: { therapist_name: string; time_slots: string[] | null }) => {
          if (row.time_slots && row.time_slots.length > 0) {
            const therapist = row.therapist_name.trim()
            if (!therapistTimeMap[therapist]) {
              therapistTimeMap[therapist] = new Set()
            }
            row.time_slots.forEach((slot: string) => {
              const trimmedSlot = slot.trim()
              therapistTimeMap[therapist].add(trimmedSlot)
              allTimeSlots.add(trimmedSlot)
            })
          }
        },
      )

      const therapistTimeMapResult: Record<string, string[]> = {}
      for (const therapist in therapistTimeMap) {
        therapistTimeMapResult[therapist] = Array.from(therapistTimeMap[therapist]).sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true }),
        )
      }

      const sortedTimeSlots = Array.from(allTimeSlots).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      )

      return {
        data: {
          therapists: uniqueTherapists,
          timeSlots: sortedTimeSlots,
          maxPeople,
          therapistTimeMap: therapistTimeMapResult,
        },
        error: null,
      }
    } catch (e) {
      return { data: null, error: e as Error }
    }
  }

  // ----------------------------------------------------------------
  //  Calendar Data
  // ----------------------------------------------------------------
  async function getCalendarData(
    month: number,
    year: number,
    filters: Filters = {},
  ): Promise<{ data: CalendarResult | null; error: Error | null }> {
    async function _checkMonthAvailability(
      checkMonth: number,
      checkYear: number,
    ): Promise<{ calendarStatus: CalendarStatusMap; isAnyDayAvailable: boolean }> {
      const startDate = new Date(checkYear, checkMonth, 1)
      const endDate = new Date(checkYear, checkMonth + 1, 0)
      const firstDayOfMonth = formatDateToYYYYMMDD(startDate)
      const lastDayOfMonth = formatDateToYYYYMMDD(endDate)

      const [
        { data: holidaysData, error: e1 },
        { data: schedulesData, error: e2 },
        { data: bookingsData, error: e3 },
        { data: blockagesData, error: e4 },
      ] = await Promise.all([
        supabase
          .from('holidays')
          .select('holiday_date')
          .gte('holiday_date', firstDayOfMonth)
          .lte('holiday_date', lastDayOfMonth),
        supabase
          .from('schedules')
          .select('therapist_name, day_of_week, time_slots, visibility')
          .eq('visibility', 'public'),
        supabase
          .from('bookings')
          .select('booking_date, booking_time, therapist_name')
          .gte('booking_date', firstDayOfMonth)
          .lte('booking_date', lastDayOfMonth),
        supabase
          .from('blockages')
          .select('block_date, block_time, therapist_name')
          .gte('block_date', firstDayOfMonth)
          .lte('block_date', lastDayOfMonth),
      ])

      const error = e1 || e2 || e3 || e4
      if (error) throw error

      const todayString = formatDateToYYYYMMDD(new Date())
      const maxBookingDate = new Date()
      maxBookingDate.setDate(maxBookingDate.getDate() + 30)
      const maxBookingDateString = formatDateToYYYYMMDD(maxBookingDate)

      const holidays = (holidaysData ?? []).map(
        (h: { holiday_date: string }) => h.holiday_date,
      )
      const peopleToFind = parseInt(filters.people || '1')
      const calendarStatus: CalendarStatusMap = {}
      let isAnyDayAvailable = false

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateString = formatDateToYYYYMMDD(d)
        const dayOfWeek = d.getDay()

        if (
          dateString < todayString ||
          dateString > maxBookingDateString ||
          holidays.includes(dateString) ||
          dayOfWeek === 0 ||
          dayOfWeek === 6
        ) {
          calendarStatus[dateString] = 'DISABLED' as CalendarDayStatus
          continue
        }

        const todaysSchedules = (schedulesData ?? []).filter(
          (s: { day_of_week: number; therapist_name: string }) => {
            if (s.day_of_week != dayOfWeek) return false
            if (filters.therapist && s.therapist_name.trim() !== filters.therapist) return false
            return true
          },
        )

        if (todaysSchedules.length < peopleToFind) {
          calendarStatus[dateString] = 'FULL' as CalendarDayStatus
          continue
        }

        const bookingsOnDate = (bookingsData ?? []).filter(
          (b: { booking_date: string }) => b.booking_date === dateString,
        )
        const blockagesOnDate = (blockagesData ?? []).filter(
          (bl: { block_date: string }) => bl.block_date === dateString,
        )

        const timeSlotsToday = new Set<string>()
        todaysSchedules.forEach((s: { time_slots: string[] | null }) => {
          if (s.time_slots) s.time_slots.forEach((slot: string) => timeSlotsToday.add(slot.trim()))
        })

        let isDayAvailable = false

        for (const time of Array.from(timeSlotsToday).sort((a, b) => a.localeCompare(b))) {
          if (filters.timeSlot && time !== filters.timeSlot) continue

          let availableTherapists = 0

          for (const schedule of todaysSchedules) {
            const therapistName = (schedule as { therapist_name: string }).therapist_name.trim()
            const scheduleTimeslots = (schedule as { time_slots: string[] | null }).time_slots

            if (scheduleTimeslots && scheduleTimeslots.includes(time)) {
              const isBooked = bookingsOnDate.some(
                (b: { booking_time: string; therapist_name: string }) =>
                  b.booking_time.slice(0, 5) === time && b.therapist_name.trim() === therapistName,
              )
              const isBlocked = blockagesOnDate.some(
                (bl: { block_time: string; therapist_name: string }) =>
                  bl.block_time.slice(0, 5) === time && bl.therapist_name.trim() === therapistName,
              )
              if (!isBooked && !isBlocked) availableTherapists++
            }
          }

          if (availableTherapists >= peopleToFind) {
            isDayAvailable = true
            break
          }
        }

        calendarStatus[dateString] = (isDayAvailable ? 'AVAILABLE' : 'FULL') as CalendarDayStatus
        if (isDayAvailable) isAnyDayAvailable = true
      }

      return { calendarStatus, isAnyDayAvailable }
    }

    try {
      const initialCheck = await _checkMonthAvailability(month, year)

      if (initialCheck.isAnyDayAvailable) {
        return {
          data: {
            status: 'FOUND_IN_CURRENT',
            data: initialCheck.calendarStatus,
            newMonth: month,
            newYear: year,
          },
          error: null,
        }
      }

      for (let i = 1; i <= 6; i++) {
        const nextDate = new Date(year, month + i, 1)
        const futureCheck = await _checkMonthAvailability(
          nextDate.getMonth(),
          nextDate.getFullYear(),
        )
        if (futureCheck.isAnyDayAvailable) {
          return {
            data: {
              status: 'FOUND_IN_FUTURE',
              data: futureCheck.calendarStatus,
              newMonth: nextDate.getMonth(),
              newYear: nextDate.getFullYear(),
            },
            error: null,
          }
        }
      }

      return {
        data: {
          status: 'NOT_FOUND',
          data: initialCheck.calendarStatus,
          newMonth: month,
          newYear: year,
        },
        error: null,
      }
    } catch (e) {
      return { data: null, error: e as Error }
    }
  }

  // ----------------------------------------------------------------
  //  Available Slots for a Specific Date
  // ----------------------------------------------------------------
  async function getAvailableSlots(
    dateString: string,
    filters: Filters = {},
  ): Promise<{ data: SlotsData | null; error: Error | null }> {
    try {
      const dayOfWeek = new Date(dateString + 'T00:00:00').getDay()

      const [
        { data: bookingsOnDate, error: e1 },
        { data: blockedSlotsForDate, error: e2 },
        { data: allSchedules, error: e3 },
      ] = await Promise.all([
        supabase
          .from('bookings')
          .select('booking_time, therapist_name')
          .eq('booking_date', dateString),
        supabase
          .from('blockages')
          .select('block_time, therapist_name')
          .eq('block_date', dateString),
        supabase
          .from('schedules')
          .select('therapist_name, day_of_week, time_slots, visibility')
          .eq('visibility', 'public'),
      ])

      const error = e1 || e2 || e3
      if (error) throw error

      const todaysSchedules = (allSchedules ?? []).filter(
        (s: { day_of_week: number }) => s.day_of_week == dayOfWeek,
      )

      if (todaysSchedules.length === 0) {
        return { data: { therapists: [], slots: [] }, error: null }
      }

      let therapistsToday = [
        ...new Set(
          todaysSchedules.map((s: { therapist_name: string }) => s.therapist_name.trim()),
        ),
      ].sort() as string[]

      if (filters.therapist) {
        therapistsToday = therapistsToday.filter((t) => t === filters.therapist)
      }

      const allSlotsToday = new Set<string>()
      todaysSchedules.forEach((s: { time_slots: string[] | null }) => {
        if (s.time_slots) s.time_slots.forEach((slot: string) => allSlotsToday.add(slot.trim()))
      })

      let sortedSlots = Array.from(allSlotsToday).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      )

      if (filters.timeSlot) {
        sortedSlots = sortedSlots.filter((t) => t === filters.timeSlot)
      }

      const slotsResult: SlotInfo[] = sortedSlots.map((time) => {
        const slotInfo: SlotInfo = { time, availability: {} as SlotAvailability }

        therapistsToday.forEach((therapistName) => {
          const therapistSchedule = todaysSchedules.find(
            (s: { therapist_name: string }) => s.therapist_name.trim() === therapistName,
          )
          const hasSlot =
            therapistSchedule &&
            (therapistSchedule as { time_slots: string[] | null }).time_slots &&
            (therapistSchedule as { time_slots: string[] }).time_slots.includes(time)

          if (hasSlot) {
            const isBooked = (bookingsOnDate ?? []).some(
              (b: { booking_time: string; therapist_name: string }) =>
                b.booking_time.slice(0, 5) === time && b.therapist_name.trim() === therapistName,
            )
            const isBlocked = (blockedSlotsForDate ?? []).some(
              (b: { block_time: string; therapist_name: string }) =>
                b.block_time.slice(0, 5) === time && b.therapist_name.trim() === therapistName,
            )
            slotInfo.availability[therapistName] = isBooked || isBlocked ? 'FULL' : 'AVAILABLE'
          } else {
            slotInfo.availability[therapistName] = 'NOT_AVAILABLE'
          }
        })

        return slotInfo
      })

      return { data: { therapists: therapistsToday, slots: slotsResult }, error: null }
    } catch (e) {
      return { data: null, error: e as Error }
    }
  }

  // ----------------------------------------------------------------
  //  Process (Create) Booking via RPC
  // ----------------------------------------------------------------
  async function processBooking(
    bookingInfo: BookingInfo,
  ): Promise<{ data: ProcessBookingResult | null; error: Error | null }> {
    try {
      const newBookingId = `BK-${bookingInfo.date.replace(/-/g, '')}-${bookingInfo.time.replace(':', '')}-${bookingInfo.therapist.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`

      const payload = {
        date: bookingInfo.date,
        time: bookingInfo.time,
        therapist: bookingInfo.therapist,
        patientId: bookingInfo.patientId,
        patientFirstName: bookingInfo.patientFirstName,
        patientLastName: bookingInfo.patientLastName,
        patientPhone: bookingInfo.patientPhone,
        bookingId: newBookingId,
      }

      const { data, error } = await supabase.rpc('process_booking', { booking_info: payload })
      if (error) throw error
      return { data, error: null }
    } catch (e) {
      return { data: null, error: e as Error }
    }
  }

  // ----------------------------------------------------------------
  //  Find My Bookings (upcoming)
  // ----------------------------------------------------------------
  async function findMyBookings(
    patientId: string,
  ): Promise<{ data: Booking[] | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('patient_id', patientId.trim())
        .gte('booking_date', formatDateToYYYYMMDD(new Date()))
        .order('booking_date', { ascending: true })
        .order('booking_time', { ascending: true })

      if (error) throw error
      return { data: data ?? [], error: null }
    } catch (e) {
      return { data: null, error: e as Error }
    }
  }

  // ----------------------------------------------------------------
  //  Find Last Booking (for rebook suggestion)
  // ----------------------------------------------------------------
  async function findLastBookingHistory(
    patientId: string,
  ): Promise<{ data: { therapist_name: string } | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('therapist_name')
        .eq('patient_id', patientId.trim())
        .order('booking_date', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== SUPABASE_ERROR_CODE_NO_ROWS) throw error
      return { data: data ?? null, error: data ? null : (error as Error | null) }
    } catch (e) {
      return { data: null, error: e as Error }
    }
  }

  // ----------------------------------------------------------------
  //  Cancel Booking
  // ----------------------------------------------------------------
  async function cancelBooking(
    bookingData: Booking,
  ): Promise<{ data: CancelBookingResult | null; error: Error | null }> {
    try {
      const { error: insertError } = await supabase.from('cancellations').insert([
        {
          reason: 'ยกเลิกโดยผู้ป่วย',
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
      ])

      if (insertError) throw insertError

      const { error: deleteError } = await supabase
        .from('bookings')
        .delete()
        .eq('booking_id', bookingData.booking_id)

      if (deleteError) throw deleteError

      return { data: { success: true, message: 'ยกเลิกการจองสำเร็จ' }, error: null }
    } catch (e) {
      return { data: null, error: e as Error }
    }
  }

  // ----------------------------------------------------------------
  //  Dashboard Stats
  // ----------------------------------------------------------------
  async function getDashboardStats(): Promise<{
    data: DashboardStats | null
    error: Error | null
  }> {
    try {
      const now = new Date()
      const startOfMonth = formatDateToYYYYMMDD(new Date(now.getFullYear(), now.getMonth(), 1))
      const endOfMonth = formatDateToYYYYMMDD(new Date(now.getFullYear(), now.getMonth() + 1, 0))

      const [{ data: statsData, error: e1 }, { count: monthlyCount, error: e2 }] =
        await Promise.all([
          supabase.from('stats').select('metric_name, value'),
          supabase
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startOfMonth + 'T00:00:00Z')
            .lte('created_at', endOfMonth + 'T23:59:59Z'),
        ])

      const error = e1 || e2
      if (error) throw error

      const manualCount =
        (statsData ?? []).find(
          (s: { metric_name: string; value: number }) => s.metric_name === 'ManualInitialCount',
        )?.value ?? 0
      const systemCount =
        (statsData ?? []).find(
          (s: { metric_name: string; value: number }) => s.metric_name === 'SystemBookingCount',
        )?.value ?? 0

      return {
        data: {
          totalBookings: manualCount + systemCount,
          monthlyBookings: monthlyCount ?? 0,
        },
        error: null,
      }
    } catch (e) {
      return { data: null, error: e as Error }
    }
  }

  return {
    checkPatientRegistration,
    getFilterOptions,
    getCalendarData,
    getAvailableSlots,
    processBooking,
    findMyBookings,
    findLastBookingHistory,
    cancelBooking,
    getDashboardStats,
  }
}
