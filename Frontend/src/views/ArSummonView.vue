<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { supportsQuickLookAr } from '@/ar/quickLook'
import { supportsImmersiveAr } from '@/ar/webxr'

type ArState = 'ready' | 'starting' | 'active' | 'unsupported' | 'error'

const router = useRouter()
const canvas = ref<HTMLCanvasElement | null>(null)
const overlayRoot = ref<HTMLElement | null>(null)
const state = ref<ArState>('ready')
const message = ref('QRを確認しました。AR空間にキャラクターを召喚できます。')
const placed = ref(false)
const quickLookAvailable = computed(() => supportsQuickLookAr())

let renderer: THREE.WebGLRenderer | undefined
let session: XRSession | undefined
let hitTestSource: XRHitTestSource | undefined
let referenceSpace: XRReferenceSpace | undefined
let model: THREE.Object3D | undefined
let disposed = false

function goTasks() {
  void router.replace('/tasks')
}

function cleanup(markDisposed = false) {
  if (markDisposed) disposed = true
  if (hitTestSource) hitTestSource.cancel()
  hitTestSource = undefined
  const activeSession = session
  session = undefined
  if (activeSession) void activeSession.end()
  renderer?.setAnimationLoop(null)
  renderer?.dispose()
  renderer = undefined
  model = undefined
}

function createFallbackCharacter() {
  const group = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 20, 14),
    new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.8 }),
  )
  body.scale.set(1, 1.15, 0.8)
  body.position.y = 0.2
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 20, 14),
    new THREE.MeshStandardMaterial({ color: 0xffd4a8, roughness: 0.8 }),
  )
  head.position.y = 0.46
  group.add(body, head)
  return group
}

async function loadCharacter() {
  if (!renderer) return createFallbackCharacter()
  try {
    const gltf = await new GLTFLoader().loadAsync('/assets/ar-hero.gltf')
    return gltf.scene
  } catch {
    return createFallbackCharacter()
  }
}

async function startAr() {
  if (state.value === 'starting' || state.value === 'active' || !canvas.value || !overlayRoot.value) return
  state.value = 'starting'
  message.value = 'AR対応状況を確認しています…'

  if (!(await supportsImmersiveAr())) {
    state.value = 'unsupported'
    message.value = 'このブラウザは空間ARに対応していません。2D演出を表示します。'
    return
  }

  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas.value, alpha: true, antialias: true })
    renderer.xr.enabled = true
    renderer.xr.setReferenceSpaceType('local-floor')
    const scene = new THREE.Scene()
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.5))
    const camera = new THREE.PerspectiveCamera()
    model = await loadCharacter()
    model.scale.setScalar(0.8)
    model.visible = false
    scene.add(model)

    session = await (navigator as Navigator & { xr: XRSystem }).xr.requestSession('immersive-ar', {
      requiredFeatures: ['local', 'hit-test'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: overlayRoot.value },
    })
    session.addEventListener('end', () => cleanup())
    await renderer.xr.setSession(session)
    referenceSpace = renderer.xr.getReferenceSpace() ?? undefined
    const viewerSpace = await session.requestReferenceSpace('viewer')
    if (!session.requestHitTestSource) throw new Error('Hit Test is unavailable')
    hitTestSource = await session.requestHitTestSource({ space: viewerSpace })
    state.value = 'active'
    message.value = '床や机にカメラを向けるとキャラクターが現れます。'

    renderer.setAnimationLoop((_time, frame) => {
      if (!frame || !referenceSpace || !hitTestSource || !model) return
      const hit = frame.getHitTestResults(hitTestSource)[0]
      if (hit) {
        const pose = hit.getPose(referenceSpace)
        if (pose) {
          model.visible = true
          model.position.set(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z)
          model.quaternion.set(
            pose.transform.orientation.x,
            pose.transform.orientation.y,
            pose.transform.orientation.z,
            pose.transform.orientation.w,
          )
          placed.value = true
        }
      }
      renderer?.render(scene, camera)
    })
  } catch (error) {
    console.error('WebXR AR session failed', error)
    cleanup()
    if (!disposed) {
      state.value = 'error'
      message.value = 'ARを開始できませんでした。カメラ権限とHTTPS接続を確認してください。'
    }
  }
}

onMounted(() => {
  if (quickLookAvailable.value) {
    message.value = 'ARでキャラを召喚すると、iPhoneのカメラで実際の空間に配置できます。'
  }
  // WebXR sessions require a user activation, so the start button is intentional.
})
onBeforeUnmount(() => cleanup(true))
</script>

<template>
  <main ref="overlayRoot" class="ar-summon-page">
    <canvas ref="canvas" class="ar-summon-canvas" aria-label="ARカメラ映像"></canvas>
    <img v-if="state === 'unsupported'" class="ar-summon-fallback-hero" src="/assets/hero.png" alt="召喚されたキャラクター" />
    <section class="ar-summon-panel" role="status" aria-live="polite">
      <p class="eyebrow">AR SUMMON</p>
      <h1>キャラクター召喚</h1>
      <p>{{ message }}</p>
      <p v-if="placed" class="ar-summon-placed">✦ キャラクターを配置しました</p>
      <a
        v-if="state === 'ready' && quickLookAvailable"
        class="button button--wide quick-look-trigger"
        rel="ar"
        href="/assets/ar-hero.usdz"
        aria-label="ARでキャラを召喚"
      ><img src="/assets/hero.png" alt="" /></a>
      <button v-else-if="state === 'ready'" class="button button--wide" type="button" @click="startAr">
        ARで召喚する
      </button>
      <button v-else-if="state === 'unsupported' || state === 'error'" class="button button--wide" type="button" @click="goTasks">
        2D演出で続ける
      </button>
      <button v-else-if="state === 'active'" class="button button--wide" type="button" @click="goTasks">
        召喚を終了する
      </button>
    </section>
  </main>
</template>
