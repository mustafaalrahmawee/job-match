<script setup lang="ts">
import type { AnalysisError, Cv } from '@job-match/shared';
import { CircleAlert, LoaderCircle, Sparkles } from '@lucide/vue';

import { Button } from '@/components/ui/button';

defineProps<{ cv: Cv }>();
const emit = defineEmits<{ analyze: [id: string] }>();

const ERRORS: Record<AnalysisError, string> = {
  analysis_truncated: 'Die Analyse wurde zu lang und deshalb abgebrochen.',
  refused: 'Die KI konnte diesen Lebenslauf nicht analysieren.',
  pdf_too_long: 'Das PDF ist zu lang für die Analyse.',
  invalid_analysis: 'Die Analyse war unvollständig.',
  not_a_cv: 'Das PDF scheint kein Lebenslauf zu sein. Lade bitte deinen Lebenslauf hoch.',
  batch_failed: 'Die Analyse ist fehlgeschlagen.',
  batch_expired: 'Die Analyse hat zu lange gedauert.',
};
</script>

<template>
  <div
    v-if="cv.analysisStatus === 'running'"
    class="bg-brand/5 flex items-start gap-3 border-t px-5 py-4"
    data-testid="analysis-running"
  >
    <LoaderCircle class="text-brand mt-0.5 size-4 shrink-0 animate-spin" />
    <div class="flex flex-col gap-0.5">
      <p class="text-sm font-medium">Wird analysiert …</p>
      <p class="text-muted-foreground text-xs">
        Das dauert meist einige Minuten. Du kannst die Seite verlassen – das Ergebnis erscheint dann
        hier.
      </p>
    </div>
  </div>

  <div
    v-else-if="cv.analysisStatus === 'failed'"
    class="bg-destructive/5 flex flex-wrap items-center gap-3 border-t px-5 py-4"
    data-testid="analysis-failed"
  >
    <CircleAlert class="text-destructive size-4 shrink-0" />
    <p class="min-w-0 flex-1 text-sm">
      {{ cv.analysisError ? ERRORS[cv.analysisError] : 'Die Analyse ist fehlgeschlagen.' }}
    </p>
    <Button
      v-if="cv.analysisError !== 'not_a_cv'"
      variant="outline"
      size="sm"
      data-testid="analysis-retry"
      @click="emit('analyze', cv.id)"
    >
      Erneut analysieren
    </Button>
  </div>

  <div
    v-else-if="cv.analysisStatus === 'none'"
    class="flex flex-wrap items-center gap-3 border-t px-5 py-4"
    data-testid="analysis-none"
  >
    <p class="text-muted-foreground min-w-0 flex-1 text-sm">
      Diese Fassung ist noch nicht analysiert.
    </p>
    <Button size="sm" data-testid="analysis-start" @click="emit('analyze', cv.id)">
      <Sparkles class="size-3.5" /> Analysieren
    </Button>
  </div>
</template>
