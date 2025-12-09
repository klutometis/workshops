<script setup lang="ts">
import { onMounted, ref } from 'vue'
import rough from 'roughjs'

const props = defineProps<{
  src: string
  circleX?: number
  circleY?: number
  circleWidth?: number
  circleHeight?: number
  strokeColor?: string
  strokeWidth?: number
}>()

const svgRef = ref<SVGSVGElement>()
const imgRef = ref<HTMLImageElement>()
const imageLoaded = ref(false)

onMounted(() => {
  if (svgRef.value && imageLoaded.value) {
    drawRoughCircle()
  }
})

const onImageLoad = () => {
  imageLoaded.value = true
  if (svgRef.value && imgRef.value) {
    updateSvgSize()
    drawRoughCircle()
  }
}

const updateSvgSize = () => {
  if (!svgRef.value || !imgRef.value) return
  
  const imgRect = imgRef.value.getBoundingClientRect()
  const containerRect = imgRef.value.parentElement?.getBoundingClientRect()
  
  if (!containerRect) return
  
  // Position SVG to match the actual rendered image
  const left = imgRect.left - containerRect.left
  const top = imgRect.top - containerRect.top
  
  svgRef.value.style.width = `${imgRect.width}px`
  svgRef.value.style.height = `${imgRect.height}px`
  svgRef.value.style.left = `${left}px`
  svgRef.value.style.top = `${top}px`
  
  // Set viewBox to match natural image dimensions (assuming ~1920x1080 or similar)
  // This makes our circle coordinates work as expected
  svgRef.value.setAttribute('viewBox', `0 0 ${imgRef.value.naturalWidth} ${imgRef.value.naturalHeight}`)
}

const drawRoughCircle = () => {
  if (!svgRef.value) return
  
  // Clear any existing drawings
  svgRef.value.innerHTML = ''
  
  const rc = rough.svg(svgRef.value)
  const ellipse = rc.ellipse(
    props.circleX || 400,
    props.circleY || 400,
    props.circleWidth || 300,
    props.circleHeight || 150,
    {
      stroke: props.strokeColor || 'red',
      strokeWidth: props.strokeWidth || 4,
      roughness: 2.5,
      fill: 'none',
    }
  )
  svgRef.value.appendChild(ellipse)
}
</script>

<template>
  <div class="relative w-full h-full">
    <img 
      ref="imgRef"
      :src="src" 
      class="w-full h-full object-contain"
      @load="onImageLoad"
    />
    <svg 
      ref="svgRef"
      class="absolute pointer-events-none"
    />
  </div>
</template>
