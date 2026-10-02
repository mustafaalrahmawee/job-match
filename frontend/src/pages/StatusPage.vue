<script setup lang="ts">
import { onMounted } from 'vue';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useHealthStore } from '@/stores/health';

const health = useHealthStore();

const TEXTS: Record<string, string> = {
  unknown: 'Noch nicht geprüft.',
  ok: 'Backend und Datenbank antworten.',
  degraded: 'Das Backend läuft, aber die Datenbank antwortet nicht.',
  unreachable: 'Das Backend antwortet nicht. Läuft es auf Port 8000?',
};

onMounted(health.load);
</script>

<template>
  <main class="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-6 p-6">
    <Card>
      <CardHeader>
        <CardTitle>Status</CardTitle>
        <CardDescription>Lebenszeichen von Backend und Datenbank</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <p data-testid="status-text">
          {{ health.loading ? 'Prüfe …' : TEXTS[health.state] }}
        </p>
        <dl class="text-muted-foreground grid grid-cols-2 gap-1 text-sm">
          <dt>Backend</dt>
          <dd data-testid="backend-state">{{ health.state }}</dd>
          <dt>Datenbank</dt>
          <dd data-testid="database-state">{{ health.database ?? '–' }}</dd>
        </dl>
        <Button class="self-start" :disabled="health.loading" @click="health.load">
          Erneut prüfen
        </Button>
      </CardContent>
    </Card>
  </main>
</template>
