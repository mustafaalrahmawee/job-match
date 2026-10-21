<template>
  <PageHeader title="Eigene Stelle speichern">
    <RouterLink
      to="/jobs/own"
      class="flex h-8 items-center gap-2 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <ArrowLeft class="size-4" />
      <span class="hidden sm:inline">Eigene Stellen</span>
    </RouterLink>
  </PageHeader>

  <div class="flex-1 overflow-y-auto">
    <div :class="['mx-auto grid max-w-6xl items-start gap-4 px-4 py-6', draft && 'lg:grid-cols-2']">
      <p
        v-if="error"
        class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm lg:col-span-2"
        role="alert"
      >
        {{ error }}
      </p>

      <section class="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm">
        <div class="flex gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Art der Anzeige">
          <button
            v-for="tab in TABS"
            :key="tab.mode"
            type="button"
            role="tab"
            :aria-selected="mode === tab.mode"
            :class="[
              'h-8 flex-1 rounded-md text-sm',
              mode === tab.mode ? 'bg-background font-medium shadow-xs' : 'text-muted-foreground hover:text-foreground',
            ]"
            @click="mode = tab.mode"
          >
            {{ tab.label }}
          </button>
        </div>

        <div v-if="mode === 'text'" class="flex flex-col gap-2">
          <label for="own-job-text" class="text-sm font-medium">Anzeigentext</label>
          <textarea
            id="own-job-text"
            v-model="text"
            rows="14"
            :maxlength="MAX_CHARS"
            placeholder="Füge hier den Text der Stellenanzeige ein."
            class="w-full resize-y rounded-md border border-input bg-background px-3 py-2.5 text-sm leading-relaxed shadow-xs outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
          />
        </div>

        <label
          v-else
          :class="[
            'flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center hover:bg-accent',
            dragging && 'bg-accent',
          ]"
          @dragover.prevent="dragging = true"
          @dragleave="dragging = false"
          @drop.prevent="drop"
        >
          <ImageUp class="size-5 text-muted-foreground" />
          <span v-if="file" class="text-sm font-medium">{{ file.name }}</span>
          <span class="max-w-sm text-sm text-muted-foreground">
            {{
              file
                ? 'Klicke oder lege ein anderes Bild ab, um es zu ersetzen.'
                : 'Lege einen Screenshot der Anzeige hier ab oder wähle ihn aus (PNG oder JPG, höchstens 5 MB). Das Modell liest den Text aus dem Bild.'
            }}
          </span>
          <input type="file" accept="image/png,image/jpeg" class="sr-only" @change="pick" />
        </label>

        <div class="flex items-center gap-3">
          <p class="flex-1 text-xs text-muted-foreground">
            {{
              mode === 'text'
                ? 'Der Text wird als Daten behandelt, nie als Anweisung an das Modell.'
                : 'Nimm nur den Ausschnitt mit der Anzeige auf, damit der Text lesbar bleibt.'
            }}
          </p>
          <button
            type="button"
            :class="[
              'h-9 shrink-0 rounded-md px-4 text-sm font-medium disabled:opacity-50',
              draft ? 'border bg-background hover:bg-accent' : 'bg-primary text-primary-foreground hover:bg-primary/90',
            ]"
            :disabled="reading || saving || (mode === 'text' ? !text.trim() : !file)"
            @click="read"
          >
            {{ reading ? 'Auslesen …' : 'Auslesen' }}
          </button>
        </div>
      </section>

      <form v-if="draft" class="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm" @submit.prevent="save">
        <div class="flex items-center gap-2">
          <h2 class="flex-1 text-sm font-semibold">Ausgelesene Stelle</h2>
          <span class="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium">Zum Prüfen</span>
        </div>

        <div class="flex flex-col gap-2">
          <label for="own-job-title" class="text-sm font-medium">Titel</label>
          <input id="own-job-title" v-model="draft.title" required :maxlength="LIMITS.title" :class="FIELD" />
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <label for="own-job-company" class="text-sm font-medium">Firma</label>
            <input id="own-job-company" v-model="draft.company" :maxlength="LIMITS.company" :class="FIELD" />
          </div>
          <div class="flex flex-col gap-2">
            <label for="own-job-city" class="text-sm font-medium">Stadt</label>
            <input id="own-job-city" v-model="draft.city" required :maxlength="LIMITS.city" :class="FIELD" />
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <label for="own-job-offer" class="text-sm font-medium">Angebot</label>
            <select id="own-job-offer" v-model="draft.offer_type" :class="FIELD">
              <option v-for="offer in OFFERS" :key="offer.value" :value="offer.value">{{ offer.label }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-2">
            <label for="own-job-salary" class="text-sm font-medium">Gehaltsangabe</label>
            <input id="own-job-salary" v-model="draft.salary" :maxlength="LIMITS.salary" :class="FIELD" />
          </div>
        </div>

        <fieldset class="flex flex-col gap-2">
          <legend class="mb-2 text-sm font-medium">Arbeitszeit</legend>
          <div class="flex gap-6 text-sm">
            <label class="flex items-center gap-2">
              <input v-model="draft.full_time" type="checkbox" class="size-4 accent-primary" />
              Vollzeit
            </label>
            <label class="flex items-center gap-2">
              <input v-model="draft.part_time" type="checkbox" class="size-4 accent-primary" />
              Teilzeit
            </label>
          </div>
        </fieldset>

        <div class="flex flex-col gap-2">
          <label for="own-job-description" class="text-sm font-medium">Beschreibung</label>
          <textarea
            id="own-job-description"
            v-model="draft.description"
            rows="14"
            required
            :maxlength="MAX_CHARS"
            class="w-full resize-y rounded-md border border-input bg-background px-3 py-2.5 text-sm leading-relaxed shadow-xs outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
          />
          <p v-if="draft.description.includes(UNREADABLE)" class="text-xs text-muted-foreground">
            Stellen mit „{{ UNREADABLE }}“ ließen sich im Screenshot nicht lesen. Ergänze sie aus der Anzeige oder lösche sie.
          </p>
        </div>

        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="h-9 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent disabled:opacity-50"
            :disabled="saving"
            @click="draft = null"
          >
            Verwerfen
          </button>
          <button
            type="submit"
            class="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            :disabled="saving"
          >
            {{ saving ? 'Speichern …' : 'Speichern' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, ImageUp } from '@lucide/vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError } from '../api'
import PageHeader from '../components/PageHeader.vue'
import { useJobsStore } from '../stores/jobs'
import type { OfferType, OwnJobInput } from '../types'

const TABS = [
  { mode: 'text', label: 'Text einfügen' },
  { mode: 'image', label: 'Screenshot hochladen' },
] as const

const OFFERS: { value: OfferType; label: string }[] = [
  { value: 'work', label: 'Arbeit' },
  { value: 'apprenticeship', label: 'Ausbildung' },
  { value: 'internship', label: 'Praktikum' },
  { value: 'self_employment', label: 'Selbstständigkeit' },
]

const FIELD =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus:border-ring focus:ring-3 focus:ring-ring/50'

const LIMITS = { title: 300, company: 300, city: 200, salary: 200 }
const MAX_CHARS = 20000
const MAX_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = ['image/png', 'image/jpeg']
const UNREADABLE = '[nicht lesbar]'

const jobs = useJobsStore()
const router = useRouter()
const mode = ref<'text' | 'image'>('text')
const text = ref('')
const file = ref<File | null>(null)
const dragging = ref(false)
const draft = ref<OwnJobInput | null>(null)
const reading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)

function choose(chosen: File | undefined) {
  if (!chosen) return
  error.value = null
  if (!IMAGE_TYPES.includes(chosen.type)) {
    error.value = 'Bitte ein Bild als PNG oder JPG wählen.'
    return
  }
  if (chosen.size > MAX_BYTES) {
    error.value = 'Die Datei ist größer als 5 MB.'
    return
  }
  file.value = chosen
}

function pick(event: Event) {
  const input = event.target as HTMLInputElement
  choose(input.files?.[0])
  input.value = ''
}

function drop(event: DragEvent) {
  dragging.value = false
  choose(event.dataTransfer?.files[0])
}

async function read() {
  const input = mode.value === 'text' ? text.value : file.value
  if (!input) return
  error.value = null
  reading.value = true
  try {
    const result = await jobs.extract(input)
    draft.value = {
      title: result.title ?? '',
      company: result.company ?? '',
      city: result.city ?? '',
      offer_type: result.offer_type,
      full_time: result.full_time,
      part_time: result.part_time,
      salary: result.salary ?? '',
      description: result.description,
    }
  } catch (caught) {
    const status = caught instanceof ApiError ? caught.status : 0
    if (status === 413) error.value = 'Die Datei ist größer als 5 MB.'
    else if (status === 422 && caught instanceof ApiError && caught.detail === 'not_job')
      error.value = 'Das sieht nicht nach einer einzelnen Stellenanzeige aus. Füge den Text einer Anzeige ein oder lade einen Screenshot davon hoch.'
    else if (status === 422)
      error.value = mode.value === 'text' ? 'Der Text ist leer oder länger als 20.000 Zeichen.' : 'Die Datei ist kein PNG oder JPG.'
    else error.value = 'Die Stelle konnte nicht ausgelesen werden. Versuche es noch einmal.'
  } finally {
    reading.value = false
  }
}

async function save() {
  if (!draft.value) return
  error.value = null
  saving.value = true
  let id: number
  try {
    id = (await jobs.create(draft.value)).id
  } catch {
    error.value = 'Die Stelle konnte nicht gespeichert werden. Prüfe Titel, Stadt und Beschreibung.'
    return
  } finally {
    saving.value = false
  }
  await router.push(`/jobs/own/${id}`)
}
</script>
