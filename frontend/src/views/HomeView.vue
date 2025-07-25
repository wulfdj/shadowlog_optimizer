<template>
  <v-container width="100%">
<!-- Section 0: IN-PROGRESS JOBS (Now with more details) -->
<template v-if="activeJobs.length > 0">
    <v-row>
      <v-col>
        <h2 class="text-h5 mb-2 text-blue">In Progress</h2>
      </v-col>
    </v-row>
    <v-row>
        <v-col v-for="job in activeJobs" :key="job.id" cols="12" md="4">
            <v-card border>
              <v-card-title class="d-flex justify-space-between align-center">
                <span class="text-subtitle-1">{{ job.instrument }} - {{ job.name }}</span>
                
              </v-card-title>
              <v-card-subtitle>
                Started: {{ formatTimeAgo(job.startedAt) }}
              </v-card-subtitle>
              <v-card-text>
                <v-progress-linear
                    v-model="job.progress"
                    color="blue-lighten-1"
                    height="20"
                    class="my-2"
                    striped
                >
                  <strong>{{ job.progress || 0 }}%</strong>
                </v-progress-linear>
                <div class="text-caption">
                  <!-- DYNAMIC TEXT -->
                      <span v-if="job.totalCombinations">
                        Processing {{ job.totalCombinations.toLocaleString() }} combinations...
                      </span>
                      <span v-else>
                        Calculating combinations...
                      </span>
                </div>
                <v-chip
                          :color="job.highPriority ? 'red' : 'grey'"
                          size="x-small"
                          class="mt-1"
                          label
                        >
                          {{ job.highPriority ? 'All Cores' : 'Half Cores' }}
                        </v-chip>
              </v-card-text>
              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn
                  color="red-lighten-1"
                  variant="tonal"
                  size="small"
                  @click="stopOptimizationJob(job.id)"
                  :loading="stoppingJobs.has(job.id)"
                >
                  Stop
                </v-btn>
              </v-card-actions>
            </v-card>
        </v-col>
    </v-row>
</template>

<template v-if="queuedJobs.length > 0">
        <v-row>
          <v-col>
            <h2 class="text-h5 mb-2 text-amber">Queued</h2>
          </v-col>
        </v-row>
        <v-row>
            <v-col v-for="(job, index) in queuedJobs" :key="job.id" cols="12" md="4">
                <v-card border variant="tonal">
                  <v-card-text>
                    <div class="d-flex justify-space-between align-center">
                      <div>
                        <div class="font-weight-medium">#{{ index + 1 }} in Queue: {{ job.data.configurationName }}</div>
                        <div class="font-weight-medium">Instrument: {{ job.data.instrument }}</div>
                        <v-chip
                          :color="job.data.highPriority ? 'red' : 'grey'"
                          size="x-small"
                          class="mt-1"
                          label
                        >
                          {{ job.data.highPriority ? 'All Cores' : 'Half Cores' }}
                        </v-chip>
                      </div>
                       <v-spacer></v-spacer>
                      <!-- NEW REMOVE BUTTON -->
                      <v-btn
                        color="error"
                        variant="tonal"
                        size="small"
                        @click="removeJobFromQueue(job.id)"
                        :loading="removingJobs.has(job.id)"
                      >
                        Remove
                      </v-btn>
                    </div>
                  </v-card-text>
                </v-card>
            </v-col>
        </v-row>
    </template>

    <!-- Section 1: Latest Optimization Runs -->
    <v-row>
      <v-col>
        <h2 class="text-h5 mb-2">Latest Optimization Runs</h2>
      </v-col>
    </v-row>
    <v-row v-if="loading.history">
        <v-col class="text-center"><v-progress-circular indeterminate></v-progress-circular></v-col>
    </v-row>
    <v-row v-else-if="latestRuns.length === 0">
        <v-col><v-alert type="info">No recent optimization runs found. Go to the Configuration page to start one.</v-alert></v-col>
    </v-row>
    <v-row v-else>
      <v-col v-for="run in latestRuns" :key="run.id" cols="12" md="6" lg="4">
        <v-card class="fill-height">
          <v-card-title>{{ run.configuration.name }}</v-card-title>
          <v-card-subtitle>{{ new Date(run.completedAt).toLocaleString() }}</v-card-subtitle>
          <v-card-text>
            <div v-if="run.bestResult">
              <p><strong>Best Overall Score: {{ run.bestResult.overallScore.toFixed(3) }}</strong></p>
              <v-chip size="small" label color="green" class="ma-2">Trades: {{ run.bestResult.overallTradeCount }}</v-chip>
              <v-chip label color="green" size="small">PF: {{ getBestProfitFactor(run.bestResult) }}</v-chip>
              <p class="text-caption mt-2 text-truncate">
                Best Combo: {{ JSON.stringify(run.bestResult.combination) }}
              </p>
            </div>
            <div v-else>
              <p>Run completed but no valid results were found.</p>
            </div>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn variant="tonal" color="primary" :to="`/results/${run.id}`">View Full Report</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <v-divider class="my-8"></v-divider>

    <!-- Section 2: Top Archived Strategies -->
    <v-row>
      <v-col>
        <h2 class="text-h5 mb-2">Top Archived Strategies</h2>
      </v-col>
    </v-row>
     <v-row v-if="loading.archive">
        <v-col class="text-center"><v-progress-circular indeterminate></v-progress-circular></v-col>
    </v-row>
    <v-row v-else-if="archivedStrategies.length === 0">
        <v-col><v-alert type="info">No strategies have been archived yet. Save your favorites from a results report.</v-alert></v-col>
    </v-row>
    <v-row v-else>
      <v-col v-for="item in archivedStrategies" :key="item.id" cols="12" md="6" lg="4">
        <v-card class="fill-height" color="surface-variant" variant="tonal">
          <v-card-title>{{ item.configuration.name }} - {{ item.strategyame }}</v-card-title>
          <v-card-subtitle>Archived: {{ new Date(item.archivedAt).toLocaleString() }}</v-card-subtitle>
          <v-card-text>
            <p><strong>Overall Score: {{ item.resultData.overallScore.toFixed(3) }}</strong></p>
            <v-chip label color="green" size="small" class="mr-2">Trades: {{ getMetric(item, "totalTradesThisStrategy") }}</v-chip>
            <v-chip label color="green" size="small">PF: {{ getMetric(item, "profitFactor") }}</v-chip>
            <v-chip label color="green" size="small">WR: {{ getMetric(item, "winRate", true) }}</v-chip>
            <p v-if="item.notes" class="text-body-2 mt-2 font-italic">Notes: "{{ item.notes }}"</p>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn variant="tonal" color="primary" @click="applyAndGo(item)">Apply Filter</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, reactive, watch } from 'vue';
import api from '@/services/api';
import { useFilterStore } from '@/stores/filterStore';
import { useRouter } from 'vue-router';
import { useInstrumentStore } from '@/stores/instrumentStore';

const instrumentStore = useInstrumentStore();

watch(() => instrumentStore.selectedInstrument, (newInstrument) => {
    // 2. Call the main data fetching function for this view
    fetchData(newInstrument);
});

const removingJobs = ref(new Set<string | number>());

// --- Add this new method in the Methods section ---
async function removeJobFromQueue(jobId: string | number) {
  if (!confirm(`Are you sure you want to remove Job ID ${jobId} from the queue?`)) return;

  removingJobs.value.add(jobId); // Set loading state for the button
  try {
    const response = await api.removeQueuedJob(jobId);
   
    // Manually remove it from the local array for instant UI feedback.
    // The next poll will confirm the state from the backend.
    queuedJobs.value = queuedJobs.value.filter(j => j.id !== jobId);
  } catch (error: any) {
    console.error(`Failed to remove job ${jobId}:`, error);
  } finally {
    removingJobs.value.delete(jobId); // Remove loading state
  }
}

// --- State ---
const latestRuns = ref<any[]>([]);
const archivedStrategies = ref<any[]>([]);
const activeJobs = ref<any[]>([]); // New state for in-progress jobs
const queuedJobs = ref<any[]>([]);
let pollingInterval: any; // To hold the interval ID

const loading = reactive({
    history: true,
    archive: true,
});
const filterStore = useFilterStore();
const router = useRouter();

// --- Methods ---
function formatTimeAgo(timestamp: number): string {
  if (!timestamp) return '...';
  
  const now = Date.now();
  const secondsPast = (now - timestamp) / 1000;

  if (secondsPast < 60) {
    return `${Math.round(secondsPast)} seconds ago`;
  }
  if (secondsPast < 3600) {
    return `${Math.round(secondsPast / 60)} minutes ago`;
  }
  // For longer times, just show the locale time
  return new Date(timestamp).toLocaleTimeString();
}

function getMetric(item: any, metricKey: string, asPercent: boolean = false): string | number | undefined {
  const strategyName = item.strategyName;
  if (!strategyName) return 'N/A'; // No strategy context

  let metric: any;
  if (metricKey === 'score') {
    metric = item.resultData?.strategyScores?.[strategyName];
  } else {
    metric = item.resultData?.metrics?.[strategyName]?.[metricKey];
  }

  //console.log("metric for: " + strategyName +", as percent: " + asPercent + ", type: " + (typeof metric), metric);
  if (metric === undefined || metric === null) return 'N/A';
  if (metric === Infinity) return '∞';
  if (typeof metric !== 'number') return metric;

  if (typeof metric === 'number' && metric % 1 === 0) return metric;

  if (asPercent) return `${(metric * 100).toFixed(1)}%`;
  return Number(metric).toFixed(2);
}
// Helper function to find the best profit factor from all strategies in a result
function getBestProfitFactor(result: any): string {
  if (!result || !result.metrics) return 'N/A';
  let bestPF = 0;
  for (const key in result.metrics) {
    const pf = result.metrics[key].profitFactor;
    if (pf === Infinity) return '∞';
    if (typeof pf === 'number' && pf > bestPF) {
      bestPF = pf;
    }
  }
  return bestPF.toFixed(2);
}

function applyAndGo(resultData: any) {
    console.log("resultData: ", resultData)
    // This assumes the configuration used is not needed for the filtered view,
    // which is the case for our current FilteredDataView.vue.
    // If it were needed, we'd have to store the config ID with the archive.
    filterStore.setFiltersAndNavigate(resultData.resultData, resultData.configuration, router, resultData.strategyName);
}

const stoppingJobs = ref(new Set<string | number>());

// --- Add this new method in the Methods section ---
async function stopOptimizationJob(jobId: string | number) {
  if (!confirm(`Are you sure you want to stop Job ID ${jobId}?`)) return;

  stoppingJobs.value.add(jobId); // Set loading state for the button
  try {
    const response = await api.stopJob(jobId);
    // The polling will automatically remove the job from the view,
    // so we just need to show a confirmation message.
    // You could create a new snackbar for this view if desired.
    console.log(response.data.message);
    // Manually remove it from the array for instant UI feedback
    activeJobs.value = activeJobs.value.filter(j => j.id !== jobId);
  } catch (error: any) {
    console.error(`Failed to stop job ${jobId}:`, error);
    alert(error.response?.data?.message || 'An error occurred.');
  } finally {
    stoppingJobs.value.delete(jobId); // Remove loading state
  }
}


// New function to poll for active jobs
async function pollActiveJobs() {
  try {
    const response = await api.getActiveJobs();
    activeJobs.value = response.data.active;
    queuedJobs.value = response.data.queued;

  } catch (error) {
    console.error("Polling for active jobs failed:", error);
    // Stop polling if there's an error to prevent spamming
    if (pollingInterval) clearInterval(pollingInterval);
  }
}

async function fetchData(instrument: string) {
  // Fetch latest runs (History)
  loading.history = true;
  try {
    const historyResponse = await api.getResultList(instrument);
    console.log("historyResponse", historyResponse.data);
    // We need to fetch details for each to get the best result
    const detailedRuns = await Promise.all(
        historyResponse.data.slice(0, 3).map((run: any) => api.getResultDetails(instrument, run.id))
    );
    latestRuns.value = detailedRuns.map(res => {
        const data = res.data;
        if (typeof data.results === 'string') {
            data.results = JSON.parse(data.results);
        }
        // Attach the best result to the run object
        data.bestResult = data.results?.[0];
        return data;
    });
    console.log("latestRuns: ", latestRuns);
  } catch (error) {
    console.error("Failed to fetch history details:", error);
  } finally {
    loading.history = false;
  }

  // Fetch archived strategies
  loading.archive = true;
  try {
    const archiveResponse = await api.getArchivedResults(instrument);
    // Also take the top 3 for the dashboard
    archivedStrategies.value = archiveResponse.data.slice(0, 3);
    console.log("archived strategies: ", archiveResponse.data);
  } catch (error) {
    console.error("Failed to fetch archived strategies:", error);
  } finally {
    loading.archive = false;
  }
}

// --- Lifecycle Hooks ---
onMounted(() => {
  console.log("Fetch for instrument: " + instrumentStore.selectedInstrument);
  fetchData(instrumentStore.selectedInstrument); // Fetch initial data for completed/archived
  
  // Start polling for active jobs immediately and then every 3 seconds
  pollActiveJobs();
  pollingInterval = setInterval(pollActiveJobs, 3000);
});

onUnmounted(() => {
  // IMPORTANT: Clear the interval when the component is destroyed
  // to prevent memory leaks.
  if (pollingInterval) clearInterval(pollingInterval);
});
</script>