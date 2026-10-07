import { createRouter, createWebHistory } from 'vue-router';

import AppLayout from '@/components/AppLayout.vue';
import ChatPage from '@/pages/ChatPage.vue';
import LoginPage from '@/pages/LoginPage.vue';
import ProfilePage from '@/pages/ProfilePage.vue';
import { useAuthStore } from '@/stores/auth';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    guestOnly?: boolean;
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginPage, meta: { guestOnly: true } },
    {
      path: '/',
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: { name: 'chat' } },
        { path: 'chat/:id?', name: 'chat', component: ChatPage },
        { path: 'profile', name: 'profile', component: ProfilePage },
      ],
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.restore();

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return {
      name: 'login',
      query: to.fullPath === '/chat' ? {} : { redirect: to.fullPath },
    };
  }
  if (to.meta.guestOnly && auth.isAuthenticated) return { name: 'chat' };
  return true;
});
