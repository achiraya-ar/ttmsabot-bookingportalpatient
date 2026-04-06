<template>
  <div id="welcome-back-view">
    <h2 class="page-title">
      <i class="fa-solid fa-hand-sparkles"></i> ยินดีต้อนรับอีกครั้ง
    </h2>
    <p class="welcome-name">คุณ {{ patient.first_name }} {{ patient.last_name }}</p>
    <div class="btn-action-group">
      <button id="confirm-login-btn" class="btn btn-full-width" @click="emit('confirm-login', patient)">
        <i class="fa-solid fa-check"></i> เข้าสู่ระบบ
      </button>
    </div>
    <a href="#" id="change-user-link" @click.prevent="emit('change-user')">ไม่ใช่คุณ? เปลี่ยนผู้ใช้</a>
  </div>
</template>

<script setup lang="ts">
import type { Patient } from '../types'

const props = defineProps<{
  patient: Patient
}>()

const emit = defineEmits<{
  (e: 'confirm-login', patient: Patient): void
  (e: 'change-user'): void
}>()

// suppress unused warning
void props
</script>
