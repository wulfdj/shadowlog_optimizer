import axios from 'axios';

const apiClient = axios.create({
    // Vite will replace this with the correct string during dev or build.
    baseURL: import.meta.env.VITE_API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    }
});

export default {
    uploadTrades(trades: any[], timeframe: string) {
        return apiClient.post(`/trades/upload/${timeframe}`, trades);
    },
    getTradesByTimeframe(timeframe: string) {
        return apiClient.get(`/trades/${timeframe}`);
    },
    getAvailableTimeframes() {
        return apiClient.get('/trades/timeframes');
    },
    getConfigurations() {
        return apiClient.get('/configurations');
    },
    saveConfiguration(config: { name: string, settings: object }) {
        return apiClient.post('/configurations', config);
    },
    // --- NEW METHODS ---
    updateConfiguration(id: number, config: { name: string, settings: object }) {
        return apiClient.put(`/configurations/${id}`, config);
    },
    deleteConfiguration(id: number) {
        return apiClient.delete(`/configurations/${id}`);
    },
    runOptimization(configId: number, highPriority: boolean) {
        return apiClient.post(`/optimize/${configId}`, { highPriority });
    },
    getResultList() {
        return apiClient.get('/results');
    },
    getResultDetails(resultId: number) {
        return apiClient.get(`/results/${resultId}`);
    },
    deleteResult(resultId: number) {
        return apiClient.delete(`/results/${resultId}`);
    },
    getArchivedResults() {
        return apiClient.get('/archive');
    },
    saveToArchive(payload: { configurationId: number, resultData: object, strategyName: string }) {
        console.log("saveToArchive: ", payload);
        return apiClient.post('/archive', payload);
    },

    deleteArchivedResult(id: number) {
        return apiClient.delete(`/archive/${id}`);
    },
    importArchivedResult(parsedData: object) {
        return apiClient.post('/archive/import', { parsedData });
    },
    getActiveJobs() {
        return apiClient.get('/optimize/active');
    },
     stopJob(jobId: string | number) {
        return apiClient.post(`/optimize/stop/${jobId}`);
    },
    getTags() {
        return apiClient.get('/tags');
    },
    createTag(payload: { name: string, color: string }) {
        return apiClient.post('/tags', payload);
    },
    updateArchiveTags(archiveId: number, tagIds: number[]) {
        return apiClient.put(`/archive/${archiveId}/tags`, { tagIds });
    },
};