<template>
  <v-container>
    <!-- Header -->
    <v-row>
      <v-col>
        <h1>Optimization History</h1>
        <p>A list of all completed optimization runs. Click to expand for a summary of top results.</p>
      </v-col>
    </v-row>

    <!-- Main Content -->
    <v-row>
      <v-col>
        <div v-if="history.length === 0">
          <v-alert type="info" prominent>No history found.</v-alert>
        </div>
        
        <v-expansion-panels v-else @update:model-value="val => handlePanelChange(val as number | undefined)">
          <v-expansion-panel v-for="run in history" :key="run.id" :value="run.id">
            <v-expansion-panel-title>
             
              <div class="panel-title-grid">
                <!-- Column 1: Main Name & Timestamps -->
                <div class="font-weight-bold">{{ run.configuration.name }}</div>
                <div class="text-caption text-medium-emphasis">
                  {{ formatRunTimes(run.startedAt, run.completedAt) }}
                </div>
                
                <!-- Column 2: Predefined Filters Summary -->
                <div class="text-caption">
                  <v-chip label color="blue" v-if="getPredefinedFilter(run, 'Setup')" size="small" class="mr-1">{{ getPredefinedFilter(run, 'Setup') }}</v-chip>
                  <v-chip label color="blue" v-if="getPredefinedTime(run)" size="small" class="mr-1">{{ getPredefinedTime(run) }}</v-chip>
                </div>

                <!-- Column 3: Tested Combinations Summary -->
                 <div class="text-caption">
                  <v-tooltip location="bottom">
                    <template v-slot:activator="{ props }">
                      <span v-bind="props">Tested: {{ run.configuration.settings.combinationsToTest.join(",") }} combinations</span>
                    </template>
                    <!-- Tooltip content showing the full list -->
                    <div v-for="combo in run.configuration.settings.combinationsToTest" :key="combo">
                      {{ combo }}
                    </div>
                  </v-tooltip>
                </div>
              </div>
               <v-btn
                    variant="tonal"
                    size="small"
                    color="error"
                    style="margin-right:20px;"
                    @click.stop="confirmDelete(run)"
                  >Delete</v-btn> 
            </v-expansion-panel-title>

            <v-expansion-panel-text>
              <div v-if="loadingDetails.has(run.id)" class="text-center pa-4">
                <v-progress-circular indeterminate color="primary"></v-progress-circular>
              </div>

              <div v-else-if="detailedResults[run.id]">
                <v-btn color="info" variant="tonal" :to="`/results/${run.id}`" class="mb-4">View Full Results Grid</v-btn>
                
                <div v-for="(top5, strategyName) in topResultsByStrategy[run.id]" :key="strategyName">
                  <v-divider class="my-3"></v-divider>
                  <h3 class="text-h6 mb-2">{{ strategyName }}</h3>
                  <v-table density="compact">
                    <thead>
                      <tr>
                        <th class="text-left">Rank</th>
                        <th class="text-left">Score</th>
                        <th class="text-left">Win Rate</th>
                        <th class="text-left">Profit Factor</th>
                        <th class="text-left">Net Profit</th>
                        <th class="text-left">Trades</th>
                        <th class="text-left">Combo Count</th>
                        <th class="text-left">Time</th>
                        <th class="text-left">Combination</th>
                        <th class="text-left" style="width: 170px;">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(item, index) in top5" :key="index">
                        <td>{{ index + 1 }}</td>
                        <!-- This 'item' is a full result object. We access its metrics for the specific strategy -->
                        <td><strong>{{ item.strategyScores[strategyName]?.toFixed(3) }}</strong></td>
                        <td>{{ (item.metrics[strategyName]?.winRate * 100).toFixed(1) }}%</td>
                        <td>{{ typeof item.metrics[strategyName]?.profitFactor === 'number' ? item.metrics[strategyName]?.profitFactor.toFixed(2) : '∞' }}</td>
                        <td>{{ item.metrics[strategyName]?.netProfit?.toFixed(2) }}</td>
                        <td>{{ item.metrics[strategyName]?.totalTradesThisStrategy }}</td>
                        <td>{{ Object.keys(item.combination).length }}</td>
                        <td>{{ extractTime(run, item) }}</td>
                        <td><small>{{ JSON.stringify(item.combination) }}</small></td>
                        <td>
                          <!-- Action Buttons -->
                          <v-btn
                            size="small"
                            variant="tonal"
                            color="success"
                            @click="archiveStrategy(item, run.configuration.id, strategyName)"
                            :loading="isArchiving(run.id, strategyName)"
                            class="mr-2"
                          >
                            Save
                          </v-btn>
                          <v-btn variant="tonal" size="small" color="primary" @click="applyAndGo(item, run.configuration)">Apply</v-btn>
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                </div>
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-col>
    </v-row>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="3000">
      {{ snackbar.message }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, watch } from 'vue';
import api from '@/services/api';
import { useRouter } from 'vue-router';
import { useFilterStore } from '@/stores/filterStore';
import { getTopResultsByStrategy } from '@/utils/resultProcessor';
import { mdiDeleteOutline } from '@mdi/js';
import { useInstrumentStore } from '@/stores/instrumentStore';

// Create an instance of the store to make its state available to the template.
const instrumentStore = useInstrumentStore();

watch(() => instrumentStore.selectedInstrument, (newInstrument) => {
    // 2. Call the main data fetching function for this view
    fetchHistoryList(newInstrument);
});

// --- State Definitions ---
interface HistoryRun {
  id: number;
  completedAt: string;
  startedAt: string;
  configuration: {
    id: number;
    name: string;
    settings: any;
  };
}

const history = ref<HistoryRun[]>([]);
const detailedResults = reactive<{[key: number]: any}>({});
const topResultsByStrategy = reactive<{[key: number]: any}>({});
const loadingDetails = ref(new Set<number>());
const snackbar = reactive({ show: false, message: '', color: 'success' });
const archivingStatus = ref(new Set<string>());

const router = useRouter();
const filterStore = useFilterStore();

// --- Methods ---
const showSnackbar = (message: string, color: string = 'success') => {
  snackbar.message = message;
  snackbar.color = color;
  snackbar.show = true;
};

// --- CORE FIX 1: Use a correct and consistent unique ID ---
// The unique ID for a loading state is the parent run's ID plus the strategy name.
const isArchiving = (runId: number, strategyName: any): boolean => {
    const uniqueId = `${runId}-${strategyName}`;
    return archivingStatus.value.has(uniqueId);
};

const handlePanelChange = async (val: unknown) => {
  const panelId = val as number | undefined;
  if (panelId === undefined || detailedResults[panelId] || loadingDetails.value.has(panelId)) {
    return;
  }
  try {
    loadingDetails.value.add(panelId);
    const response = await api.getResultDetails(instrumentStore.selectedInstrument, panelId);
    const data = response.data;
    if (typeof data.results === 'string') {
        data.results = JSON.parse(data.results);
    }
    detailedResults[panelId] = data;
    topResultsByStrategy[panelId] = getTopResultsByStrategy(data.results);
  } catch (error) {
    console.error(`Failed to fetch details for run ${panelId}:`, error);
  } finally {
    loadingDetails.value.delete(panelId);
  }
};

// --- CORE FIX 2: Use the correct unique ID for setting the loading state ---
const archiveStrategy = async (resultItem: any, configId: number, strategyName: any) => {
  // Use the same ID generation logic as the isArchiving function.
  // Note: This means all "Save" buttons in one strategy's table will show a spinner. This is acceptable.
  const uniqueId = `${configId}-${strategyName}`;
  archivingStatus.value.add(uniqueId);

  try {
    await api.saveToArchive(instrumentStore.selectedInstrument, {
      configurationId: configId,
      resultData: resultItem,
      strategyName: strategyName,
    });
    showSnackbar(`Strategy '${strategyName}' from config ${configId} archived!`, 'success');
  } catch (error) {
    showSnackbar('Failed to archive strategy.', 'error');
    console.error(error);
  } finally {
    archivingStatus.value.delete(uniqueId); // Clear loading state using the same ID.
  }
};

const applyAndGo = (resultItem: any, configuration: any) => {
  filterStore.setFiltersAndNavigate(resultItem, configuration, router);
};

const fetchHistoryList = async (instrument: string) => {
  try {
    const response = await api.getResultList(instrument);
    history.value = response.data;
  } catch (error) {
    console.error("Failed to fetch history:", error);
  }
};

function formatRunTimes(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  
  const durationMs = endDate.getTime() - startDate.getTime();
  const durationSec = Math.round(durationMs / 1000);
  const durationMin = Math.floor(durationSec / 60);

  const formattedStart = startDate.toLocaleString();

  if (durationSec < 60) {
    return `Ran for ${durationSec}s (Started: ${formattedStart})`;
  }
  return `Ran for ${durationMin}m ${durationSec % 60}s (Started: ${formattedStart})`;
}

function getPredefinedFilter(run: HistoryRun, filterName: 'Setup' | 'Session'): string | null {
    const filters = run.configuration.settings?.predefinedFilters || [];
    const found = filters.find((f: any) => f.columnHeader === filterName);
    return found ? found.condition : null;
}

function getPredefinedTime(run: HistoryRun): string | null {
    const filters = run.configuration.settings?.predefinedFilters || [];
    const found = filters.find((f: any) => f.type === 'timeRange');
    if (!found) return null;

    const { minMinutes, maxMinutes } = found.condition;
    if (minMinutes && maxMinutes) return `${minMinutes} - ${maxMinutes}`;
    if (minMinutes) return `After ${minMinutes}`;
    if (maxMinutes) return `Before ${maxMinutes}`;
    return null;
}

function convertMinutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const paddedHours = String(hours).padStart(2, '0');
  const paddedMinutes = String(minutes).padStart(2, '0');

  return `${paddedHours}:${paddedMinutes}`;
}

function extractTime(run: any, item: any) {
    //console.log(run, item);
    const timeFilter = item.combination?.TimeFilter;
    if (timeFilter) {
      //h := minutes / 60
	    //m := minutes % 60
	    //return fmt.Sprintf("%02d:%02d", h, m)
      return `${convertMinutesToTime(timeFilter.minMinutes)} - ${convertMinutesToTime(timeFilter.maxMinutes)}`;
    } 
    const filters = run.configuration.settings?.predefinedFilters || [];
    const found = filters.find((f: any) => f.type === 'timeRange');
    if (found) {
      return `${found.condition.minMinutes} - ${found.condition.maxMinutes}`;
    }
    return "No Time"
}

async function confirmDelete(runToDelete: HistoryRun) {
    if (confirm(`Are you sure you want to permanently delete the history for "${runToDelete.configuration.name}"? This cannot be undone.`)) {
        try {
            await api.deleteResult(runToDelete.id);
            showSnackbar("History entry deleted successfully.", "success");
            // Remove the item from the local array for instant UI feedback
            history.value = history.value.filter(run => run.id !== runToDelete.id);
        } catch (error) {
            showSnackbar("Failed to delete history entry.", "error");
            console.error(error);
        }
    }
}

onMounted(() => {
  fetchHistoryList(instrumentStore.selectedInstrument);
});
</script>

<style scoped>
.v-expansion-panel-text__wrapper {
  padding: 16px 24px 24px;
}

.panel-title-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr; /* Adjust column ratios as needed */
  width: 100%;
  align-items: center;
  gap: 1px;
}
</style>