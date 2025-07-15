<template>
<v-container fluid>
<v-row align="center">
<v-col>
<h1>Data Explorer</h1>
<p>Browse and filter raw imported trade data for each timeframe.</p>
</v-col>
<v-col class="text-right">
<v-btn color="primary" @click="openImportDialog">
Import New CSV
</v-btn>
</v-col>
</v-row>
<v-tabs v-model="selectedTimeframe" bg-color="primary" class="mb-4">
  <v-tab v-for="tf in availableTimeframes" :key="tf" :value="tf">
    {{ tf }}
  </v-tab>
</v-tabs>

<div style="height: 75vh; width: 100%;">
  <ag-grid-vue
    class="ag-theme-alpine"
    :columnDefs="columnDefs"
    :defaultColDef="defaultColDef"
    @grid-ready="onGridReady"
    style="width: 100%; height: 100%;"
  ></ag-grid-vue>
</div>

<!-- Import Dialog (This logic is identical to before) -->
<v-dialog v-model="importDialog.show" persistent width="500">
  <v-card>
        <v-card-title class="headline">Import Trade Data</v-card-title>
        <v-card-text>
          <p>Select the timeframe this CSV file belongs to. This will overwrite any existing data for that timeframe.</p>
          <v-select
            v-model="importDialog.timeframe"
            :items="['1M', '5M', '15M', '30M', '1H', '4H', 'D1']"
            label="Select Timeframe"
            class="mt-4"
          ></v-select>
          <v-file-input
            v-model="importDialog.file"
            label="Select CSV File"
            accept=".csv"
            show-size
          ></v-file-input>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey" text @click="closeImportDialog">Cancel</v-btn>
          <v-btn
            color="primary"
            text
            @click="handleFileUpload"
            :loading="importDialog.isUploading"
            :disabled="!importDialog.timeframe || !importDialog.file"
          >
            Upload
          </v-btn>
        </v-card-actions>
      </v-card>
</v-dialog>

<v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="4000">
    <!-- ... -->
</v-snackbar>
</v-container>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue';
import { AgGridVue } from "ag-grid-vue3";
import { type GridApi, type GridReadyEvent, type ColDef, ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import Papa from 'papaparse';
import api from '@/services/api';

ModuleRegistry.registerModules([AllCommunityModule]);
const gridApi = ref<GridApi | null>(null);
const availableTimeframes = ref<string[]>([]);
const selectedTimeframe = ref<string | null>(null);

const importDialog = reactive({
  show: false,
  isUploading: false,
  timeframe: '5M',
  file: null as File[] | null,
});

const snackbar = reactive({ show: false, message: '', color: 'success' });

const onGridReady = (params: GridReadyEvent) => {
  gridApi.value = params.api;
  gridApi.value.showLoadingOverlay();
};

const showSnackbar = (message: string, color: string = 'success') => {
  snackbar.message = message;
  snackbar.color = color;
  snackbar.show = true;
};

const openImportDialog = () => {
  importDialog.show = true;
};

const closeImportDialog = () => {
  importDialog.show = false;
  importDialog.file = null;
  importDialog.isUploading = false;
};

const fetchTimeframes = async () => {
  try {
    const response = await api.getAvailableTimeframes();
    availableTimeframes.value = response.data;
    if (response.data.length > 0 && !selectedTimeframe.value) {
      selectedTimeframe.value = response.data[0];
    }
  } catch (error) {
    console.error("Failed to fetch timeframes:", error);
  }
};

const fetchTradesForGrid = async (timeframe: string | null) => {
  if (!timeframe || !gridApi.value) {
    gridApi.value?.showNoRowsOverlay();
    return;
  }
  gridApi.value.showLoadingOverlay();
  try {
    const response = await api.getTradesByTimeframe(timeframe);
    gridApi.value.setGridOption("rowData", response.data);
  } catch (error) {
    console.error(`Failed to fetch trades for ${timeframe}:`, error);
    showSnackbar(`Could not fetch data for ${timeframe}.`, "error");
  }
};

const handleFileUpload = () => {
  
  const file = importDialog.file;
  console.log("handleFileUpload", importDialog.file, file);
  if (!file || !importDialog.timeframe) return;

  importDialog.isUploading = true;
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: async (results) => {
      const transformedData = results.data.map((row: any) => {
            const newRow: { [key: string]: any } = {};
            for (const key in row) {
              const newKey = key.trim().replace(/ /g, '_'); // Replace spaces with underscores
              const value = row[key];
              if (typeof value === 'string') {
                if (value.toUpperCase() === 'TRUE') newRow[newKey] = true;
                else if (value.toUpperCase() === 'FALSE') newRow[newKey] = false;
                else newRow[newKey] = value;
              } else {
                 newRow[newKey] = value;
              }
            }
            return newRow;
          });

      try {
        await api.uploadTrades(transformedData, importDialog.timeframe!);
        showSnackbar(`Successfully uploaded data for ${importDialog.timeframe}.`, 'success');
        closeImportDialog();
        // Refresh the list of available timeframes and switch to the new one
        await fetchTimeframes();
        selectedTimeframe.value = importDialog.timeframe;
      } catch (error: any) {
        showSnackbar(error.response?.data?.message || 'Upload failed!', 'error');
      } finally {
        importDialog.isUploading = false;
      }
    },
    error: (error: any) => {
      showSnackbar("Failed to parse CSV file.", "error");
      importDialog.isUploading = false;
    }
  });
};

// Watch for changes on the selected tab and reload the grid data
watch(selectedTimeframe, (newTimeframe) => {
  fetchTradesForGrid(newTimeframe);
});

onMounted(fetchTimeframes);

const defaultColDef = ref({ sortable: true, filter: true, resizable: true });
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
</script>