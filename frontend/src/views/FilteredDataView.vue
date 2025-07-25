<template>
  <v-container>
    <v-row>
      <v-col>
        <h1>Filtered Data View - {{ filterStore.activeConfiguration.settings.dataSheetName }}      <v-chip label color="primary" variant="flat" class="ml-1">{{ filterStore.activeStrategyName }}</v-chip></h1>
       
      </v-col>
      <v-col class="text-right d-flex align-center justify-end">
         <v-btn variant="tonal" @click="goBack" class="ml-4"><v-icon :icon="mdiArrowLeft"></v-icon> Back</v-btn>
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
              <pre><code>{{ JSON.stringify(filterStore.activeResult.combination, null, 2) }}</code></pre>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- The Row Count Display -->
          <div class="d-flex align-center mb-2" style="padding-top:10px;">
            <span class="font-weight-medium">
              Showing {{ filteredTrades.length.toLocaleString() }} matching trades
            </span>
          </div>
      
      <div style="height: 70vh; width: 100%;" class="mt-4">
        <ag-grid-vue
          class="ag-theme-alpine"
          :rowData="filteredTrades"
          :columnDefs="columnDefs"
          :defaultColDef="defaultColDef"
          :theme="myTheme"
          style="width: 100%; height: 100%;"
          @grid-ready="onGridReady"
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
import { AllCommunityModule, type ColDef, ModuleRegistry, themeBalham, colorSchemeLight, type GridApi, type GridReadyEvent } from 'ag-grid-community';
import { useInstrumentStore } from '@/stores/instrumentStore';
import { mdiArrowLeft, mdiBackspaceOutline } from '@mdi/js';


const tradeStrategyColumns = [
    { name: "1RR PW", winColumnHeader: "TP 1RR PW WIN", tpPipsColumnHeader: "TP 1RR PW PIPS", slPipsColumnHeader: "SL PW PIPS", rangeBreakoutColumn: "", lta: false, s2: false },
    { name: "1RR STR", winColumnHeader: "TP 1RR STR WIN", tpPipsColumnHeader: "TP 1RR STR PIPS", slPipsColumnHeader: "SL STR PIPS", rangeBreakoutColumn: "", lta: false, s2: false },
    { name: "SR LTA SL PW", winColumnHeader: "TP SR LTA SL PW WIN", tpPipsColumnHeader: "TP SR LTA PIPS", slPipsColumnHeader: "SL PW PIPS", rangeBreakoutColumn: "LTA Range Breakout", lta: true, s2: false },
    { name: "SR LTA SL STR", winColumnHeader: "TP SR LTA SL STR WIN", tpPipsColumnHeader: "TP SR LTA PIPS", slPipsColumnHeader: "SL STR PIPS", rangeBreakoutColumn: "LTA Range Breakout", lta: true, s2: false },
    { name: "SR NEAR SL PW", winColumnHeader: "TP SR NEAREST SL PW WIN", tpPipsColumnHeader: "TP SR NEAREST PIPS", slPipsColumnHeader: "SL PW PIPS", rangeBreakoutColumn: "Nearest Range Breakout", lta: false, s2: false },
    { name: "SR NEAR SL STR", winColumnHeader: "TP SR NEAREST SL STR WIN", tpPipsColumnHeader: "TP SR NEAREST PIPS", slPipsColumnHeader: "SL STR PIPS", rangeBreakoutColumn: "Nearest Range Breakout", lta: false, s2: false },
    { name: "SR STATIC SL PW", winColumnHeader: "TP SR STATIC SL PW WIN", tpPipsColumnHeader: "TP SR STATIC PIPS", slPipsColumnHeader: "SL PW PIPS", rangeBreakoutColumn: "Static Range Breakout", lta: false, s2: false },
    { name: "SR STATIC SL STR", winColumnHeader: "TP SR STATIC SL STR WIN", tpPipsColumnHeader: "TP SR STATIC PIPS", slPipsColumnHeader: "SL STR PIPS", rangeBreakoutColumn: "Static Range Breakout", lta: false, s2: false },
    { name: "SR CURR SL PW", winColumnHeader: "TP SR CURRENT PW WIN", tpPipsColumnHeader: "TP SR CURRENT PIPS", slPipsColumnHeader: "SL PW PIPS", rangeBreakoutColumn: "Current Range Breakout", lta: false, s2: true },
    { name: "SR CURR SL STR", winColumnHeader: "TP SR CURRENT STR WIN", tpPipsColumnHeader: "TP SR CURRENT PIPS", slPipsColumnHeader: "SL STR PIPS", rangeBreakoutColumn: "Current Range Breakout", lta: false, s2: true },
  ];

const myTheme = themeBalham.withPart(colorSchemeLight);

// Create an instance of the store to make its state available to the template.
const instrumentStore = useInstrumentStore();

ModuleRegistry.registerModules([AllCommunityModule]);

const router = useRouter();
const filterStore = useFilterStore();

const allTrades = ref<any[]>([]);

// --- We now only need the GridApi ref ---
const gridApi = ref<GridApi | null>(null);

const onGridReady = (params: GridReadyEvent) => {
  gridApi.value = params.api;
  updateColumnVisibility();
};

// --- CORE FIX 3: Update the function to use gridApi ---
function updateColumnVisibility() {
  if (!gridApi.value) return;

  let strategyFound = tradeStrategyColumns.find( (strategy) => {
    strategy.name === filterStore.activeStrategyName
  });

  tradeStrategyColumns.forEach(strategy => {
    //console.log(strategy);
    if (strategy.name === filterStore.activeStrategyName) {
      strategyFound = strategy;
      return;
    }
  });

  const tpPipsColumnHeader = strategyFound?.tpPipsColumnHeader.split(" ").join("_");
  const slPipsColumnHeader = strategyFound?.slPipsColumnHeader.split(" ").join("_"); 
  const winColumnHeader = strategyFound?.winColumnHeader.split(" ").join("_"); 
  const pipsHeaders = [slPipsColumnHeader, tpPipsColumnHeader];
  const rangeBreakoutColumnHeader = strategyFound?.rangeBreakoutColumn.split(" ").join("_"); 

  // Methods are now directly on gridApi
  const allFieldsInGrid = gridApi.value.getAllGridColumns()?.map(c => c.getColId());
  //console.log("AllFieldsInGrid:", allFieldsInGrid);
  console.log("Win Header:", winColumnHeader);

  //const columnsToShow = visibleColumns.value;
  const columnsToHide = allFieldsInGrid.filter(field => {
    
    if (field.includes("PIPS")) {
      return !pipsHeaders.includes(field);
    }
  
    if (field.includes("WIN")) {
      const isWinFieldIncluded =  field === winColumnHeader;
      console.log(field, winColumnHeader, isWinFieldIncluded);
      return !isWinFieldIncluded;
    } 
});
//console.log("ColumnsToHide: ", columnsToHide);

  // Call the methods directly on gridApi
  //gridApi.value.setColumnsVisible(columnsToShow, true);
  gridApi.value.setColumnsVisible(columnsToHide, false);
}

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
  //console.log("call applyAllFilters", config, result);
  
  if (!config || !result) return [];

  const predefinedFilters = config.settings?.predefinedFilters || [];
  const combination = result.combination || {};
  let strategyFound = tradeStrategyColumns.find( (strategy) => {
    strategy.name === filterStore.activeStrategyName
  });

  tradeStrategyColumns.forEach(strategy => {
    //console.log(strategy);
    if (strategy.name === filterStore.activeStrategyName) {
      strategyFound = strategy;
      return;
    }
  });

  const tpPipsColumnHeader = strategyFound?.tpPipsColumnHeader.split(" ").join("_");
  const slPipsColumnHeader = strategyFound?.slPipsColumnHeader.split(" ").join("_"); 
  const rangeBreakoutColumnHeader = strategyFound?.rangeBreakoutColumn.split(" ").join("_"); 
  const isLtaStrategy = strategyFound?.lta;
  //console.log("headers", filterStore.activeStrategyName, tpPipsColumnHeader, slPipsColumnHeader)

  //console.log("applyAllFilters: ",trades, predefinedFilters, combination);
  return trades.filter(trade => {
    // --- Rule 1: Always check if Entered is true and canceled after candles is 0
    if (trade.Entered !== true || trade.Canceled_After_Candles > 0) {
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
      let cellValue = trade[columnHeader];

      if (columnHeader.includes("|")) {
        const columns = columnHeader.split("|");
        const isBuy = trade["Direction"] === "BUY";
        if (isBuy) {
          cellValue = trade[columns[0]];
        } else {
          cellValue = trade[columns[1]];
        }
      }

      
      if (typeof filterCondition === 'object' && filterCondition !== null && (filterCondition.min !== undefined || filterCondition.max !== undefined)) {
        if (cellValue === null || isNaN(cellValue)) return false;
        if (filterCondition.min !== undefined && cellValue < filterCondition.min) return false;
        if (filterCondition.max !== undefined && cellValue > filterCondition.max) return false;
      } else if (columnHeader === 'TimeFilter') {
        cellValue = trade["Time"]
        //console.log("Found TimeFilter: " , filterCondition, "cell value: ", timeToMinutes(cellValue))
        if (filterCondition.minMinutes !== undefined && timeToMinutes(cellValue) < filterCondition.minMinutes) {
          //console.log("Time under min MInutes: ", timeToMinutes(cellValue), ", condition: " , filterCondition.minMinutes)
          return false;
        }
        if (filterCondition.maxMinutes !== undefined && timeToMinutes(cellValue) > filterCondition.maxMinutes) {
          return false;
        }
      } else {
        if (cellValue !== filterCondition) return false;
      }
    }

    if (tpPipsColumnHeader && slPipsColumnHeader) {
      let isRangeBreakout = false;
      if (rangeBreakoutColumnHeader) {
        isRangeBreakout = trade[rangeBreakoutColumnHeader];
      }
      let tpPips = trade[tpPipsColumnHeader];
      const slPips = trade[slPipsColumnHeader];

      if (tpPips === 0 && !isRangeBreakout) return false;

      if (tpPips === 0) {
        tpPips = slPips;
      }

      //console.log("tpPips: " +  tpPips)
      if (tpPips < 1) return false;

      const slToTPRatio = tpPips / slPips;
      if (slToTPRatio < filterStore.activeConfiguration.settings.minSLToTPRatio) return false;
      if (slToTPRatio > filterStore.activeConfiguration.settings.maxTPToSLRatio) return false;

    }

    // If the trade survived all checks, include it.
    return true;
  });
}

// --- The rest of the script remains largely the same ---

const filteredTrades = computed(() => {
  return applyAllFilters(allTrades.value, filterStore.activeConfiguration, filterStore.activeResult);
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
    { headerName: 'Direction', field: 'Direction', width: 90 },
    { headerName: 'Entered', field: 'Entered', width: 100 },
    { headerName: 'P/L ($)',
    // We don't use 'field' because this column doesn't exist in the source data.
    // Instead, we use a valueGetter.
    valueGetter: (params) => {
      // params.data contains the entire row's data object (one trade)
      const data = params.data;
      if (!data) return null;
let strategyFound = tradeStrategyColumns.find( (strategy) => {
    strategy.name === filterStore.activeStrategyName
  });

      tradeStrategyColumns.forEach(strategy => {
    //console.log(strategy);
    if (strategy.name === filterStore.activeStrategyName) {
      strategyFound = strategy;
      return;
    }
  });

  const tpPipsColumnHeader = strategyFound?.tpPipsColumnHeader.split(" ").join("_");
  const slPipsColumnHeader = strategyFound?.slPipsColumnHeader.split(" ").join("_"); 
  const winColumnHeader = strategyFound?.winColumnHeader.split(" ").join("_");

    if (!tpPipsColumnHeader || !slPipsColumnHeader || !winColumnHeader) return;

      // Use the '1RR PW' strategy as the default for P/L calculation.
      // You could make this selectable in the future.
      const isWin = data[winColumnHeader]
      const slPips = data[slPipsColumnHeader]
      const tpPips = data[tpPipsColumnHeader]

      // Guard against division by zero or invalid data
      if (slPips === null || slPips === undefined || slPips <= 0) {
        return 0;
      }

      if (isWin) {
        // Profit calculation: (TP Pips * (100 / SL Pips))
        return tpPips * (100 / slPips);
      } else {
        // Loss is always a fixed -100 based on the formula
        return -100;
      }
    },
    filter: 'agNumberColumnFilter',
    width: 120,
    // Add a cell style to color the value based on profit or loss
    cellStyle: (params) => {
      if (params.value > 0) {
        // Return a style object for positive values (profit)
        return { color: '#34c38f' }; // Using the 'success' color from your theme
      } else if (params.value < 0) {
        // Return a style object for negative values (loss)
        return { color: '#f46a6a' }; // Using the 'error' color from your theme
      }
      // Return null for zero or no value
      return null;
    },
    // Format the number to two decimal places
    valueFormatter: (params) => {
      if (params.value === null || params.value === undefined) return '';
      return params.value.toFixed(2);
    }
  },
    
    { headerName: 'Canceled After Candles', field: 'Canceled_After_Candles', filter: 'agNumberColumnFilter'},
    
    // --- Candle & Distance Info (Numeric) ---
    { headerName: 'Candle Size', field: 'Candle_Size', filter: 'agNumberColumnFilter' },
    { headerName: 'Breakout Dist', field: 'Breakout_Distance', filter: 'agNumberColumnFilter' },
    { headerName: 'Entry Dist', field: 'Entry_Distance', filter: 'agNumberColumnFilter' },
    { headerName: 'Breakout Candle Count', field: 'Breakout_Candle_Count', filter: 'agNumberColumnFilter' },
    
    
    // --- Key Pips Info (Numeric) ---
    { headerName: '1RR PW Pips', field: 'TP_1RR_PW_PIPS', filter: 'agNumberColumnFilter' },
    { headerName: '1RR STR Pips', field: 'TP_1RR_STR_PIPS', filter: 'agNumberColumnFilter' },
    { headerName: 'TP SR NEAREST Pips', field: 'TP_SR_NEAREST_PIPS', filter: 'agNumberColumnFilter' },
    { headerName: 'TP SR CURRENT Pips', field: 'TP_SR_CURRENT_PIPS', filter: 'agNumberColumnFilter' },
    { headerName: 'TP SR STATIC Pips', field: 'TP_SR_STATIC_PIPS', filter: 'agNumberColumnFilter' },
    { headerName: 'TP SR LTA Pips', field: 'TP_SR_LTA_PIPS', filter: 'agNumberColumnFilter' },
    { headerName: 'SL PW Pips', field: 'SL_PW_PIPS', filter: 'agNumberColumnFilter' },
    { headerName: 'SL STR Pips', field: 'SL_STR_PIPS', filter: 'agNumberColumnFilter' },

    // --- Key Win Conditions ---
    { headerName: '1RR PW Win', field: 'TP_1RR_PW_WIN' },
    { headerName: '1RR STR Win', field: 'TP_1RR_STR_WIN' },
    // --- Key Win Conditions ---
    { headerName: 'TP SR NEAREST SL PW WIN', field: 'TP_SR_NEAREST_SL_PW_WIN' },
    { headerName: 'TP SR NEAREST SL STR WIN', field: 'TP_SR_NEAREST_SL_STR_WIN' },
    { headerName: 'TP SR CURRENT PW WIN', field: 'TP_SR_CURRENT_PW_WIN' },
    { headerName: 'TP SR CURRENT STR WIN', field: 'TP_SR_CURRENT_STR_WIN' },
    { headerName: 'TP SR LTA SL PW WIN', field: 'TP_SR_LTA_SL_PW_WIN' },
    { headerName: 'TP SR LTA SL STR WIN', field: 'TP_SR_LTA_SL_STR_WIN' },
  { headerName: 'S2 Previous Support Distance', field: 'S2_Previous_Support_Distance' },
    { headerName: 'S2 Previous Resistance Distance', field: 'S2_Previous_Resistance_Distance' },

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
    //console.log("onMounted: ", timeframe, instrumentStore.selectedInstrument);
    const response = await api.getTradesByTimeframe(instrumentStore.selectedInstrument, timeframe);
    allTrades.value = response.data;
    //console.log("FilterDataView onMounted - trades", response.data);
    //applyAllFilters(allTrades.value, filterStore.activeConfiguration, filterStore.activeResult.resultData)
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