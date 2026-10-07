<script setup lang="ts">
import type { CvAnalysis } from '@job-match/shared';
import { CircleCheck, Lightbulb } from '@lucide/vue';

defineProps<{ analysis: CvAnalysis }>();

type Station = CvAnalysis['stations'][number];

function period(station: Station): string {
  return [station.from, station.to].filter(Boolean).join(' – ');
}

function details(degree: CvAnalysis['degrees'][number]): string {
  return [degree.institution, degree.year].filter(Boolean).join(', ');
}

function where(station: Station): string {
  return [station.title, station.company].filter(Boolean).join(' · ');
}
</script>

<template>
  <div class="bg-card flex flex-col divide-y rounded-xl border shadow-xs" data-testid="analysis">
    <p class="px-5 py-4 text-sm leading-relaxed">{{ analysis.headline }}</p>

    <section v-if="analysis.skills.length > 0" class="flex flex-col gap-2 px-5 py-4">
      <h4 class="text-muted-foreground text-xs font-medium">Fähigkeiten</h4>
      <ul class="flex flex-wrap gap-1.5">
        <li
          v-for="skill in analysis.skills"
          :key="skill"
          class="bg-secondary text-secondary-foreground rounded-full px-2.5 py-0.5 text-xs"
        >
          {{ skill }}
        </li>
      </ul>
    </section>

    <section v-if="analysis.stations.length > 0" class="flex flex-col gap-2 px-5 py-4">
      <h4 class="text-muted-foreground text-xs font-medium">Stationen</h4>
      <ol class="flex flex-col gap-3">
        <li
          v-for="station in analysis.stations"
          :key="`${station.title}-${station.company}-${station.from}`"
          class="flex gap-3 text-sm"
        >
          <span class="text-muted-foreground w-28 shrink-0 text-xs leading-5">
            {{ period(station) }}
          </span>
          <span class="min-w-0">{{ where(station) }}</span>
        </li>
      </ol>
    </section>

    <div class="grid sm:grid-cols-2 sm:divide-x">
      <section class="flex flex-col gap-2 px-5 py-4">
        <h4 class="text-muted-foreground text-xs font-medium">Abschlüsse</h4>
        <ul v-if="analysis.degrees.length > 0" class="flex flex-col gap-1.5 text-sm">
          <li v-for="degree in analysis.degrees" :key="`${degree.title}-${degree.institution}`">
            <p class="font-medium">{{ degree.title }}</p>
            <p v-if="details(degree)" class="text-muted-foreground text-xs">
              {{ details(degree) }}
            </p>
          </li>
        </ul>
        <p v-else class="text-muted-foreground text-sm">Keine Angaben</p>
      </section>
      <section class="flex flex-col gap-2 border-t px-5 py-4 sm:border-t-0">
        <h4 class="text-muted-foreground text-xs font-medium">Sprachen</h4>
        <ul v-if="analysis.languages.length > 0" class="flex flex-col gap-1.5 text-sm">
          <li v-for="entry in analysis.languages" :key="entry.language">
            <span class="font-medium">{{ entry.language }}</span>
            <span v-if="entry.level" class="text-muted-foreground"> · {{ entry.level }}</span>
          </li>
        </ul>
        <p v-else class="text-muted-foreground text-sm">Keine Angaben</p>
      </section>
    </div>

    <div class="grid sm:grid-cols-2 sm:divide-x">
      <section class="flex flex-col gap-2 px-5 py-4">
        <h4 class="text-muted-foreground text-xs font-medium">Stärken</h4>
        <ul class="flex flex-col gap-2 text-sm">
          <li v-for="strength in analysis.strengths" :key="strength" class="flex gap-2">
            <CircleCheck class="text-success mt-0.5 size-4 shrink-0" />
            <span>{{ strength }}</span>
          </li>
        </ul>
      </section>
      <section class="flex flex-col gap-2 border-t px-5 py-4 sm:border-t-0">
        <h4 class="text-muted-foreground text-xs font-medium">Verbesserungstipps</h4>
        <ul class="flex flex-col gap-2 text-sm">
          <li v-for="tip in analysis.improvements" :key="tip" class="flex gap-2">
            <Lightbulb class="text-warning mt-0.5 size-4 shrink-0" />
            <span>{{ tip }}</span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
