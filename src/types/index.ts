// =====================================================================
//  TypeScript Types & Interfaces for ระบบจองคิวแพทย์แผนไทย
// =====================================================================

export interface Patient {
  patient_id: string
  first_name: string
  last_name: string
  phone_number: string
}

export interface Booking {
  booking_id: string
  booking_date: string
  booking_time: string
  therapist_name: string
  patient_id: string
  patient_first_name: string
  patient_last_name: string
  patient_phone: string
  status?: string
  created_at?: string
}

export interface BookingInfo {
  date: string
  time: string
  therapist: string
  patientId: string
  patientFirstName: string
  patientLastName: string
  patientPhone: string
}

export interface SlotAvailability {
  [therapistName: string]: 'AVAILABLE' | 'FULL' | 'NOT_AVAILABLE'
}

export interface SlotInfo {
  time: string
  availability: SlotAvailability
}

export interface SlotsData {
  therapists: string[]
  slots: SlotInfo[]
}

export type CalendarDayStatus = 'AVAILABLE' | 'FULL' | 'DISABLED'

export interface CalendarStatusMap {
  [dateString: string]: CalendarDayStatus
}

export type CalendarResultStatus = 'FOUND_IN_CURRENT' | 'FOUND_IN_FUTURE' | 'NOT_FOUND'

export interface CalendarResult {
  status: CalendarResultStatus
  data: CalendarStatusMap
  newMonth: number
  newYear: number
}

export interface FilterOptions {
  therapists: string[]
  timeSlots: string[]
  maxPeople: number
  therapistTimeMap: Record<string, string[]>
}

export interface Filters {
  people?: string
  therapist?: string
  timeSlot?: string
}

export interface DashboardStats {
  totalBookings: number
  monthlyBookings: number
}

export interface ProcessBookingResult {
  success: boolean
  message?: string
}

export interface CancelBookingResult {
  success: boolean
  message?: string
}

export type PageName =
  | 'login'
  | 'welcomeBack'
  | 'dashboard'
  | 'bookingFlowStart'
  | 'myBookings'
  | 'slots'
  | 'bookingForm'

export interface PageOptions {
  date?: string
  time?: string
  therapist?: string
  filters?: Filters
  previouslyBookedCount?: number
}
