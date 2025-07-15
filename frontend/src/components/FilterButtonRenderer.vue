<template>
  <v-btn
    size="small"
    color="deep-purple-lighten-1"
    variant="tonal"
    @click="applyFilter"
    prepend-icon="mdi-filter-check-outline"
  >
    Apply
  </v-btn>
</template>

<script setup lang="ts">
import { useFilterStore } from '@/stores/filterStore';
import { useRouter } from 'vue-router';

// This 'props' object is automatically populated by AG-Grid
const props = defineProps({
  params: Object,
});

const filterStore = useFilterStore();
const router = useRouter();

function applyFilter() {
  // The full data for the row is in params.data
  // We want the 'combination' object from that data
  console.log("applyFilter - params object: ", props.params);
  const filterCombination = props.params?.data?.combination;
  if (filterCombination) {
    filterStore.setFiltersAndNavigate(filterCombination, router);
  } else {
    console.error("No filter combination found on this row.", props.params?.data);
  }
}
</script>