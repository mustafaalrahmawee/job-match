<template>
  <AuthCard
    title="Willkommen zurück"
    description="Melde dich an, um Lebenslauf, Stellen und Bewerbungen im Blick zu behalten."
    :error="error"
  >
    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <FormField v-model="email" label="E-Mail" type="email" autocomplete="username" />
      <FormField
        v-model="password"
        label="Passwort"
        type="password"
        autocomplete="current-password"
      />
      <button
        type="submit"
        :disabled="busy"
        class="mt-2 h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {{ busy ? 'Anmelden …' : 'Anmelden' }}
      </button>
    </form>
  </AuthCard>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError } from '../api'
import AuthCard from '../components/AuthCard.vue'
import FormField from '../components/FormField.vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const busy = ref(false)

async function submit() {
  busy.value = true
  error.value = null
  try {
    await auth.login(email.value, password.value)
    await router.push('/')
  } catch (e) {
    if (!(e instanceof ApiError)) error.value = 'Server nicht erreichbar.'
    else if (e.status === 401) error.value = 'E-Mail oder Passwort ist falsch.'
    else error.value = 'Anmeldung gerade nicht möglich.'
  } finally {
    busy.value = false
  }
}
</script>
