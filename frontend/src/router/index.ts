import { createRouter, createWebHistory } from 'vue-router';

import StatusPage from '@/pages/StatusPage.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    // Stufe 0 hat nur diese Seite; ab Stufe 1 kommen Login und Chat dazu.
    { path: '/', redirect: '/status' },
    { path: '/status', name: 'status', component: StatusPage },
  ],
});
