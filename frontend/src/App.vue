<template>
  <v-app>
    <v-app-bar app color="primary" dark>
      <v-toolbar-title>Shadowlog Optimizer Pro</v-toolbar-title>
      <v-spacer></v-spacer>
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

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'App',
});
</script>