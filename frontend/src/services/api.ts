import axios from 'axios';

const apiClient = axios.create({
    // Vite will replace this with the correct string during dev or build.
    baseURL: import.meta.env.VITE_API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    }
});

export default {
    uploadTrades(instrument: string, trades: any[], timeframe: string) {
        return apiClient.post(`/trades/${instrument}/upload/${timeframe}`, trades);
    },
    getTradesByTimeframe(instrument: string, timeframe: string) {
        return apiClient.get(`/trades/${instrument}/${timeframe}`);
    },
    getAvailableTimeframes(instrument: string) {
        return apiClient.get(`/trades/${instrument}/timeframes`);
    },
    getConfigurations(instrument: string) {
        return apiClient.get(`/configurations/${instrument}`);
    },
    saveConfiguration(instrument: string, config: { name: string, settings: object }) {
        return apiClient.post(`/configurations/${instrument}`, config);
    },
    // --- NEW METHODS ---
    updateConfiguration(id: number, config: { name: string, settings: object }) {
        return apiClient.put(`/configurations/${id}`, config);
    },
    deleteConfiguration(id: number) {
        return apiClient.delete(`/configurations/${id}`);
    },
    runOptimization(instrument: string, configId: number, highPriority: boolean) {
        return apiClient.post(`/optimize/${instrument}/${configId}`, { highPriority });
    },
    getResultList(instrument: string) {
        return apiClient.get(`/results/${instrument}`);
    },
    getResultDetails(instrument: string, resultId: number) {
        return apiClient.get(`/results/${instrument}/${resultId}`);
    },
    deleteResult(resultId: number) {
        return apiClient.delete(`/results/${resultId}`);
    },
    getArchivedResults(instrument: string) {
        return apiClient.get(`/archive/${instrument}`);
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
     updateTag(id: number, payload: { name?: string, color?: string }) {
        return apiClient.put(`/tags/${id}`, payload);
    },
    deleteTag(id: number) {
        return apiClient.delete(`/tags/${id}`);
    },
};