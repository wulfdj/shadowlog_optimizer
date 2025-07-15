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
            {{ item.name }}
          </v-card-title>
          <v-card-subtitle>Archived on: {{ new Date(item.archivedAt).toLocaleString() }}</v-card-subtitle>
          
          <v-card-text>
            <p v-if="item.notes" class="font-italic mb-4">"{{ item.notes }}"</p>
            
            <!-- Key Performance Indicators -->
            <div class="kpi-grid mb-4">
              <div>
                <div class="text-caption">Overall Score</div>
                <div class="text-h6">{{ item.resultData.overallScore.toFixed(3) }}</div>
              </div>
              <div>
                <div class="text-caption">Best Win Rate</div>
                <div class="text-h6">{{ getBestMetric(item.resultData, 'winRate', true) }}</div>
              </div>
              <div>
                <div class="text-caption">Best Profit Factor</div>
                <div class="text-h6">{{ getBestMetric(item.resultData, 'profitFactor') }}</div>
              </div>
              <div>
                <div class="text-caption">Total Trades</div>
                <div class="text-h6">{{ item.resultData.overallTradeCount }}</div>
              </div>
            </div>

            <v-divider></v-divider>

            <!-- Configuration Details -->
            <v-expansion-panels>
              <v-expansion-panel>
                <v-expansion-panel-title>Configuration Used</v-expansion-panel-title>
                <v-expansion-panel-text>
            <div class="mt-4">
              <v-row dense>
                <v-col cols="12" sm="6">
                  <strong>Timeframe:</strong> {{ item.configurationData.settings.dataSheetName }}
                </v-col>
                 <v-col cols="12" sm="6">
                  <strong>Min Trades:</strong> {{ item.configurationData.settings.minTradeCount }}
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
              icon="mdi-delete-outline"
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
import { mdiStar } from '@mdi/js';
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