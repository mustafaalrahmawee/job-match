import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from './components/AppLayout.vue'
import { useAuthStore } from './stores/auth'
import ApplicationsView from './views/ApplicationsView.vue'
import ApplicationView from './views/ApplicationView.vue'
import CoachView from './views/CoachView.vue'
import CvView from './views/CvView.vue'
import HomeView from './views/HomeView.vue'
import JobsView from './views/JobsView.vue'
import JobView from './views/JobView.vue'
import LoginView from './views/LoginView.vue'
import MatchesView from './views/MatchesView.vue'
import MatchView from './views/MatchView.vue'
import OwnJobView from './views/OwnJobView.vue'
import OwnJobsView from './views/OwnJobsView.vue'
import TrainingsView from './views/TrainingsView.vue'
import TrainingView from './views/TrainingView.vue'

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
        { path: 'cv', component: CvView },
        { path: 'jobs', component: JobsView },
        { path: 'jobs/own', component: OwnJobsView, meta: { nav: '/jobs/own' } },
        { path: 'jobs/new', component: OwnJobView, meta: { nav: '/jobs/own' } },
        { path: 'jobs/own/:id(\\d+)', component: JobView, meta: { nav: '/jobs/own' } },
        { path: 'jobs/:id(\\d+)', component: JobView },
        { path: 'matches', component: MatchesView },
        { path: 'matches/:jobId(\\d+)', component: MatchView },
        { path: 'applications', component: ApplicationsView },
        { path: 'applications/:id(\\d+)', component: ApplicationView },
        { path: 'trainings', component: TrainingsView },
        { path: 'trainings/:id(\\d+)', component: TrainingView },
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
