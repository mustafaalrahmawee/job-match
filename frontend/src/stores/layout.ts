import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const PINNED_KEY = 'sidebar_pinned'

function isDesktop() {
  return window.matchMedia('(min-width: 768px)').matches
}

export const useLayoutStore = defineStore('layout', () => {
  const pinned = ref(localStorage.getItem(PINNED_KEY) !== 'false')
  const floating = ref(false)

  watch(pinned, (value) => localStorage.setItem(PINNED_KEY, String(value)))

  function peek() {
    floating.value = true
  }

  function open() {
    if (isDesktop()) {
      pinned.value = true
      floating.value = false
    } else {
      floating.value = true
    }
  }

  function toggle() {
    if (floating.value) {
      floating.value = false
      if (isDesktop()) pinned.value = true
    } else {
      pinned.value = false
    }
  }

  function close() {
    floating.value = false
  }

  return { pinned, floating, peek, open, toggle, close }
})
