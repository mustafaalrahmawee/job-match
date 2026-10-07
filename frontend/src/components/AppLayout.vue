<script setup lang="ts">
import { RouterView } from 'vue-router';

import AppSidebar from '@/components/AppSidebar.vue';
</script>

<template>
  <div class="flex h-svh">
    <AppSidebar />
    <main class="flex min-w-0 flex-1 flex-col">
      <RouterView />
    </main>
  </div>
</template>
