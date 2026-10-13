<template>
  <div class="flex h-svh">
    <AppSidebar />
    <main class="flex min-w-0 flex-1 flex-col">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import AppSidebar from './AppSidebar.vue'
</script>
