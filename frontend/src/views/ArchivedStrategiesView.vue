<template>
  <v-container>
    <v-row>
      <v-col>
        <h1>Archived Strategies</h1>
        <p>A hand-picked list of your best-performing, long-term strategies with full context.</p>
      </v-col>
    </v-row>

    <v-row v-if="archivedResults.length === 0">
      <v-col>
        <v-alert type="info">No archived strategies yet. Go to the Results page and save one to get started.</v-alert>
      </v-col>
    </v-row>

    <!-- Detailed Strategy Cards -->
    <v-row v-else>
      <v-col v-for="item in archivedResults" :key="item.id" cols="12" md="6">
        <v-card class="fill-height">
          <v-card-title class="d-flex align-center">
            <v-icon color="amber" class="mr-2" :icon="mdiStar"></v-icon>
            {{ item.configuration.name }}
          </v-card-title>
          <v-card-subtitle>Archived on: {{ new Date(item.archivedAt).toLocaleString() }}  Strategy: <v-chip size="small" color="blue-grey" class="ml-1">{{ item.strategyName }}</v-chip></v-card-subtitle>
          
          <v-card-text>
            <p v-if="item.notes" class="font-italic mb-4">"{{ item.notes }}"</p>
            
            <!-- Key Performance Indicators -->
            <div class="kpi-grid mb-4">
              <div>
                <div class="text-caption">Strategy Score</div>
                <div class="text-h6">{{ getMetric(item, 'score') || 'N/A' }}</div>
              </div>
              <div>
                <div class="text-caption">Win Rate</div>
                <div class="text-h6">{{ getMetric(item, 'winRate', true) || 'N/A' }}</div>
              </div>
              <div>
                <div class="text-caption">Profit Factor</div>
                <div class="text-h6">{{ getMetric(item, 'profitFactor') || 'N/A' }}</div>
              </div>
              <div>
                <div class="text-caption">Trades</div>
                <div class="text-h6">{{ getMetric(item, 'totalTradesThisStrategy') || 'N/A' }}</div>
              </div>
            </div>

            <v-divider></v-divider>
            <div class="mt-2">
              <strong>Time Settings:</strong> {{ getPredefinedTime(item.configuration) || 'Any' }}
              <br/>
              <strong>Setup:</strong> {{ getPredefinedFilter(item.configuration, 'Setup') || 'Any' }}
            </div>
            <!-- Configuration Details -->
            <v-expansion-panels>
              <v-expansion-panel>
                <v-expansion-panel-title>Configuration Used</v-expansion-panel-title>
                <v-expansion-panel-text>
            <div class="mt-4">
              <v-row dense>
                <v-col cols="6" sm="6">
                  <strong>Timeframe:</strong> {{ item.configurationData.settings.dataSheetName }}
                </v-col>
                 <v-col cols="6" sm="6">
                  <strong>Min Trades:</strong> {{ item.configurationData.settings.minTradeCount }}
                </v-col>
                <v-col cols="6" sm="6">
                  <strong>Min SL Ratio:</strong> {{ item.configurationData.settings.minSLToTPRatio }}
                </v-col>
                <v-col cols="6" sm="6">
                  <strong>Max TP Ratio:</strong> {{ item.configurationData.settings.maxTPToSLRatio }}
                </v-col>
              </v-row>
              
              <div class="mt-2">
                <strong>Predefined Filters:</strong>
                <pre><code>{{ JSON.stringify(item.configurationData.settings.predefinedFilters, null, 2) }}</code></pre>
              </div>

              <div class="mt-2">
                <strong>Winning Combination:</strong>
                <pre><code>{{ JSON.stringify(item.resultData.combination, null, 2) }}</code></pre>
              </div>
            </div>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-card-text>

          <v-card-actions>
            <v-btn
              :icon="mdiDeleteOutline"
              variant="text"
              color="grey"
              @click="confirmDelete(item)"
              title="Delete this archived strategy"
            ></v-btn>
            <v-spacer></v-spacer>
            <v-btn color="deep-purple-lighten-1" @click="applyAndGo(item)">Apply & View Trades</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
     <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="3000">
        {{ snackbar.message }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { mdiStar, mdiDeleteOutline } from '@mdi/js';
import { ref, onMounted, reactive } from 'vue';
import api from '@/services/api';
import { useFilterStore } from '@/stores/filterStore';
import { useRouter } from 'vue-router';

interface ArchivedItem {
  id: number;
  name: string;
  notes?: string;
  archivedAt: string;
  resultData: any;
  configurationData: any;
  strategyName?: string;
  configuration: any;
}

const archivedResults = ref<ArchivedItem[]>([]);
const filterStore = useFilterStore();
const router = useRouter();
const snackbar = reactive({show: false, message: '', color: 'success'});

const showSnackbar = (message: string, color: string = 'success') => {
  snackbar.message = message;
  snackbar.color = color;
  snackbar.show = true;
};

// These are the same helpers we created for HistoryView, now reused here.
function getPredefinedFilter(config: any, filterName: 'Setup' | 'Session'): string | null {
    const filters = config.settings?.predefinedFilters || [];
    const found = filters.find((f: any) => f.columnHeader === filterName);
    return found ? found.condition : null;
}

function getPredefinedTime(config: any): string | null {
    const filters = config.settings?.predefinedFilters || [];
    const found = filters.find((f: any) => f.type === 'timeRange');
    if (!found) return null;

    const { minMinutes, maxMinutes } = found.condition;
    if (minMinutes && maxMinutes) return `${minMinutes} - ${maxMinutes}`;
    if (minMinutes) return `After ${minMinutes}`;
    if (maxMinutes) return `Before ${maxMinutes}`;
    return null;
}

function getMetric(item: ArchivedItem, metricKey: string, asPercent: boolean = false): string | number | undefined {
  const strategyName = item.strategyName;
  if (!strategyName) return 'N/A'; // No strategy context

  let metric: any;
  if (metricKey === 'score') {
    metric = item.resultData?.strategyScores?.[strategyName];
  } else {
    metric = item.resultData?.metrics?.[strategyName]?.[metricKey];
  }

  console.log("metric for: " + strategyName +", as percent: " + asPercent + ", type: " + (typeof metric), metric);
  if (metric === undefined || metric === null) return 'N/A';
  if (metric === Infinity) return '∞';
  if (typeof metric !== 'number') return metric;

  if (typeof metric === 'number' && metric % 1 === 0) return metric;

  if (asPercent) return `${(metric * 100).toFixed(1)}%`;
  return Number(metric).toFixed(2);
}

async function fetchArchived() {
    try {
        const response = await api.getArchivedResults();
        archivedResults.value = response.data;
        console.log("Archived result: ", archivedResults.value);
    } catch (error) {
        console.error("Failed to fetch archived results:", error);
    }
}

async function confirmDelete(itemToDelete: ArchivedItem) {
    if (confirm(`Are you sure you want to permanently delete the strategy "${itemToDelete.name}"?`)) {
        try {
            await api.deleteArchivedResult(itemToDelete.id);
            showSnackbar("Strategy deleted successfully.", "success");
            // Remove the item from the local array for instant UI feedback
            archivedResults.value = archivedResults.value.filter(item => item.id !== itemToDelete.id);
        } catch (error) {
            showSnackbar("Failed to delete strategy.", "error");
            console.error(error);
        }
    }
}


// Helper to extract the best value for a given metric from all strategies in a result
function getBestMetric(resultData: any, metricKey: 'winRate' | 'profitFactor', asPercent: boolean = false): string {
  if (!resultData || !resultData.metrics) return 'N/A';
  let bestValue = 0;
  let hasInfinity = false;

  for (const key in resultData.metrics) {
    const metric = resultData.metrics[key][metricKey];
    if (metric === Infinity) {
      hasInfinity = true;
      break;
    }
    if (typeof metric === 'number' && metric > bestValue) {
      bestValue = metric;
    }
  }

  if (hasInfinity) return '∞';
  if (asPercent) return `${(bestValue * 100).toFixed(1)}%`;
  return bestValue.toFixed(2);
}

function applyAndGo(archivedItem: ArchivedItem) {
    filterStore.setFiltersAndNavigate(
        archivedItem.resultData,
        archivedItem.configurationData,
        router
    );
}

onMounted(fetchArchived);
</script>

<style scoped>
pre {
  background-color: #2d2d2d;
  color: #f8f8f2;
  padding: 0.75rem;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 150px;
  overflow-y: auto;
  font-size: 0.8rem;
}

.kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
}
</style>