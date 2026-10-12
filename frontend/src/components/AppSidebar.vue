<script setup lang="ts">
import { House, LogOut, PanelLeft } from '@lucide/vue'
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLayoutStore } from '../stores/layout'
import AppLogo from './AppLogo.vue'

const NAV = [{ to: '/', label: 'Start', icon: House }]

const auth = useAuthStore()
const layout = useLayoutStore()
const route = useRoute()
const router = useRouter()
const sidebar = useTemplateRef('sidebar')

function closeWhenMouseLeaves(event: MouseEvent) {
  if (layout.floating && sidebar.value && event.clientX > sidebar.value.offsetWidth) layout.close()
}

onMounted(() => document.addEventListener('mousemove', closeWhenMouseLeaves))
onBeforeUnmount(() => document.removeEventListener('mousemove', closeWhenMouseLeaves))

watch(
  () => route.fullPath,
  () => layout.close(),
)

async function logout() {
  await auth.logout()
  await router.replace('/login')
}
</script>

<template>
  <div
    v-if="layout.floating"
    class="fixed inset-0 z-20 bg-black/30 backdrop-blur-[2px] md:hidden"
    aria-hidden="true"
    @click="layout.close()"
  />
  <aside
    ref="sidebar"
    :class="[
      'fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r bg-sidebar transition-transform',
      layout.floating ? 'translate-x-0 shadow-xl' : '-translate-x-full',
      layout.pinned && 'md:static md:translate-x-0 md:shadow-none',
    ]"
  >
    <div class="flex h-14 shrink-0 items-center justify-between px-4">
      <AppLogo />
      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Seitenleiste umschalten"
        title="Seitenleiste umschalten"
        @click="layout.toggle()"
      >
        <PanelLeft class="size-4" />
      </button>
    </div>

    <nav class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pt-1 pb-3">
      <RouterLink
        v-for="item in NAV"
        :key="item.to"
        :to="item.to"
        class="flex h-9 items-center gap-2.5 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        exact-active-class="bg-accent font-medium text-foreground!"
      >
        <component :is="item.icon" class="size-4" />
        {{ item.label }}
      </RouterLink>
    </nav>

    <div v-if="auth.user" class="flex items-center gap-2.5 border-t px-3 py-3 text-sm">
      <div
        class="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground"
      >
        {{ auth.user.email.charAt(0).toUpperCase() }}
      </div>
      <div class="flex min-w-0 flex-1 flex-col">
        <span class="truncate font-medium">{{ auth.user.email }}</span>
        <span class="truncate text-xs text-muted-foreground">Bewerber:in</span>
      </div>
      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Abmelden"
        title="Abmelden"
        @click="logout"
      >
        <LogOut class="size-4" />
      </button>
    </div>
  </aside>
</template>
