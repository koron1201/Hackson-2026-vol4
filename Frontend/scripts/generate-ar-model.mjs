import fs from 'node:fs'
import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js'

globalThis.FileReader = class {
  result = null
  onloadend = null
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = `data:application/octet-stream;base64,${Buffer.from(buffer).toString('base64')}`
      this.onloadend?.()
    })
  }
}

const scene = new THREE.Scene()
const body = new THREE.Mesh(
  new THREE.SphereGeometry(0.22, 16, 12),
  new THREE.MeshStandardMaterial({ color: 0x7c3aed }),
)
body.scale.set(1, 1.2, 0.8)
body.position.y = 0.22
const head = new THREE.Mesh(
  new THREE.SphereGeometry(0.16, 16, 12),
  new THREE.MeshStandardMaterial({ color: 0xffd4a8 }),
)
head.position.y = 0.52
const crown = new THREE.Mesh(
  new THREE.ConeGeometry(0.1, 0.18, 5),
  new THREE.MeshStandardMaterial({ color: 0xfacc15 }),
)
crown.position.y = 0.75
scene.add(body, head, crown)

const exporter = new GLTFExporter()
exporter.parse(scene, (result) => {
  fs.writeFileSync('public/assets/ar-hero.gltf', JSON.stringify(result))
}, (error) => {
  console.error(error)
  process.exitCode = 1
}, { binary: false })

const usdz = await new USDZExporter().parseAsync(scene)
fs.writeFileSync('public/assets/ar-hero.usdz', Buffer.from(usdz))
