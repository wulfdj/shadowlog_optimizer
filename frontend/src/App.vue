<template>
  <v-app :theme="theme">
    <v-app-bar app dark :color="theme === 'light' ? 'primary' : ''">
       <v-btn
          
          :icon="mdiThemeLightDark"
          slim
          @click="onClick"
        ></v-btn>
      <v-toolbar-title>Shadowlog Optimizer Pro</v-toolbar-title>
      <v-spacer></v-spacer>
      <v-select
        :items="instrumentStore.availableInstruments"
        v-model="instrumentStore.selectedInstrument"
        density="compact"
        hide-details
        variant="solo-filled"
        class="instrument-selector mx-4"
        flat
      ></v-select>
      <v-btn to="/" text>Dashboard</v-btn>
      <v-btn to="/data" text>Data Explorer</v-btn>
      <v-btn to="/config" text>Configuration</v-btn>
      <v-btn to="/history" text>History</v-btn>
      <v-btn to="/archive" text>Archived</v-btn>
    </v-app-bar>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useInstrumentStore } from '@/stores/instrumentStore';
import { mdiWeatherSunny, mdiWeatherNight, mdiThemeLightDark} from '@mdi/js';
const instrumentStore = useInstrumentStore();

console.log("BaseURL: " + import.meta.env.VITE_API_BASE_URL);

  const theme = ref('light')
  const icon = ref('mdiWeatherNight')

  function onClick () {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    icon.value = mdiWeatherSunny
  }
</script>

<style scoped>
.instrument-selector {
  max-width: 150px;
  flex-grow: 0;
}
</style>