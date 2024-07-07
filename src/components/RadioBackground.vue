<script setup>
import { onMounted, onUpdated, ref } from 'vue'
import Bg25 from '../components/backgrounds/Bg25.vue'
import Bg37 from '../components/backgrounds/Bg37.vue'
import BgTruchet from '../components/backgrounds/BgTruchet.vue'

const props = defineProps(['show'])

const backgrounds = [Bg25, Bg37]
const randBackground = backgrounds[Math.floor(Math.random() * backgrounds.length)]

const backgroundComponent = ref(null)

onUpdated(() => {
  if (props.show) {
    console.log(backgroundComponent.value)
    backgroundComponent.value.animate()
  }
})
</script>

<template>
  <Transition>
    <component
      :class="{ 'fade-in': props.show, 'fade-out': !props.show }"
      ref="backgroundComponent"
      :is="randBackground"
    >
    </component>
  </Transition>
</template>

<style>
.radio-background {
  width: 100%;
  height: 100%;
  position: fixed;
  left: 0;
  top: 0;

  transition: opacity 2s ease;
  opacity: 0;
}

.fade-in {
  opacity: 1;
}

.fade-out {
  opacity: 0;
}
</style>
