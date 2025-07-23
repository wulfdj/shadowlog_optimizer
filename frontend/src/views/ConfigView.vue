<template>
  <v-container>
    <v-row>
      <!-- Left Column: The Configuration Form -->
      <v-col cols="12" md="7">
        <v-card>
          <v-card-title class="headline">
            {{ isEditing ? 'Edit Configuration' : 'Create New Configuration' }}
          </v-card-title>
          <v-card-subtitle v-if="isEditing">
            Editing: <strong>{{ formState.name }}</strong> (ID: {{ formState.id }})
          </v-card-subtitle>
          <v-card-text>
            <v-text-field
              v-model="formState.name"
              label="Configuration Name"
              placeholder="e.g., S1 London Aggressive"
              variant="outlined"
              class="mb-4"
            ></v-text-field>

            <!-- General Settings -->
            <v-card class="mb-4">
              <v-card-item>
                <v-card-title>General Settings</v-card-title>
                <v-select v-model="formState.dataSheetName" :items="sheetNameOptions" label="Timeframe (Data Sheet)" class="mt-2"></v-select>
                <v-text-field v-model.number="formState.minTradeCount" label="Min Trade Count" type="number"></v-text-field>
                <v-text-field v-model.number="formState.maxCombinationsToTest" label="Max Combinations to Test" type="number"></v-text-field>
              </v-card-item>
            </v-card>

            <!-- Predefined Filters -->
            <v-card class="mb-4">
              <v-card-item>
                <v-card-title>Predefined Filters</v-card-title>
                <v-row dense>
                  <v-col cols="6"><v-select v-model="formState.predefinedFilters.setup" :items="setupOptions" label="Setup"></v-select></v-col>
                  <v-col cols="6"><v-select v-model="formState.predefinedFilters.session" :items="sessionOptions" label="Session (Leave blank for 'Any')" clearable></v-select></v-col>
                </v-row>
                <v-row dense>
                  <v-col cols="6"><v-checkbox v-model="formState.predefinedFilters.entryCandleHasWick" label="Entry Candle Has Wick"></v-checkbox></v-col>
                  <v-col cols="6"><v-checkbox v-model="formState.predefinedFilters.setupCandleHasWick" label="Setup Candle Has Wick"></v-checkbox></v-col>
                  <v-col cols="6"><v-text-field v-model="formState.predefinedFilters.entryDistanceMax" label="Entry Distance Max"></v-text-field></v-col>
                  <v-col cols="6"><v-text-field v-model="formState.predefinedFilters.breakoutDistanceMax" label="Breakout Distance Max"></v-text-field></v-col>
                  
                  <v-col cols="6">
                    <p class="text-subtitle-1">Candle Size</p>
                    <v-row dense>
                     <v-col cols="6"> <v-text-field v-model="formState.predefinedFilters.candleSize.min" label="Min"></v-text-field></v-col>
                      <v-col cols="6"><v-text-field v-model="formState.predefinedFilters.candleSize.max" label="Max"></v-text-field></v-col>
                    </v-row>
                  </v-col>
                </v-row>
                <p class="text-subtitle-1 mt-2">Time Range (e.g., 08:00 to 16:30)</p>
                <v-row dense>
                     
                  
                  
                  <v-col cols="6"><v-text-field v-model="formState.predefinedFilters.timeMin" label="Min Time" type="time" :rules="[rules.required]"></v-text-field></v-col>
                  <v-col cols="6"><v-text-field v-model="formState.predefinedFilters.timeMax" label="Max Time" type="time" :rules="[rules.required]"></v-text-field></v-col>
                  <v-checkbox v-model="formState.enableTimeShift" label="Enable Time Shift Analysis (+/- 2 hours)"
                        messages="When enabled, the optimizer will run extra tests on time windows 2 hours before and 2 hours after the specified range."></v-checkbox>
                  
                </v-row>
              </v-card-item>
            </v-card>
            
            <!-- Ranking Weights -->
            <v-expansion-panels class="mb-4">
              <v-expansion-panel>
              <v-expansion-panel-title>Ranging Weights</v-expansion-panel-title>
              <v-expansion-panel-text>
                 <v-slider v-model="formState.rankingWeights.profitFactor" label="Profit Factor" thumb-label="always" step="0.01" min="0" max="1" color="green" ></v-slider>
                 <v-slider v-model="formState.rankingWeights.winRate" label="Win Rate" thumb-label="always" step="0.01" min="0" max="1" color="blue"></v-slider>
                 <v-slider v-model="formState.rankingWeights.tradeCount" label="Trade Count" thumb-label="always" step="0.01" min="0" max="1" color="orange"></v-slider>
                 <v-slider v-model="formState.rankingWeights.netProfitPips" label="Net Profit Pips" thumb-label="always" step="0.01" min="0" max="1" color="purple"></v-slider>
              </v-expansion-panel-text>
            </v-expansion-panel>
            </v-expansion-panels>

            <v-card class="mb-4">
               <v-card-item>
                <v-card-title>Result Filtering</v-card-title>
                 <v-slider v-model="formState.minSLToTPRatio" label="Min SL To TP Ratio" thumb-label="always" step="0.1" min="0" max="1" color="green" ></v-slider>
                 <v-slider v-model="formState.maxTPToSLRatio" label="Max TP To SL Ratio" thumb-label="always" step="0.1" min="0" max="3" color="blue"></v-slider>
                 <v-slider v-model="formState.minProfitFactor" label="Min Profit Factor" thumb-label="always" step="0.1" min="1" max="2" color="orange"></v-slider>
                 <v-slider v-model="formState.minWinRate" label="Min Win Rate" thumb-label="always" step="0.5" min="50" max="100" color="purple"></v-slider>
               </v-card-item>
            </v-card>
            
            <!-- Combinations to Test -->
            <v-card >
              <v-card-item>
                <v-card-title>Combinations to Test</v-card-title>
                <v-row dense>
                  <v-col v-for="combo in formState.combinations" :key="combo.name" cols="12" sm="6">
                      <v-checkbox
                        v-model="combo.enabled"
                        :label="combo.name"
                        color="primary"
                        density="compact"
                        hide-details
                        ></v-checkbox>
                  </v-col>
                </v-row>
              </v-card-item>
            </v-card>
          </v-card-text>
          <v-card-actions>
            <v-btn v-if="isEditing" color="grey" @click="cancelEdit">Cancel Edit</v-btn>
            <v-spacer></v-spacer>
            <v-btn color="primary" large @click="saveConfig" :loading="isSaving" variant="tonal">
              {{ isEditing ? 'Update Configuration' : 'Save New Configuration' }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <!-- Right Column: List of Saved Configurations -->
      <v-col cols="12" md="5">
        <h2>Saved Configurations</h2>
        <v-list lines="one">
          <v-list-item
            v-for="config in savedConfigurations"
            :key="config.id"
            :title="config.name"
            :subtitle="`ID: ${config.id}`"
            :active="isEditing && formState.id === config.id"
            v-on:click="startEdit(config)"
          >
            <template v-slot:append>

                  <div class="text-caption">
                  <v-chip label color="orange" size="small" class="mr-1">{{ config.settings.dataSheetName }}</v-chip>
                  <v-chip label color="blue" size="small" class="mr-1">{{ getPredefinedFilter(config, 'Setup') }}</v-chip>
                </div>
              
              <v-checkbox v-model="config.highPriority" style="padding-top:20px;padding-right:10px;" label="All Cores"></v-checkbox>
              <v-btn color="error" variant="tonal" size="small" @click="confirmDelete(config)">Delete</v-btn>
              <v-btn color="success" variant="tonal" size="small" @click="runOptimization(config.id, config.highPriority)" class="ml-2">Run</v-btn>
              
            </template>
          </v-list-item>
        </v-list>
      </v-col>
    </v-row>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="4000">
      {{ snackbar.message }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { mdiPencil, mdiDelete } from '@mdi/js';
import { ref, reactive, onMounted, computed, watch } from 'vue';
import api from '@/services/api';
import { useInstrumentStore } from '@/stores/instrumentStore';
import { getPredefinedFilter } from '@/utils/extractors';

// Create an instance of the store to make its state available to the template.
const instrumentStore = useInstrumentStore();

watch(() => instrumentStore.selectedInstrument, (newInstrument) => {
    // 2. Call the main data fetching function for this view
    fetchConfigurations(newInstrument);
});

// --- Types and Interfaces ---
interface Configuration {
  id: number;
  name: string;
  createdAt: string;
  settings: object;
  highPriority: boolean;
}

// --- Component State ---
const isSaving = ref(false);
const savedConfigurations = ref<Configuration[]>([]);
const snackbar = reactive({ show: false, message: '', color: 'success' });

// --- Static Data for Form Controls ---
const sheetNameOptions = ['5M', '10M', '15M', '30M', '1H'];
const setupOptions = ['S1', 'S2', 'S3'];
const sessionOptions = ['ASIA', 'PREFRANKFURT', 'FRANKFURT', 'LONDON', 'LUNCHBREAK', 'NEWYORK', 'UNKNOWN'];

const getDefaultFormState = () => ({
  id: null as number | null, // To track which config is being edited
  name: '',
  dataSheetName: '5M',
  minTradeCount: 50,
  maxCombinationsToTest: 20000000,
  predefinedFilters: {
    setup: 'S1',
    session: null,
    entryCandleHasWick: false,
    setupCandleHasWick: false,
    entryDistanceMax: 0,
    breakoutDistanceMax: 0,
    timeMin: '08:00',
    timeMax: '12:00',
    candleSize: {
      min: 1,
      max: 2
    }
  },
  rankingWeights: {
    profitFactor: 0.40,
    winRate: 0.30,
    tradeCount: 0.15,
    netProfitPips: 0.15,
  },
  minSLToTPRatio: 0.3,
  maxTPToSLRatio: 2,
  minProfitFactor: 1.5,
  minWinRate: 60,
  enableTimeShift: false,
  // Use a reactive array of objects for easier v-for binding
  combinations: ref([
    { name: 'Gaussian', enabled: false },
    { name: 'Gaussian 4', enabled: false },
    { name: 'Candle Closed', enabled: true },
    { name: 'Candle Open', enabled: false },
    { name: 'Candle Size Min Max', enabled: true },
    { name: 'Entry Candle Has Wick', enabled: false },
    { name: 'Setup Candle Has Wick', enabled: false },
    { name: 'Breakout Distance Max', enabled: true },
    { name: 'Entry Distance Max', enabled: true },
    { name: 'Breakout Candle Count Max', enabled: false },
    { name: 'Closed In LTA', enabled: true },
    {name: 'S2 Pullback Distance Max', enabled: false},
    {name: 'S3 Reversal Candle Size Min Max', enabled: false},
    {name: 'News', enabled: false},
    {name: 'Market Open', enabled: false}
  ])
});



// --- The Master Form State Object ---
const formState = reactive(getDefaultFormState());
const isEditing = computed(() => formState.id !== null);
// --- Methods ---
const showSnackbar = (message: string, color: string = 'success') => {
  snackbar.message = message;
  snackbar.color = color;
  snackbar.show = true;
};

const fetchConfigurations = async (intrument: string) => {
  try {
    const response = await api.getConfigurations(intrument);
    savedConfigurations.value = response.data.map((c: any) => ({...c, highPriority:false}));
  } catch (error) {
    console.error(error);
    showSnackbar("Could not load saved configurations.", "error");
  }
};

const buildSettingsPayload = () => {
  const settings = {
    dataSheetName: formState.dataSheetName,
    minTradeCount: formState.minTradeCount,
    enableTimeShift: formState.enableTimeShift,
    maxCombinationsToTest: formState.maxCombinationsToTest,
    rankingWeights: { ...formState.rankingWeights },
    
    // Transform selected combinations into an array of names
    combinationsToTest: formState.combinations.filter(c => c.enabled).map(c => c.name),

    // Transform form filters into the array structure the script expects
    predefinedFilters: [] as any[],
    minSLToTPRatio: formState.minSLToTPRatio,
    maxTPToSLRatio: formState.maxTPToSLRatio,
    minProfitFactor: formState.minProfitFactor,
    minWinRate: formState.minWinRate,
  };

  // --- Logic to build the predefinedFilters array ---
  const filters = formState.predefinedFilters;
  if (filters.setup) {
    settings.predefinedFilters.push({ columnHeader: 'Setup', type: 'exact', condition: filters.setup });
  }
  if (filters.session) {
    settings.predefinedFilters.push({ columnHeader: 'Session', type: 'exact', condition: filters.session });
  }
  if (filters.entryCandleHasWick) {
    settings.predefinedFilters.push({ columnHeader: 'Entry Candle Has Wick', type: 'exact', condition: true });
  }
  if (filters.setupCandleHasWick) {
    settings.predefinedFilters.push({ columnHeader: 'Setup Candle Has Wick', type: 'exact', condition: true });
  }
  if (filters.timeMin || filters.timeMax) {
      settings.predefinedFilters.push({
          columnHeader: 'Time',
          type: 'timeRange',
          condition: {
              minMinutes: filters.timeMin || undefined,
              maxMinutes: filters.timeMax || undefined
          }
      });
  }
  
  return settings;
};

const startEdit = (configToEdit: any) => {
  formState.id = configToEdit.id;
  formState.name = configToEdit.name;

  // Deconstruct the saved settings object to populate the form
  const settings = configToEdit.settings;
  formState.enableTimeShift = settings.enableTimeShift || false;
  formState.dataSheetName = settings.dataSheetName || '5M';
  formState.minTradeCount = settings.minTradeCount || 5;
  formState.maxCombinationsToTest = settings.maxCombinationsToTest || 100000;
  formState.rankingWeights = { ...settings.rankingWeights };
  formState.minProfitFactor = settings.minProfitFactor;
  formState.minWinRate = settings.minWinRate;
  formState.minSLToTPRatio = settings.minSLToTPRatio;
  formState.maxTPToSLRatio = settings.maxTPToSLRatio;

  // Re-populate predefined filters
  const pf = settings.predefinedFilters || [];
  formState.predefinedFilters.setup = pf.find((f:any) => f.columnHeader === 'Setup')?.condition || 'S1';
  formState.predefinedFilters.session = pf.find((f:any) => f.columnHeader === 'Session')?.condition || null;
  formState.predefinedFilters.entryCandleHasWick = pf.some((f:any) => f.columnHeader === 'Entry Candle Has Wick');
  formState.predefinedFilters.setupCandleHasWick = pf.some((f:any) => f.columnHeader === 'Setup Candle Has Wick');
  const timeFilter = pf.find((f:any) => f.type === 'timeRange');
  formState.predefinedFilters.timeMin = timeFilter?.condition.minMinutes || '';
  formState.predefinedFilters.timeMax = timeFilter?.condition.maxMinutes || '';

  // Re-populate checkboxes
  const enabledCombos = settings.combinationsToTest || [];
  formState.combinations.forEach(combo => {
    combo.enabled = enabledCombos.includes(combo.name);
  });
};

const cancelEdit = () => {
  Object.assign(formState, getDefaultFormState());
};

// NEW: Confirmation for delete
const confirmDelete = async (configToDelete: any) => {
    if (confirm(`Are you sure you want to delete the configuration "${configToDelete.name}"? This cannot be undone.`)) {
        try {
            await api.deleteConfiguration(configToDelete.id);
            showSnackbar("Configuration deleted successfully.", "success");
            await fetchConfigurations(instrumentStore.selectedInstrument); // Refresh the list
        } catch (error) {
            showSnackbar("Failed to delete configuration.", "error");
        }
    }
};



// MODIFIED: Save function now handles both create and update
const saveConfig = async () => {
  if (!formState.name) {
    showSnackbar("Please enter a name for the configuration.", "error");
    return;
  }
  isSaving.value = true;
  const settingsPayload = buildSettingsPayload();
  const payload = { name: formState.name, settings: settingsPayload };

  try {
    if (isEditing.value) {
      // UPDATE existing config
      await api.updateConfiguration(formState.id!, payload);
      showSnackbar("Configuration updated successfully!", "success");
    } else {
      // CREATE new config
      await api.saveConfiguration(instrumentStore.selectedInstrument, payload);
      showSnackbar("Configuration saved successfully!", "success");
    }
    cancelEdit(); // Reset form after successful save/update
    await fetchConfigurations(instrumentStore.selectedInstrument); // Refresh the list
  } catch (error: any) {
    showSnackbar(error.response?.data?.message || "Failed to save configuration.", "error");
  } finally {
    isSaving.value = false;
  }
};

const runOptimization = async (configId: number, highPriority: boolean) => {
  showSnackbar(`Queuing optimization job for config ID: ${configId}`, "info");
  try {
    await api.runOptimization(configId, highPriority);
    showSnackbar("Job successfully queued! The worker will now process it.", "success");
  } catch (error: any) {
    showSnackbar(error.response?.data?.message || "Failed to queue job.", "error");
  }
};

const rules = {
    required: (value: any) => !!value || 'Field is required',
  }

// --- Lifecycle Hooks ---
onMounted(() => {
  fetchConfigurations(instrumentStore.selectedInstrument);
});
</script>