<template>
  <div class="flex flex-col gap-2">
    <label :for="id" class="text-sm font-medium">{{ label }}</label>
    <input
      :id="id"
      v-model="model"
      :type="type ?? 'text'"
      :autocomplete="autocomplete"
      required
      class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
    />
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'

defineProps<{ label: string; type?: string; autocomplete?: string }>()

const model = defineModel<string>({ default: '' })
const id = useId()
</script>
