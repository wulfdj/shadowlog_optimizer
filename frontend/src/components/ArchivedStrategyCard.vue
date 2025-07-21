<template>
    <v-card class="fill-height">
          <v-card-title class="d-flex align-center">
            <v-icon color="amber" class="mr-2" :icon="mdiStar"></v-icon>
            {{ item.configuration.name }}
          </v-card-title>
          <v-card-subtitle><v-chip label color="primary" variant="flat" class="ml-1">{{ item.strategyName }}</v-chip>   Archived on: {{ new Date(item.archivedAt).toLocaleString() }}  </v-card-subtitle>
          
          <v-card-text>
            <div class="mb-4">
              <v-chip
                  v-for="tag in item.tags"
                  :key="tag.id"
                  :color="tag.color"
                  size="small"
                  class="mr-2"
                  label
              >
                  {{ tag.name }}
              </v-chip>
              <span v-if="!item.tags || item.tags.length === 0" class="text-caption"></span>
          </div>

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
                <div class="text-caption">Net Profit</div>
                <div class="text-h6">{{ getMetric(item, 'netProfit') || 'N/A' }}</div>
              </div>
              <div>
                <div class="text-caption">Trades</div>
                <div class="text-h6">{{ getMetric(item, 'totalTradesThisStrategy') || 'N/A' }}</div>
              </div>
            </div>
           
            <div class="predefined-grid mb-4">
              <div><strong>Setup:</strong> <v-chip label size="small" color="blue">{{ getPredefinedFilter(item.configuration, 'Setup') || 'Any' }}</v-chip></div>
              <div><strong>Time Settings:</strong><v-chip label size="small" color="orange"> {{ getPredefinedTime(item.configuration) || 'Any' }}</v-chip></div>
              <div> <span v-if="getTimeRangeFromCombination(item) !== null"><strong>Actual Time: </strong> <v-chip label size="small" color="green">{{ getTimeRangeFromCombination(item) }}</v-chip></span></div>
              
            </div>
            <!-- Configuration Details -->
            <v-expansion-panels>
              <v-expansion-panel>
                <v-expansion-panel-title>Configuration Used</v-expansion-panel-title>
                <v-expansion-panel-text>
            <div class="mt-4">
              <v-row dense>
                <v-col cols="6" sm="6">
                  <strong>Timeframe:</strong> {{ item.configuration.settings.dataSheetName }}
                </v-col>
                 <v-col cols="6" sm="6">
                  <strong>Min Trades:</strong> {{ item.configuration.settings.minTradeCount }}
                </v-col>
                <v-col cols="6" sm="6">
                  <strong>Min SL Ratio:</strong> {{ item.configuration.settings.minSLToTPRatio }}
                </v-col>
                <v-col cols="6" sm="6">
                  <strong>Max TP Ratio:</strong> {{ item.configuration.settings.maxTPToSLRatio }}
                </v-col>
              </v-row>
              
              <div class="mt-2">
                <strong>Predefined Filters:</strong>
                <pre><code>{{ JSON.stringify(item.configuration.settings.predefinedFilters, null, 2) }}</code></pre>
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
                variant="tonal"
                color="grey"
                @click="emit('edit-tags', item)"
                title="Edit tags"
            >Tags</v-btn>
            <v-btn
              
              variant="tonal"
              color="error"
              @click="emit('delete-item', item)"
              
            >Delete</v-btn>
            <v-spacer></v-spacer>
            <v-btn variant="tonal" color="primary" @click="emit('apply-filter', item)">Apply Filter</v-btn>
          </v-card-actions>
        </v-card>
</template>

<script setup lang="ts">
import { mdiStar, mdiDeleteOutline, mdiTagMultipleOutline, mdiPencil } from '@mdi/js';

// --- Props & Emits ---
const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
});
const emit = defineEmits(['edit-tags', 'delete-item', 'apply-filter']);

function convertMinutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const paddedHours = String(hours).padStart(2, '0');
  const paddedMinutes = String(minutes).padStart(2, '0');

  return `${paddedHours}:${paddedMinutes}`;
}

function getTimeRangeFromCombination(item: any): string | null {
  //console.log("getTimeRangeFromCombination: ", item);
  const combination = item.resultData.combination;
  if (combination.TimeFilter) {
    return `${convertMinutesToTime(combination.TimeFilter.minMinutes)} - ${convertMinutesToTime(combination.TimeFilter.maxMinutes)}`;
  } else if (combination.TimeWindow) {
    return combination.TimeWindow;
  } else {
    return null;
  }
}

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

function getMetric(item: any, metricKey: string, asPercent: boolean = false): string | number | undefined {
  const strategyName = item.strategyName;
  if (!strategyName) return 'N/A'; // No strategy context

  if (!item.resultData.metrics) {
    if (metricKey === 'score' ) return item.resultData.overallScore;
    if (metricKey === 'totalTradesThisStrategy') return item.resultData.overallTradeCount;
    if (metricKey === 'profitFactor') return item.resultData.profitFactor;
    if (metricKey === 'winRate' && asPercent) return `${(item.resultData.winRate * 100).toFixed(1)}%`
    if (metricKey === 'netProfit') return item.resultData.netProfit;
  }

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
</script>
<style scoped>
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 1rem;
}
.predefined-grid {
  display: grid;
  grid-template-columns: 100px repeat(4, 4fr);
  gap: 1rem;
}
</style>