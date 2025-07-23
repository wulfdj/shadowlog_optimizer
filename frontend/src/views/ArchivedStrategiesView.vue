<template>
  <v-container>
      <v-row align="center" class="mb-4">
      <v-col>
        <h1 class="text-h5 font-weight-bold">Archived Strategies</h1>
      </v-col>
      <v-col class="text-right d-flex align-center justify-end">
        <!-- Sort Controls -->
        <v-menu offset-y>
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" variant="outlined">
              <v-icon :icon="mdiSortVariant" left></v-icon>
              Sort By: {{ activeSort.title }}
            </v-btn>
          </template>
          <v-list>
            <v-list-item v-for="item in sortOptions" :key="item.key" @click="setActiveSort(item)">
              <v-list-item-title>{{ item.title }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>

        <!-- View Mode Toggle -->
        <v-btn-toggle style="height:38px" v-model="viewMode" variant="outlined" divided class="ml-4">
          <v-btn value="grid"><v-icon :icon="mdiViewGridOutline"></v-icon></v-btn>
          <v-btn  value="list"><v-icon :icon="mdiViewListOutline"></v-icon></v-btn>
        </v-btn-toggle>

        <v-btn variant="tonal" color="primary" @click="importDialog.show = true" class="ml-4">
          <v-icon :icon="mdiImport" left></v-icon>
          Import
        </v-btn>
      </v-col>
    </v-row>
    
    <div v-if="sortedResults.length === 0">
        <v-alert type="info">No archived strategies have been saved yet.</v-alert>
    </div>

    <v-row v-else>
      <v-col
        v-for="item in sortedResults"
        :key="item.id"
        :cols="12"
        :md="viewMode === 'grid' ? 6 : 12"
      >
        <ArchivedStrategyCard
          :item="item"
          @edit-tags="openTagDialog"
          @delete-item="confirmDelete"
          @apply-filter="applyAndGo"
        />
      </v-col>
    </v-row>
     <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="3000">
        {{ snackbar.message }}
    </v-snackbar>
     <v-dialog v-model="importDialog.show" persistent max-width="800px">
      <v-card>
        <v-card-title>
          <span class="headline">Import Archived Strategy</span>
        </v-card-title>
        <v-card-text>
          <p class="mb-2">Paste the semicolon-separated line from your spreadsheet here.</p>
          <v-textarea
            v-model="importDialog.importString"
            label="Strategy CSV String"
            placeholder="2025-07-15 14:35:21;2,98..."
            rows="4"
            autofocus
            clearable
          ></v-textarea>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="tonal" text @click="importDialog.show = false">Cancel</v-btn>
          <v-btn variant="tonal" color="success" text @click="handleImport" :loading="importDialog.isImporting">Import</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
        <v-dialog v-model="tagDialog.show" persistent max-width="700px">
      <v-card>
        <v-card-title>
          <span class="headline">Manage Tags for: {{ tagDialog.editingItem?.configuration.name }}</span>
        </v-card-title>
        <v-card-text>
          <p>Select existing tags to assign. Click the pencil to edit a tag for all items.</p>
          <v-chip-group v-model="tagDialog.selectedTagIds" column multiple>
            <v-chip
              v-for="tag in allTags"
              :key="tag.id"
              :value="tag.id"
              :color="tag.color"
              filter
              variant="flat"
              label
              closable
              @click:close="confirmDeleteTag(tag)"
            >
              {{ tag.name }}
              <v-icon end :icon="mdiPencil" size="x-small" @click.stop.prevent="openEditTagDialog(tag)"></v-icon>
            </v-chip>
          </v-chip-group>

          <v-divider class="my-4"></v-divider>
          
          <p>Or create a new tag:</p>
          <v-row dense align="center">
            <v-col cols="12" sm="5">
              <v-text-field v-model="tagDialog.newTagName" label="New Tag Name" hide-details></v-text-field>
            </v-col>
            <v-col cols="12" sm="5">
              <ColorPalettePicker v-model="tagDialog.newTagColor" />
            </v-col>
            <v-col cols="12" sm="2">
              <v-btn variant="tonal" color="secondary" @click="createNewTag" :disabled="!tagDialog.newTagName || !tagDialog.newTagColor" block>Create</v-btn>
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="tonal" text @click="tagDialog.show = false">Cancel</v-btn>
          <v-btn variant="tonal" color="success" text @click="saveTags" :loading="tagDialog.isSaving">Save Assignments</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- EDIT INDIVIDUAL TAG DIALOG (Nested) -->
     <v-dialog v-model="editTagDialog.show" persistent width="400">
        <v-card v-if="editTagDialog.editingTag">
            <v-card-title>Edit Tag</v-card-title>
            <<v-card-text>
            <v-text-field v-model="editTagDialog.name" label="Tag Name" class="mb-2"></v-text-field>
            <p class="text-caption">Tag Color</p>
            <ColorPalettePicker v-model="editTagDialog.color" />
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn text @click="editTagDialog.show = false">Cancel</v-btn>
                <v-btn color="primary" text @click="saveTagEdit" :loading="editTagDialog.isSaving">Update Tag</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import ColorPalettePicker from '@/components/ColorPalettePicker.vue'
import ArchivedStrategyCard from '@/components/ArchivedStrategyCard.vue';
import { mdiStar, mdiDeleteOutline, mdiTagMultipleOutline, mdiPencil, mdiViewGrid, mdiViewList, mdiImport, mdiSortVariant, mdiViewGridOutline, mdiViewListOutline } from '@mdi/js';
import { ref, onMounted, reactive, computed, watch } from 'vue';
import api from '@/services/api';
import { useFilterStore } from '@/stores/filterStore';
import { useRouter } from 'vue-router';
import { useInstrumentStore } from '@/stores/instrumentStore';

// Create an instance of the store to make its state available to the template.
const instrumentStore = useInstrumentStore();

watch(() => instrumentStore.selectedInstrument, (newInstrument) => {
    // 2. Call the main data fetching function for this view
    fetchArchived(newInstrument);
});

const viewMode = ref<'grid' | 'list'>('grid'); // Default to grid
watch(viewMode, (newValue) => {
    localStorage.setItem('archiveViewMode', newValue);
});
const allArchivedResults = ref<any[]>([]); 
const sortOptions = [
    { key: 'date', title: 'Date Archived' },
    { key: 'context', title: 'Timeframe & Setup' },
    { key: 'score', title: 'Best Score' },
];
const activeSort = ref(sortOptions[0]);
const contextSort = (a: any, b: any) => {
    const order = ['1M', '5M', '10M', '15M', '30M', '1H', '4H', 'D1'];
    const timeframeA = a.configuration.settings.dataSheetName;
    const timeframeB = b.configuration.settings.dataSheetName;
    const indexA = order.indexOf(timeframeA);
    const indexB = order.indexOf(timeframeB);
    
    // Primary Sort: Timeframe
    if (indexA !== indexB) {
        return indexA - indexB;
    }
    // Secondary Sort: Setup
    const setupA = getPredefinedFilter(a.configuration, 'Setup') || '';
    const setupB = getPredefinedFilter(b.configuration, 'Setup') || '';
    return setupA.localeCompare(setupB);
};

// --- THE CORE LOGIC: Sorting Computed Property ---
const sortedResults = computed(() => {
    // 1. Create a mutable copy of the master list
    const results = [...allArchivedResults.value];

    // 2. Apply the active sorting function
    switch (activeSort.value.key) {
        case 'context':
            results.sort(contextSort);
            break;
        case 'score':
            results.sort((a, b) => b.resultData.overallScore - a.resultData.overallScore);
            break;
        case 'date':
        default:
            results.sort((a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime());
            break;
    }
    return results;
});
async function fetchArchived(instrument: string) {
    try {
        const response = await api.getArchivedResults(instrument);
        allArchivedResults.value = response.data;
        console.log("Archived result: ", archivedResults.value);
    } catch (error) {
        console.error("Failed to fetch archived results:", error);
    }
}
const setActiveSort = (option: { key: string, title: string }) => {
    activeSort.value = option;
};
const allTags = ref<any[]>([]);
const tagDialog = reactive({
    show: false,
    isSaving: false,
    editingItem: null as any | null,
    selectedTagIds: [] as number[],
    newTagName: '',
    newTagColor: 'blue-grey',
});

const editTagDialog = reactive({
    show: false,
    isSaving: false,
    editingTag: null as any | null,
    name: '',
    color: '',
});

// --- Add new methods ---
async function fetchTags() {
    try {
        const response = await api.getTags();
        allTags.value = response.data;
    } catch (error) {
        console.error("Failed to fetch tags:", error);
    }
}

function openTagDialog(item: any) {
    tagDialog.editingItem = item;
    // Pre-select the tags that are already assigned to this item
    tagDialog.selectedTagIds = item.tags?.map((t: any) => t.id) || [];
    tagDialog.show = true;
}

async function createNewTag() {
    try {
        const newTag = await api.createTag({
            name: tagDialog.newTagName,
            color: tagDialog.newTagColor,
        });
        allTags.value.push(newTag.data); // Add to our local list
        tagDialog.selectedTagIds.push(newTag.data.id); // And auto-select it
        tagDialog.newTagName = ''; // Clear form
    } catch (error) {
        showSnackbar("Failed to create tag. Does it already exist?", "error");
    }
}

async function saveTags() {
    if (!tagDialog.editingItem) return;
    tagDialog.isSaving = true;
    try {
        const updatedArchive = await api.updateArchiveTags(
            tagDialog.editingItem.id,
            tagDialog.selectedTagIds
        );
        // Find the item in our main list and update its tags for instant UI feedback
        const index = archivedResults.value.findIndex(item => item.id === tagDialog.editingItem.id);
        if (index !== -1) {
            archivedResults.value[index].tags = updatedArchive.data.tags;
        }
        showSnackbar("Tags updated successfully!", "success");
        tagDialog.show = false;
    } catch (error) {
        showSnackbar("Failed to update tags.", "error");
    } finally {
        tagDialog.isSaving = false;
    }
}

function openEditTagDialog(tag: any) {
    editTagDialog.editingTag = tag;
    editTagDialog.name = tag.name;
    editTagDialog.color = tag.color;
    editTagDialog.show = true;
}

// NEW: Saves the changes to an individual tag
async function saveTagEdit() {
    if (!editTagDialog.editingTag) return;
    editTagDialog.isSaving = true;
    try {
        const updatedTag = await api.updateTag(editTagDialog.editingTag.id, {
            name: editTagDialog.name,
            color: editTagDialog.color,
        });
        // Find and update the tag in our local 'allTags' array for instant UI feedback
        const index = allTags.value.findIndex(t => t.id === updatedTag.data.id);
        if (index !== -1) {
            allTags.value[index] = updatedTag.data;
        }
        showSnackbar("Tag updated successfully!", "success");
        editTagDialog.show = false;
    } catch (error) {
        showSnackbar("Failed to update tag.", "error");
    } finally {
        editTagDialog.isSaving = false;
    }
}

// NEW: Deletes an individual tag
async function confirmDeleteTag(tagToDelete: any) {
    if (confirm(`Are you sure you want to delete the tag "${tagToDelete.name}" everywhere? This cannot be undone.`)) {
        try {
            await api.deleteTag(tagToDelete.id);
            // Remove the tag from our local list
            allTags.value = allTags.value.filter(t => t.id !== tagToDelete.id);
            // Also remove it from any current selections
            tagDialog.selectedTagIds = tagDialog.selectedTagIds.filter(id => id !== tagToDelete.id);
            showSnackbar("Tag deleted successfully.", "success");
        } catch (error) {
            showSnackbar("Failed to delete tag.", "error");
        }
    }
}


interface ArchivedItem {
  id: number;
  name: string;
  notes?: string;
  archivedAt: string;
  resultData: any;
  configurationData: any;
  strategyName?: string;
  configuration: any;
  tags: any[];
}

const importDialog = reactive({
  show: false,
  isImporting: false,
  importString: '',
});

// --- Parsing Logic ---
function parseImportString(input: string): object | null {
  try {
    console.log("parse import string: ", input);
    const parts = input.trim().split(';'); // Split by tabs
    if (parts.length < 12) throw new Error("Invalid format: not enough columns.");

    // --- Extract Metrics ---
    const resultMetrics = {
      overallScore: parseFloat(parts[1].replace(',', '.')),
      profitFactor: parseFloat(parts[2].replace(',', '.')),
      winRate: parseFloat(parts[3].replace('%', '').replace(',', '.')) / 100,
      overallTradeCount: parseInt(parts[4], 10),
      netProfit: parseFloat(parts[5].replace('.', '').replace(',', '.')),
      combination: JSON.parse(parts[6]),
    };

    // --- Extract Configuration Settings ---
    const timeParts = parts[10].split(' - ');
    const predefinedFilters = [
      { columnHeader: 'Setup', type: 'exact', condition: parts[8] },
      { type: 'timeRange', columnHeader: 'Time', condition: { minMinutes: timeParts[0], maxMinutes: timeParts[1] } },
    ];

    const ratioParts = parts[12].split(",");
    const minSlTPRatioPart = ratioParts[0].replace("Min SL to TP Ratio: ", "");
    const maxTPSLRatioPart = ratioParts[1].replace("Max TP to SL Ratio: ", "");
    console.log(resultMetrics, minSlTPRatioPart, maxTPSLRatioPart)
    
    // Add other predefined filters if they exist in the string

    const settings = {
      dataSheetName: parts[7],
      minTradeCount: 5, // Default or parse from string if available
      maxCombinationsToTest: 100000, // Default
      predefinedFilters: predefinedFilters,
      combinationsToTest: parts[11].split(',').map(s => s.trim()),
      minSLToTPRatio: parseFloat(minSlTPRatioPart),
      maxTPToSLRatio: parseFloat(maxTPSLRatioPart),
      minProfitFactor: 1.5,
      minWinRate: 60,
      rankingWeights: {
        profitFactor: 0.40,
        winRate: 0.30,
        tradeCount: 0.15,
        netProfitPips: 0.15,
      },
    };

    return {
      configurationName: `${parts[8]} ${parts[7]} (${parts[10]})`, // Auto-generate a name
      settings: settings,
      resultData: {
        strategyName: parts[9],
        metrics: resultMetrics,
      },
    };
  } catch (error) {
    console.error("Parsing failed:", error);
    return null;
  }
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
  console.log("ApplyAndGo", archivedItem);
    filterStore.setFiltersAndNavigate(
        archivedItem.resultData,
        archivedItem.configuration,
        router,
        archivedItem.strategyName
    );
}

const handleImport = async () => {
  if (!importDialog.importString) return;

  const parsedData = parseImportString(importDialog.importString);
  if (!parsedData) {
    showSnackbar("Failed to parse import string. Please check the format.", "error");
    return;
  }

  importDialog.isImporting = true;
  try {
    await api.importArchivedResult(parsedData);
    console.log("imported data:", parsedData);
    showSnackbar("Strategy imported successfully!", "success");
    await fetchArchived(instrumentStore.selectedInstrument); // Refresh the list
    importDialog.show = false;
    importDialog.importString = '';
  } catch (error: any) {
    showSnackbar(error.response?.data?.message || "Import failed.", "error");
  } finally {
    importDialog.isImporting = false;
  }
};


// Call fetchTags in onMounted
onMounted(() => {
  const savedMode = localStorage.getItem('archiveViewMode');
    if (savedMode === 'list' || savedMode === 'grid') {
        viewMode.value = savedMode;
    }
    fetchArchived(instrumentStore.selectedInstrument);
    fetchTags();
});
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