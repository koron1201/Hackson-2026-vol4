<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BottomNav from '@/components/BottomNav.vue'
import ToastNotice from '@/components/ToastNotice.vue'
import { useQuestStore } from '@/stores/quest'

const route = useRoute()
const router = useRouter()
const store = useQuestStore()

const hideChrome = computed(() => Boolean(route.meta.hideChrome))

function syncNetworkState() {
  store.setOffline(!navigator.onLine)
}

onMounted(() => {
  store.hydrate()
  store.startClock()
  syncNetworkState()
  window.addEventListener('online', syncNetworkState)
  window.addEventListener('offline', syncNetworkState)

  if (!store.isAuthenticated && !route.meta.public) void router.replace('/login')
})

onBeforeUnmount(() => {
  window.removeEventListener('online', syncNetworkState)
  window.removeEventListener('offline', syncNetworkState)
})
</script>

<template>
  <div class="app-frame" :class="{ 'app-frame--immersive': hideChrome }">
    <div v-if="store.isOffline" class="offline-banner" role="status">
      オフラインです。操作は端末に保持され、再接続後に同期されます。
    </div>
    <AppHeader v-if="!hideChrome" />
    <main class="app-main" :class="{ 'app-main--immersive': hideChrome }">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
    <BottomNav v-if="!hideChrome" />
    <ToastNotice />
  </div>
</template>
