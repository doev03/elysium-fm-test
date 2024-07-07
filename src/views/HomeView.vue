<script setup>
import { ref } from 'vue'
import TheWelcome from '@/components/TheWelcome.vue'
//import RadioBackground from '../components/RadioBackground.vue'
import BgTruchet from '../components/backgrounds/BgTruchet.vue'
import Bg25 from '@/components/backgrounds/Bg25.vue'
import RadioBackground from '@/components/RadioBackground.vue'
import RadioButton from '@/components/RadioButton.vue'

const isPlay = ref(false)

const play = () => {
  isPlay.value = true
}
</script>

<template>
  <RadioBackground :show="isPlay" />
  <main>
    <RadioButton @on-click="play" />
  </main>
</template>

<style>
main {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}
</style>
