<template>
  <div id="login-view">
    <h2 class="page-title">
      <i class="fa-solid fa-id-card"></i> ยืนยันตัวตนเพื่อเข้าสู่ระบบ
    </h2>
    <p>กรุณากรอกเลขประจำตัวประชาชน 13 หลักของท่าน เพื่อตรวจสอบข้อมูลและดำเนินการนัดหมาย</p>
    <form id="patient-login-form" novalidate @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="patientIdInput">เลขประจำตัวประชาชน</label>
        <input
          id="patientIdInput"
          v-model="patientIdInput"
          type="tel"
          required
          pattern="[0-9]{13}"
          inputmode="numeric"
          placeholder="กรอกเลข 13 หลัก"
          maxlength="13"
          autocomplete="off"
        />
      </div>
      <button type="submit" class="btn btn-full-width" :disabled="isLoading">
        <i v-if="isLoading" class="fas fa-spinner fa-spin"></i>
        <i v-else class="fa-solid fa-arrow-right-to-bracket"></i>
        {{ isLoading ? 'กำลังตรวจสอบ...' : 'ตรวจสอบและเข้าสู่ระบบ' }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Swal from 'sweetalert2'
import { useSupabase } from '../composables/useSupabase'
import { useHelpers } from '../composables/useHelpers'
import type { Patient } from '../types'

const emit = defineEmits<{
  (e: 'login-success', patient: Patient): void
}>()

const { checkPatientRegistration } = useSupabase()
const { validateThaiId } = useHelpers()

const patientIdInput = ref('')
const isLoading = ref(false)

async function handleSubmit() {
  const patientId = patientIdInput.value.trim()

  if (!validateThaiId(patientId)) {
    Swal.fire('ข้อมูลไม่ถูกต้อง', 'รูปแบบเลขบัตรประชาชนไม่ถูกต้อง', 'error')
    return
  }

  isLoading.value = true

  try {
    const { data: patient, error } = await checkPatientRegistration(patientId)

    if (error || !patient) {
      Swal.fire({
        icon: 'warning',
        title: 'ไม่พบข้อมูลการลงทะเบียน',
        html: `ขออภัย ระบบไม่พบข้อมูลของท่านในฐานข้อมูลผู้รับบริการ<br><br>กรุณาติดต่อเพื่อลงทะเบียนล่วงหน้าที่ <strong>กลุ่มงานการแพทย์แผนไทย โรงพยาบาลสระโบสถ์</strong><br>หรือสอบถามข้อมูลเพิ่มเติมที่หมายเลขโทรศัพท์:<br><strong>082-202-9667</strong> (ในวันและเวลาราชการ)`,
        confirmButtonText: 'รับทราบ',
      })
      return
    }

    emit('login-success', patient)
  } catch (err) {
    console.error(err)
    Swal.fire('เกิดข้อผิดพลาด', 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง', 'error')
  } finally {
    isLoading.value = false
  }
}
</script>
