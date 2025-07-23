import { ref } from 'vue';
import { defineStore } from 'pinia';
import { type Router } from 'vue-router';

// We define our store using the setup store syntax for better TypeScript inference
export const useFilterStore = defineStore('filter', () => {
  // The state: holds the filter combination object
  const activeResult = ref<any>(null);
  const activeConfiguration = ref<any>(null);
  const activeStrategyName = ref<string>("");

  /**
   * An action to set the active filters and programmatically navigate
   * to the filtered data view page.
   * @param filters The filter combination object from the results grid.
   * @param router The Vue router instance.
   */
  function setFiltersAndNavigate(resultData: object, configurationData: object, router: Router, strategyName: string = "") {
    console.log("set FiltersAndNavigate: ", resultData, configurationData, router, strategyName);
    activeResult.value = resultData;
    activeConfiguration.value = configurationData;
    activeStrategyName.value = strategyName;
    router.push('/filtered-data');
  }

  function clearFilters() {
    activeResult.value = null;
    activeConfiguration.value = null;
  }

  return { activeResult, activeConfiguration, activeStrategyName, setFiltersAndNavigate, clearFilters };
});