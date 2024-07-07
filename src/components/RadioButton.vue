<script setup>
import { onMounted, ref } from 'vue'
import IcecastMetadataPlayer from 'icecast-metadata-player'

const emit = defineEmits(['on-click'])

const streamUrl = 'https://elysiumfm.ru/stream'

const getAudioElement = () => document.getElementById('radio-stream')

const showButton = ref(true)

let player

const play = () => {
  player.play()

  showButton.value = false
  // this.style.opacity = '0'; // Start fade out
  // setTimeout(() => {
  //   this.remove(); // Remove the button after fading out
  // }, 2000);

  emit('on-click')
}

onMounted(() => {
  player = new IcecastMetadataPlayer(streamUrl, {
    onMetadata: (metadata) => {
      console.log(metadata)
    },
    metadataTypes: []
  })
  //audioElement.volume = 0.05;
})
</script>

<template>
  <audio id="radio-stream"></audio>
  <Transition>
    <button id="play-button" class="play-button" @click="play" v-if="showButton">Play Audio</button>
  </Transition>
</template>

<style scoped>
audio {
  display: none;
}

.play-button {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 10px 20px;
  background: #fff;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.v-enter-active,
.v-leave-active {
  transition: opacity 2s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>
