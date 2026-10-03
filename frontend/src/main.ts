import { createPinia } from 'pinia';
import { createApp } from 'vue';

import App from './App.vue';
import './assets/main.css';
import { setUnauthorizedHandler } from './lib/api';
import { router } from './router';
import { useAuthStore } from './stores/auth';
import { useChatStore } from './stores/chat';

const app = createApp(App).use(createPinia()).use(router);

setUnauthorizedHandler(() => {
  useAuthStore().reset();
  useChatStore().reset();
  void router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } });
});

app.mount('#app');
