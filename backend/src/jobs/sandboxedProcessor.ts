import { SandboxedJob } from 'bullmq';
import IORedis from 'ioredis';
import { redisConnection } from './redisConnection';
import { AppDataSource } from '../database/data-source';
import { TemporaryResult } from '../entities/TemporaryResult';
import { applyFilters, calculateMetricsForAllStrategies, calculateCompositeScore, applyPredefinedFilters } from './optimizationUtils';

let redisClient: IORedis;
let tempResultRepo: any;

async function processCombination(comboString: string, preFilteredTrades: any[], settings: any, job: SandboxedJob) {
    const combo = JSON.parse(comboString);
    
    const timeWindowString = combo.TimeWindow;
    let timeFilteredTrades = preFilteredTrades;

    if (timeWindowString && timeWindowString !== 'Any') {
        const [min, max] = timeWindowString.split('-');
        timeFilteredTrades = applyPredefinedFilters(preFilteredTrades, [{
            type: 'timeRange',
            condition: { minMinutes: min, maxMinutes: max }
        }]);
    }
    
    const { filteredTrades, ltaCombination } = applyFilters(timeFilteredTrades, combo);
    if (filteredTrades.length < (settings.minTradeCount || 5)) return;

    const { resultsByStrategy } = calculateMetricsForAllStrategies(filteredTrades, ltaCombination, settings, combo);
    if (!resultsByStrategy) return;

    const strategyScores: { [key: string]: number } = {};
    let sumOfScores = 0;
    let scoredStrategies = 0;
    Object.keys(resultsByStrategy).forEach(strategyName => {
        const score = calculateCompositeScore(resultsByStrategy[strategyName], settings.rankingWeights);
        strategyScores[strategyName] = score;
        if (isFinite(score)) {
            sumOfScores += score;
            scoredStrategies++;
        }
    });
    const overallScore = scoredStrategies > 0 ? sumOfScores / scoredStrategies : -Infinity;

    if (isFinite(overallScore) && overallScore > -Infinity) {
        const fullResultData = {
            combination: combo,
            overallScore,
            overallTradeCount: filteredTrades.length,
            metrics: resultsByStrategy,
            strategyScores,
        };
        const tempResult = tempResultRepo.create({
            jobId: String(job.id!),
            overallScore: overallScore,
            resultData: fullResultData,
        });
        await tempResultRepo.save(tempResult);
    }
}

export default async function (job: SandboxedJob): Promise<any> {
    if (!AppDataSource.isInitialized) await AppDataSource.initialize();
    if (!redisClient) redisClient = new IORedis(redisConnection);
    if (!tempResultRepo) tempResultRepo = AppDataSource.getRepository(TemporaryResult);
    
    const { preFilteredTrades, settings, totalCombinations } = job.data;
    const redisKey = `combinations-for-job:${job.id!}`;
    const stopFlagKey = `stop-job:${job.id!}`;

    console.log(`[Consumer (PID ${process.pid}) for Job ${job.id}]: Starting to pull from ${redisKey}`);

    let combinationsProcessed = 0;
    while (true) {
        if (combinationsProcessed > 0 && combinationsProcessed % 100 === 0) {
            const stopSignal = await redisClient.get(stopFlagKey);
            if (stopSignal) {
                console.log(`[Consumer for Job ${job.id}]: Stop signal received. Exiting.`);
                throw new Error("Job stopped by user signal.");
            }
            // Report progress
            const listLen = await redisClient.llen(redisKey);
            const processedCount = totalCombinations - listLen;
            await job.updateProgress( (processedCount / totalCombinations) * 100 );

        }
        
        const comboString = await redisClient.lpop(redisKey);

        if (comboString) {
            await processCombination(comboString, preFilteredTrades, settings, job);
            combinationsProcessed++;
        } else {
            console.log(`[Consumer (PID ${process.pid}) for Job ${job.id}]: List is empty. Processed ${combinationsProcessed} combinations. Exiting.`);
            break;
        }
    }
    return { processed: combinationsProcessed };
}