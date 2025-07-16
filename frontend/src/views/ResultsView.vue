<template>
  <v-container fluid>
    <div v-if="!resultDetails" class="text-center mt-12">
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
      <p class="mt-4">Loading Results...</p>
    </div>

    <template v-else>
      <v-row>
        <v-col>
          <h1>Optimization Results</h1>
          <p class="text-subtitle-1">
            Showing top results for configuration: <strong>{{ resultDetails.configuration.name }}</strong>
          </p>
          <p class="text-caption">
            Completed on: {{ new Date(resultDetails.completedAt).toLocaleString() }}
          </p>
        </v-col>
      </v-row>
      <v-row>
        <v-col>
          <div style="height: 75vh; width: 100%;">
            <ag-grid-vue
              :columnDefs="columnDefs"
              :defaultColDef="defaultColDef"
               :row-data="rowData"
              @grid-ready="onGridReady"
              style="height: 100%; width: 100%;"
            ></ag-grid-vue>
          </div>
        </v-col>
      </v-row>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/services/api';

import { AgGridVue } from "ag-grid-vue3";
// Removing the explicit ModuleRegistry, as ag-grid-vue3 handles this for community features.
// This simplifies the code and avoids potential version conflicts.
import { type GridApi, type GridReadyEvent, type ColDef } from "ag-grid-community";
import { useFilterStore } from '@/stores/filterStore';
const filterStore = useFilterStore();
const route = useRoute();
const router = useRouter();
const resultDetails = ref<any>(null);
const gridApi = ref<GridApi | null>(null);

// This is our single source of truth for the grid's data.
// It will update automatically when resultDetails changes.
const rowData = computed(() => resultDetails.value?.results || []);

// onGridReady is now much simpler. Its only job is to get the API.
const onGridReady = (params: GridReadyEvent) => {
  console.log("Grid is ready.");
  gridApi.value = params.api;
  // It's better to size columns after the data has been rendered.
  // We can use the 'firstDataRendered' event or a simple timeout.

   //fetchResults();
   gridApi.value!.setGridOption("rowData", resultDetails.value!.results)

  setTimeout(() => params.api.sizeColumnsToFit(), 100);
};

const defaultColDef = ref({
  sortable: true,
  filter: true,
  resizable: true,
  minWidth: 120,
});




// The column definitions remain the same. This part is working correctly.
const columnDefs = computed<ColDef[]>(() => {
    // Return empty array if there is no data to prevent errors.
    if (!resultDetails.value || !resultDetails.value.results || resultDetails.value.results.length === 0) {
        return [];
    }
    
    const firstResult = resultDetails.value.results[0];
    const strategyNames = Object.keys(firstResult.metrics || {});

    const baseCols: ColDef[] = [
        {
            headerName: 'Actions',
            cellRenderer: (params: any) => {
              const button = document.createElement('button');
                button.innerHTML = `<span class="v-btn__prepend"><i class="mdi-filter-check-outline mdi v-icon"></i></span> Apply`;
                button.className = 'v-btn v-btn--density-default v-btn--size-small v-btn--variant-tonal text-deep-purple-lighten-1';
                
                button.addEventListener('click', () => {
                    const resultData = params.data;
                    const configurationData = resultDetails.value.configuration; // Get the parent configuration
                    if (resultData && configurationData) {
                        filterStore.setFiltersAndNavigate(resultData, configurationData, router);
                    }
                });
                return button;
              
            },
            filter: false,
            sortable: false,
            pinned: 'left',
            width: 140,
        },
        { headerName: 'Rank', valueGetter: 'node.rowIndex + 1', width: 90, sortable: false, filter: false, pinned: 'left' },
        { headerName: 'Overall Score', field: 'overallScore', valueFormatter: (p: any) => p.value.toFixed(4), pinned: 'left', width: 150 },
        { headerName: 'Filter Combination', field: 'combination', valueFormatter: (p: any) => JSON.stringify(p.value), flex: 2, wrapText: true, autoHeight: true, cellStyle: { 'line-height': '20px' } },
        { headerName: 'Overall Trades', field: 'overallTradeCount', width: 150 },
    ];
    
    const strategyCols: ColDef[] = strategyNames.map(name => ({
        headerName: `${name}`,
        children: [
            { headerName: 'Score', field: `strategyScores.${name}`, valueFormatter: (p: any) => p.value?.toFixed(4) || 'N/A', width: 130 },
            { headerName: 'Win Rate', field: `metrics.${name}.winRate`, valueFormatter: (p: any) => p.value !== undefined ? `${(p.value * 100).toFixed(2)}%` : 'N/A', width: 130 },
            { headerName: 'PF', field: `metrics.${name}.profitFactor`, valueFormatter: (p: any) => typeof p.value === 'number' ? p.value.toFixed(2) : String(p.value), width: 120 },
            { headerName: 'Trades', field: `metrics.${name}.totalTradesThisStrategy`, width: 120 },
            { headerName: 'Net Pips', field: `metrics.${name}.netProfit`, valueFormatter: (p: any) => p.value?.toFixed(2) || 'N/A', width: 130 }
        ]
    }));

    return [...baseCols, ...strategyCols];
});

const fetchResults = async () => {
    const resultId = Number(route.params.id);
  if (isNaN(resultId)) return;

  try {
    const response = await api.getResultDetails(resultId);
    const data = response.data;

    // The JSON parsing logic is still correct and necessary.
    if (typeof data.results === 'string') {
        data.results = JSON.parse(data.results);
    }
    
    resultDetails.value = data;
    console.log("Data fetch complete. The reactive `rowData` will now update the grid.", resultDetails.value);

  } catch (error) {
    console.error("Failed to load result details:", error);
  }
};

// onMounted is now the ONLY place where we fetch data for this component.
onMounted(async () => {
  fetchResults();
});


</script>