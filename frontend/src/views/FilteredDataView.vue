<template>
  <v-container fluid>
    <v-row>
      <v-col>
        <h1>Filtered Data View</h1>
        <v-btn variant="tonal" @click="goBack" class="mb-4">Back to Results</v-btn>
      </v-col>
    </v-row>

    <div v-if="!filterStore.activeResult">
      <v-alert type="info" prominent>
        No active filters. Please go to the <strong>Results</strong> page and click an "Apply" button to see filtered data here.
      </v-alert>
    </div>

    <template v-else>
      <v-row>
        <v-col cols="12" md="6">
          <v-card class="mb-4" height="100%">
            <v-card-title>Original Predefined Filters</v-card-title>
            <v-card-text>
              <pre><code>{{ JSON.stringify(filterStore.activeConfiguration.settings.predefinedFilters, null, 2) }}</code></pre>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="6">
          <v-card class="mb-4" height="100%">
            <v-card-title>Winning Combinatorial Filters</v-card-title>
            <v-card-text>
              <pre><code>{{ JSON.stringify(filterStore.activeResult.resultData.combination, null, 2) }}</code></pre>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
      
      <div style="height: 70vh; width: 100%;" class="mt-4">
        <ag-grid-vue
          class="ag-theme-alpine"
          :rowData="filteredTrades"
          :columnDefs="columnDefs"
          :defaultColDef="defaultColDef"
          :theme="myTheme"
          style="width: 100%; height: 100%;"
        ></ag-grid-vue>
      </div>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useFilterStore } from '@/stores/filterStore';
import api from '@/services/api';

import { AgGridVue } from "ag-grid-vue3";
import { AllCommunityModule, type ColDef, ModuleRegistry, themeBalham, colorSchemeLight } from 'ag-grid-community';
import { useInstrumentStore } from '@/stores/instrumentStore';

const myTheme = themeBalham.withPart(colorSchemeLight);

// Create an instance of the store to make its state available to the template.
const instrumentStore = useInstrumentStore();

ModuleRegistry.registerModules([AllCommunityModule]);

const router = useRouter();
const filterStore = useFilterStore();

const allTrades = ref<any[]>([]);

// --- NEW HELPER FOR TIME CONVERSION ---
function timeToMinutes(timeValue: string): number {
    if (typeof timeValue !== 'string') return NaN;
    const parts = timeValue.split(':');
    if (parts.length >= 2) {
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        if (!isNaN(hours) && !isNaN(minutes)) {
            return hours * 60 + minutes;
        }
    }
    return NaN;
}

// This function now applies BOTH predefined and combinatorial filters
function applyAllFilters(trades: any[], config: any, result: any) {
  
  if (!config || !result) return [];

  const predefinedFilters = config.settings?.predefinedFilters || [];
  const combination = result.combination || {};
  console.log("applyAllFilters: ",trades, predefinedFilters, combination);
  return trades.filter(trade => {
    // --- Rule 1: Always check if Entered is true ---
    if (trade.Entered !== true) {
      return false;
    }

    const timeFilterInCombination = combination.TimeFilter !== undefined;

    
    // --- Rule 2: Apply PREDEFINED filters from the configuration ---
    for (const filter of predefinedFilters) {
        const cellValue = trade[filter.columnHeader];

        if (filter.type === 'exact') {
            if (cellValue !== filter.condition) return false;
        } 
        else if (filter.type === 'timeRange' && !timeFilterInCombination) {
            const tradeTimeInMinutes = timeToMinutes(trade.Time);
            if (isNaN(tradeTimeInMinutes)) return false;

            const minTimeInMinutes = filter.condition.minMinutes ? timeToMinutes(filter.condition.minMinutes) : -Infinity;
            const maxTimeInMinutes = filter.condition.maxMinutes ? timeToMinutes(filter.condition.maxMinutes) : Infinity;

            if (tradeTimeInMinutes < minTimeInMinutes || tradeTimeInMinutes > maxTimeInMinutes) return false;
        }
    }

    // --- Rule 3: Apply the COMBINATORIAL filters from the specific result ---
    for (const columnHeader in combination) {
      const filterCondition = combination[columnHeader];
      const cellValue = trade[columnHeader];
      
      if (typeof filterCondition === 'object' && filterCondition !== null && (filterCondition.min !== undefined || filterCondition.max !== undefined)) {
        if (cellValue === null || isNaN(cellValue)) return false;
        if (filterCondition.min !== undefined && cellValue < filterCondition.min) return false;
        if (filterCondition.max !== undefined && cellValue > filterCondition.max) return false;
      } else if (columnHeader === 'TimeFilter') {
        if (filterCondition.minMinutes !== undefined && timeToMinutes(cellValue) < filterCondition.minMinutes) return false;
        if (filterCondition.maxMinutes !== undefined && timeToMinutes(cellValue) > filterCondition.maxMinutes) return false;
      } else {
        if (cellValue !== filterCondition) return false;
      }
    }

    // If the trade survived all checks, include it.
    return true;
  });
}

// --- The rest of the script remains largely the same ---

const filteredTrades = computed(() => {
  return applyAllFilters(allTrades.value, filterStore.activeConfiguration, filterStore.activeResult.resultData);
});

const goBack = () => {
  router.go(-1);
};

// Define your columns as before
const columnDefs = ref<ColDef[]>([
    // --- Core Info ---
    { headerName: 'Date', field: 'Date', width: 120, pinned: 'left' },
    { headerName: 'Time', field: 'Time', width: 100, pinned: 'left' },
    { headerName: 'Setup', field: 'Setup', width: 90 },
    { headerName: 'Direction', field: 'Direction', width: 110 },
    { headerName: 'Entered', field: 'Entered', width: 100 },
    
    // --- Candle & Distance Info (Numeric) ---
    { headerName: 'Candle Size', field: 'Candle_Size', filter: 'agNumberColumnFilter' },
    { headerName: 'Breakout Dist', field: 'Breakout_Distance', filter: 'agNumberColumnFilter' },
    { headerName: 'Entry Dist', field: 'Entry_Distance', filter: 'agNumberColumnFilter' },
    { headerName: 'Breakout Candle Count', field: 'Breakout_Candle_Count', filter: 'agNumberColumnFilter' },
    
    // --- Key Win Conditions ---
    { headerName: '1RR PW Win', field: 'TP_1RR_PW_WIN' },
    { headerName: '1RR STR Win', field: 'TP_1RR_STR_WIN' },

    // --- Key Pips Info (Numeric) ---
    { headerName: '1RR PW Pips', field: 'TP_1RR_PW_PIPS', filter: 'agNumberColumnFilter' },
    { headerName: '1RR STR Pips', field: 'TP_1RR_STR_PIPS', filter: 'agNumberColumnFilter' },
    { headerName: 'SL PW Pips', field: 'SL_PW_PIPS', filter: 'agNumberColumnFilter' },
    { headerName: 'SL STR Pips', field: 'SL_STR_PIPS', filter: 'agNumberColumnFilter' },

    // --- Gaussian Trends ---
    { headerName: 'G-Trend 1', field: 'Gaussian_Trend_1' },
    { headerName: 'G-Trend 2', field: 'Gaussian_Trend_2' },
    { headerName: 'G-Trend 3', field: 'Gaussian_Trend_3' },
    { headerName: 'G-Trend 4', field: 'Gaussian_Trend_4' },
    { headerName: 'G-Trend 5', field: 'Gaussian_Trend_5' },
    { headerName: 'G-Trend 6', field: 'Gaussian_Trend_6' },
    { headerName: 'G-Trend 7', field: 'Gaussian_Trend_7' },

    // --- Higher Timeframe Candle States ---
    { headerName: 'M5', field: 'M5_Candle' },
    { headerName: 'M10', field: 'M10_Candle' },
    { headerName: 'M15', field: 'M15_Candle' },
    { headerName: 'M30', field: 'M30_Candle' },
    { headerName: 'H1', field: 'H1_Candle' },
    { headerName: 'H4', field: 'H4_Candle' },
    { headerName: 'D1', field: 'D1_Candle' },

    // --- Miscellaneous ---
    { headerName: 'Entry Wick', field: 'Entry_Candle_Has_Wick' },
    { headerName: 'Setup Wick', field: 'Setup_Candle_Has_Wick' },
    { headerName: 'In LTA', field: 'Closed_In_LTA' },
    { headerName: 'LTA Breakout', field: 'LTA_Range_Breakout' },
]);

const defaultColDef = ref({
  sortable: true,
  filter: true,
  resizable: true,
});

onMounted(async () => {
  try {
    const timeframe = filterStore.activeConfiguration.settings.dataSheetName;
    console.log("onMounted: ", timeframe, instrumentStore.selectedInstrument);
    const response = await api.getTradesByTimeframe(instrumentStore.selectedInstrument, timeframe);
    allTrades.value = response.data;
  } catch (error) {
    console.error("Could not fetch trade dataset:", error);
  }
});
</script>

<style scoped>
pre {
  background-color: #f4f4f4;
  padding: 1rem;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>