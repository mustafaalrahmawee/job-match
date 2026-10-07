<script setup lang="ts">
const STEPS = [
  {
    title: 'PDF hochladen',
    text: 'Die neue Fassung ist sofort aktiv. Die bisherige bleibt unter „Frühere Fassungen“.',
  },
  {
    title: 'Rolle wählen',
    text: 'Danach richten sich später Stellen, Matches und Empfehlungen.',
  },
  {
    title: 'Coach nutzen',
    text: 'Der Coach kennt automatisch deine aktive Fassung.',
  },
];
</script>

<template>
  <aside class="bg-muted/50 flex flex-col gap-4 rounded-xl border p-5 text-sm">
    <h3 class="font-semibold">So funktioniert's</h3>
    <ol class="flex flex-col gap-4">
      <li v-for="(step, index) in STEPS" :key="step.title" class="flex gap-3">
        <span
          class="bg-background flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold"
        >
          {{ index + 1 }}
        </span>
        <div class="flex flex-col gap-0.5">
          <p class="font-medium">{{ step.title }}</p>
          <p class="text-muted-foreground text-xs leading-relaxed">{{ step.text }}</p>
        </div>
      </li>
    </ol>
    <p class="text-muted-foreground border-t pt-4 text-xs leading-relaxed">
      Tipp: Du kannst ein PDF auch einfach auf diese Seite ziehen.
    </p>
  </aside>
</template>
