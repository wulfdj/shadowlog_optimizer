import { ref } from 'vue';
import { defineStore } from 'pinia';
import { type Router } from 'vue-router';

// We define our store using the setup store syntax for better TypeScript inference
export const useFilterStore = defineStore('filter', () => {
  // The state: holds the filter combination object
  const activeResult = ref<any>(null);
  const activeConfiguration = ref<any>(null);

  /**
   * An action to set the active filters and programmatically navigate
   * to the filtered data view page.
   * @param filters The filter combination object from the results grid.
   * @param router The Vue router instance.
   */
  function setFiltersAndNavigate(resultData: object, configurationData: object, router: Router) {
    console.log("set FiltersAndNavigate: ", resultData, configurationData, router);
    activeResult.value = resultData;
    activeConfiguration.value = configurationData;
    router.push('/filtered-data');
  }

  function clearFilters() {
    activeResult.value = null;
    activeConfiguration.value = null;
  }

  return { activeResult, activeConfiguration, setFiltersAndNavigate, clearFilters };
});