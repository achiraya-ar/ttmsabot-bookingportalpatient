// =====================================================================
//  Slip / Print / Save-as-Image Composable
// =====================================================================

import Swal from 'sweetalert2'
import html2canvas from 'html2canvas'
import type { BookingInfo, Booking } from '../types'
import { useHelpers } from './useHelpers'

export function useSlip() {
  const { formatThaiDate } = useHelpers()

  // ----------------------------------------------------------------
  //  Generate appointment slip HTML string
  // ----------------------------------------------------------------
  function generateSlipHTML(booking: BookingInfo | Booking): string {
    const b = booking as BookingInfo & Booking

    const patientFullName = `${b.patientFirstName || b.patient_first_name || ''} ${b.patientLastName || b.patient_last_name || ''}`.trim()
    const patientPhone = b.patientPhone || b.patient_phone || '-'
    const therapistName = b.therapist || b.therapist_name || 'ไม่ระบุ'
    const bookingDate = b.date || b.booking_date
    const bookingTime = (b.time || b.booking_time).slice(0, 5)

    return `
      <div class="slip-container elderly-friendly" id="slip-to-print">
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
    `
  }

  // ----------------------------------------------------------------
  //  Print slip (desktop)
  // ----------------------------------------------------------------
  function createPrintSlip(booking: BookingInfo | Booking): void {
    const printContentHtml = generateSlipHTML(booking)
    const printElement = document.createElement('div')
    printElement.id = 'appointment-slip-print-container'
    printElement.innerHTML = printContentHtml
    document.body.appendChild(printElement)
    window.print()
    document.body.removeChild(printElement)
  }

  // ----------------------------------------------------------------
  //  Capture as PNG and save (mobile)
  // ----------------------------------------------------------------
  async function captureAndSaveSlip(booking: BookingInfo | Booking): Promise<void> {
    const b = booking as BookingInfo & Booking
    const slipHtml = generateSlipHTML(booking)
    const slipElement = document.createElement('div')
    slipElement.style.position = 'absolute'
    slipElement.style.left = '-9999px'
    slipElement.innerHTML = slipHtml
    document.body.appendChild(slipElement)

    try {
      const slipContainer = slipElement.querySelector('.slip-container') as HTMLElement
      const canvas = await html2canvas(slipContainer, { scale: 2 })
      const imageURL = canvas.toDataURL('image/png')
      const downloadLink = document.createElement('a')
      downloadLink.href = imageURL
      downloadLink.download = `ใบนัด-${b.date || b.booking_date}.png`
      document.body.appendChild(downloadLink)
      downloadLink.click()
      document.body.removeChild(downloadLink)
    } catch (err) {
      console.error('Error capturing slip:', err)
      Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกรูปภาพได้', 'error')
    } finally {
      document.body.removeChild(slipElement)
    }
  }

  // ----------------------------------------------------------------
  //  Add to Google Calendar
  // ----------------------------------------------------------------
  function generateCalendarLink(booking: BookingInfo | Booking): void {
    const b = booking as BookingInfo & Booking
    const therapist = b.therapist || b.therapist_name || ''
    const dateStr = b.date || b.booking_date
    const timeStr = b.time || b.booking_time

    const title = encodeURIComponent(`นัดหมายแพทย์แผนไทย: ${therapist}`)
    const description = encodeURIComponent(
      `นัดหมายกับ ${therapist} ที่โรงพยาบาลสระโบสถ์`,
    )
    const location = encodeURIComponent('กลุ่มงานการแพทย์แผนไทย โรงพยาบาลสระโบสถ์')

    const [year, month, day] = dateStr.split('-')
    const [hours, minutes] = timeStr.split(':')
    const startTime = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hours),
      parseInt(minutes),
    )
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000)

    const formatDateForGoogle = (date: Date) =>
      date.toISOString().replace(/-|:|\.\d\d\d/g, '')

    const startDateGoogle = formatDateForGoogle(startTime)
    const endDateGoogle = formatDateForGoogle(endTime)

    const googleLink = `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDateGoogle}/${endDateGoogle}&details=${description}&location=${location}`
    window.open(googleLink, '_blank')
  }

  return {
    generateSlipHTML,
    createPrintSlip,
    captureAndSaveSlip,
    generateCalendarLink,
  }
}
