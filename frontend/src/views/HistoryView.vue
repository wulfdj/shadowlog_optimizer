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
        
        <v-expansion-panels v-else @update:model-value="handlePanelChange">
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
                  <v-chip v-if="getPredefinedFilter(run, 'Setup')" size="x-small" class="mr-1">{{ getPredefinedFilter(run, 'Setup') }}</v-chip>
                  <v-chip v-if="getPredefinedFilter(run, 'Session')" size="x-small" class="mr-1">{{ getPredefinedFilter(run, 'Session') }}</v-chip>
                  <v-chip v-if="getPredefinedTime(run)" size="x-small" class="mr-1">{{ getPredefinedTime(run) }}</v-chip>
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
                        <td><small>{{ JSON.stringify(item.combination) }}</small></td>
                        <td>
                          <!-- Action Buttons -->
                          <v-btn size="x-small" color="amber-darken-1" @click="openArchiveDialog(item, run.id)" class="mr-2">Save</v-btn>
                          <v-btn size="x-small" color="deep-purple-lighten-1" @click="applyAndGo(item, run.configuration)">Apply</v-btn>
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

    <!-- Archive Dialog -->
    <v-dialog v-model="archiveDialog.show" persistent width="500">
      <v-card>
        <v-card-title><span class="headline">Save Strategy to History</span></v-card-title>
        <v-card-text>
          <v-text-field v-model="archiveDialog.name" label="Strategy Name" autofocus></v-text-field>
          <v-textarea v-model="archiveDialog.notes" label="Notes (Optional)" rows="2"></v-textarea>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text @click="archiveDialog.show = false">Cancel</v-btn>
          <v-btn text color="primary" @click="archiveStrategy" :loading="archiveDialog.isSaving">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="3000">
      {{ snackbar.message }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import api from '@/services/api';
import { useRouter } from 'vue-router';
import { useFilterStore } from '@/stores/filterStore';
import { getTopResultsByStrategy } from '@/utils/resultProcessor'; // Import the refactored utility

// --- State Definitions ---
interface HistoryRun {
  id: number;
  completedAt: string;
  configuration: {
    id: number;
    name: string;
  };
}

const history = ref<HistoryRun[]>([]);
const detailedResults = reactive<{[key: number]: any}>({});
const topResultsByStrategy = reactive<{[key: number]: any}>({});
const loadingDetails = ref(new Set<number>());
const snackbar = reactive({ show: false, message: '', color: 'success' });

const archiveDialog = reactive({
  show: false,
  isSaving: false,
  name: '',
  notes: '',
  dataToSave: null as any | null,
});

const router = useRouter();
const filterStore = useFilterStore();

// --- Methods ---
const showSnackbar = (message: string, color: string = 'success') => {
  snackbar.message = message;
  snackbar.color = color;
  snackbar.show = true;
};

const handlePanelChange = async (panelId: number | undefined) => {
  if (panelId === undefined || detailedResults[panelId] || loadingDetails.value.has(panelId)) {
    return;
  }
  try {
    loadingDetails.value.add(panelId);
    const response = await api.getResultDetails(panelId);
    const data = response.data;
    if (typeof data.results === 'string') {
        data.results = JSON.parse(data.results);
    }
    detailedResults[panelId] = data;
    // Process the data and store it for the template
    topResultsByStrategy[panelId] = getTopResultsByStrategy(data.results);
  } catch (error) {
    console.error(`Failed to fetch details for run ${panelId}:`, error);
  } finally {
    loadingDetails.value.delete(panelId);
  }
};

const openArchiveDialog = (item: any, runId: number) => {
  archiveDialog.dataToSave = { item, runId }; // Store item and its parent runId
  archiveDialog.name = '';
  archiveDialog.notes = '';
  archiveDialog.show = true;
};


const archiveStrategy = async () => {
  if (!archiveDialog.name || !archiveDialog.dataToSave) return;
  
  // Find the parent run configuration for the item being saved
  const runId = archiveDialog.dataToSave.runId; // We need to add runId to the data
  const parentRun = detailedResults[runId];
  if (!parentRun) {
      showSnackbar('Could not find parent configuration for this result.', 'error');
      return;
  }

  archiveDialog.isSaving = true;
  try {
    await api.saveToArchive({
      name: archiveDialog.name,
      notes: archiveDialog.notes,
      resultData: archiveDialog.dataToSave.item,
      // --- NEW: Send the full parent configuration object ---
      configurationData: parentRun.configuration,
    });
    showSnackbar(`Strategy '${archiveDialog.name}' saved successfully!`, 'success');
    archiveDialog.show = false;
  } catch (error) {
    showSnackbar('Failed to save strategy.', 'error');
  } finally {
    archiveDialog.isSaving = false;
  }
};

const applyAndGo = (resultItem: any, configuration: any) => {
  filterStore.setFiltersAndNavigate(resultItem, configuration, router);
};

const fetchHistoryList = async () => {
  try {
    const response = await api.getResultList();
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

onMounted(fetchHistoryList);
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
  gap: 16px;
}
</style>