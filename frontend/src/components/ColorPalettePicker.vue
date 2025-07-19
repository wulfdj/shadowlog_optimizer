<template>
  <v-chip-group
    v-model="selectedColor"
    mandatory
    selected-class="selected-color-chip"
  >
    <v-chip
      v-for="color in COLOR_PALETTE"
      :key="color"
      :value="color"
      filter
      class="color-picker-chip"
    >
      <!-- The icon is now responsible for displaying the color -->
      <v-icon
        :icon="mdiCircle"
        :color="color"
        size="large"
      ></v-icon>
    </v-chip>
  </v-chip-group>
</template>

<script setup lang="ts">
import { mdiCircle } from '@mdi/js';
import { computed } from 'vue';

// A curated list of Vuetify color names that generally have good contrast
const COLOR_PALETTE = [
  'red', 'pink', 'purple', 'deep-purple', 'indigo', 'blue',
  'light-blue', 'cyan', 'teal', 'green', 'light-green', 'lime',
  'amber', 'orange', 'deep-orange', 'brown', 'blue-grey'
];

const props = defineProps({
  modelValue: String,
});

const emit = defineEmits(['update:modelValue']);

const selectedColor = computed({
  get: () => props.modelValue,
  set: (value) => {
    emit('update:modelValue', value);
  }
});
</script>

<style scoped>
.color-picker-chip {
  padding: 8px !important;
  margin: 2px !important;
  border: 2px solid transparent;
  background-color: #f0f0f0 !important; /* Give unselected chips a neutral background */
  height: 32px !important;
}

.selected-color-chip {
  /* When a chip is selected, add a border to indicate selection */
  border-color: #3f51b5 !important; /* Or your theme's primary color */
  border-width: 2px;
}
</style>