import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { expect, test } from 'vitest'
import HomeView from '../src/views/HomeView.vue'

test('shows the app name', () => {
  const wrapper = mount(HomeView, { global: { plugins: [createPinia()] } })
  expect(wrapper.text()).toContain('job-match')
})
