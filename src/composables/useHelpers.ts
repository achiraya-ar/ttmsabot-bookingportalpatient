// =====================================================================
//  Helper / Utility Functions Composable
// =====================================================================

export function useHelpers() {
  /**
   * Format a Date object to YYYY-MM-DD string
   */
  function formatDateToYYYYMMDD(date: Date): string {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * Format a YYYY-MM-DD date string to Thai Buddhist calendar format
   */
  function formatThaiDate(dateString: string, withWeekday = true): string {
    if (!dateString) return ''
    const date = new Date(dateString + 'T00:00:00')
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Bangkok',
    }
    if (withWeekday) {
      options.weekday = 'long'
    }
    return new Intl.DateTimeFormat('th-TH-u-ca-buddhist', options).format(date)
  }

  /**
   * Validate a Thai national ID (13-digit Luhn-style checksum)
   */
  function validateThaiId(id: string): boolean {
    if (id == null || id.length !== 13 || !/^[0-9]\d+$/.test(id)) {
      return false
    }
    let sum = 0
    for (let i = 0; i < 12; i++) {
      sum += parseInt(id.charAt(i)) * (13 - i)
    }
    const check = (11 - (sum % 11)) % 10
    return check === parseInt(id.charAt(12))
  }

  /**
   * Check if the current viewport is mobile-sized
   */
  function isMobile(): boolean {
    return window.innerWidth <= 768
  }

  /**
   * Animate a counter element from 0 to targetNumber over ~1.5 seconds
   */
  function animateCounter(element: HTMLElement, targetNumber: number): void {
    if (isNaN(targetNumber) || targetNumber === null) {
      element.textContent = 'N/A'
      return
    }
    const duration = 1500
    const startNumber = 0
    const startTime = performance.now()

    function update(currentTime: number) {
      const elapsedTime = currentTime - startTime
      const progress = Math.min(elapsedTime / duration, 1)
      const currentNumber = Math.floor(progress * (targetNumber - startNumber) + startNumber)
      element.textContent = currentNumber.toLocaleString('en-US')
      if (progress < 1) {
        requestAnimationFrame(update)
      } else {
        element.textContent = targetNumber.toLocaleString('en-US')
      }
    }
    requestAnimationFrame(update)
  }

  return {
    formatDateToYYYYMMDD,
    formatThaiDate,
    validateThaiId,
    isMobile,
    animateCounter,
  }
}
