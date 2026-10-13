import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from './components/AppLayout.vue'
import { useAuthStore } from './stores/auth'
import CoachView from './views/CoachView.vue'
import HomeView from './views/HomeView.vue'
import LoginView from './views/LoginView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView, meta: { public: true } },
    {
      path: '/',
      component: AppLayout,
      children: [
        { path: '', component: HomeView },
        { path: 'coach/:id(\\d+)?', component: CoachView },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (to.meta.public) return auth.token ? '/' : true
  if (!auth.token) return '/login'
  if (auth.user) return true
  try {
    await auth.loadUser()
    return true
  } catch {
    return auth.token ? true : '/login'
  }
})
