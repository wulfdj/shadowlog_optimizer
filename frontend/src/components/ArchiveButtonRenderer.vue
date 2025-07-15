<template>
  <v-dialog v-model="dialog" persistent width="500">
    <template v-slot:activator="{ props }">
      <v-btn
        v-bind="props"
        size="small"
        color="amber-darken-1"
        variant="tonal"
        prepend-icon="mdi-star-plus-outline"
      >
        Save
      </v-btn>
    </template>
    <v-card>
      <v-card-title>
        <span class="headline">Save Strategy to History</span>
      </v-card-title>
      <v-card-text>
        <p class="mb-4">Give this strategy a memorable name to track it long-term.</p>
        <v-text-field
          v-model="name"
          label="Strategy Name"
          placeholder="e.g., London Open S1 Gaussian"
          autofocus
        ></v-text-field>
        <v-textarea
          v-model="notes"
          label="Notes (Optional)"
          placeholder="e.g., 'Very consistent during high volatility.'"
          rows="2"
        ></v-textarea>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue-darken-1" text @click="dialog = false">Cancel</v-btn>
        <v-btn color="blue-darken-1" text @click="archiveStrategy" :loading="isSaving">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import api from '@/services/api';

const props = defineProps({
  params: Object,
  // We'll pass a function from the parent to show a snackbar on success
  onSuccess: Function,
});

const dialog = ref(false);
const isSaving = ref(false);
const name = ref('');
const notes = ref('');

async function archiveStrategy() {
  if (!name.value) return;

  const resultData = props.params?.data;
  if (!resultData) {
    console.error("No result data found on this row.");
    return;
  }

  isSaving.value = true;
  try {
    await api.saveToArchive({
      name: name.value,
      notes: notes.value,
      resultData: resultData,
    });
    props.onSuccess?.(`Strategy '${name.value}' saved successfully!`);
    dialog.value = false;
    name.value = ''; // Reset form
    notes.value = '';
  } catch (error) {
    console.error("Failed to save to archive:", error);
    // Optionally show an error snackbar
  } finally {
    isSaving.value = false;
  }
}
</script>