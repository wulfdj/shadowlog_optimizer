import axios from 'axios';

const apiClient = axios.create({
    baseURL: 'http://localhost:3000/api',
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
    runOptimization(configId: number) {
        return apiClient.post(`/optimize/${configId}`);
    },
    getResultList() {
        return apiClient.get('/results');
    },
    getResultDetails(resultId: number) {
        return apiClient.get(`/results/${resultId}`);
    },
    getArchivedResults() {
        return apiClient.get('/archive');
    },
    saveToArchive(payload: { configurationId: number, resultData: object, strategyName: string }) {
        return apiClient.post('/archive', payload);
    },

    deleteArchivedResult(id: number) {
        return apiClient.delete(`/archive/${id}`);
    },
    getActiveJobs() {
        return apiClient.get('/optimize/active');
    },
     stopJob(jobId: string | number) {
        return apiClient.post(`/optimize/stop/${jobId}`);
    }
};