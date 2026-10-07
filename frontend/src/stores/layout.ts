import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useLayoutStore = defineStore('layout', () => {
  const sidebarOpen = ref(false);
  return { sidebarOpen };
});
