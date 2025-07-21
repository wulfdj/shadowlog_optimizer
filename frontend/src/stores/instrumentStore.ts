import { ref, watch } from 'vue';
import { defineStore } from 'pinia';

export const useInstrumentStore = defineStore('instrument', () => {
    const availableInstruments = ref(['DAX', 'US30', 'F40', 'US500', 'GOLD', 'USTEC', 'UK100']);
    const selectedInstrument = ref(localStorage.getItem('selectedInstrument') || 'DAX');

    watch(selectedInstrument, (newInstrument) => {
        localStorage.setItem('selectedInstrument', newInstrument);
    });

    return { availableInstruments, selectedInstrument };
});
