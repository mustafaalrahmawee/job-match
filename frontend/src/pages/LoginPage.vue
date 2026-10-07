<script setup lang="ts">
import { LoginRequestSchema } from '@job-match/shared';
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import AppLogo from '@/components/AppLogo.vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const email = ref('');
const password = ref('');
const error = ref<string | null>(null);
const submitting = ref(false);

function target(): string {
  const redirect = route.query.redirect;
  return typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
    ? redirect
    : '/chat';
}

async function submit(): Promise<void> {
  error.value = null;
  const input = LoginRequestSchema.safeParse({ email: email.value, password: password.value });
  if (!input.success) {
    error.value = 'Bitte gib E-Mail und Passwort ein.';
    return;
  }
  submitting.value = true;
  try {
    await auth.login(input.data.email, input.data.password);
    await router.replace(target());
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Der Server ist nicht erreichbar.';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="bg-sidebar flex min-h-svh items-center justify-center p-4">
    <div class="flex w-full max-w-sm flex-col items-center gap-8">
      <AppLogo />
      <Card class="w-full shadow-sm">
        <CardHeader>
          <CardTitle class="text-xl">Willkommen zurück</CardTitle>
          <CardDescription>Melde dich an, um mit deinem Karriere-Coach zu chatten.</CardDescription>
        </CardHeader>
        <CardContent>
          <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
            <div class="flex flex-col gap-2">
              <Label for="email">E-Mail</Label>
              <Input
                id="email"
                v-model="email"
                type="email"
                autocomplete="username"
                required
                data-testid="email"
              />
            </div>
            <div class="flex flex-col gap-2">
              <Label for="password">Passwort</Label>
              <Input
                id="password"
                v-model="password"
                type="password"
                autocomplete="current-password"
                required
                data-testid="password"
              />
            </div>
            <p v-if="error" class="text-destructive text-sm" role="alert" data-testid="login-error">
              {{ error }}
            </p>
            <Button type="submit" class="mt-2" :disabled="submitting" data-testid="login-submit">
              {{ submitting ? 'Anmelden …' : 'Anmelden' }}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  </main>
</template>
