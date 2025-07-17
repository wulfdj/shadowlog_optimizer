import { Job } from 'bullmq';
import IORedis from 'ioredis';
import { redisConnection } from './redisConnection';
import { AppDataSource } from '../database/data-source';
import { Configuration } from '../entities/Configuration';
import { Trade } from '../entities/Trade';
import { OptimizationResult } from '../entities/OptimizationResult';
import { TemporaryResult } from '../entities/TemporaryResult';
import { produceCombinations } from './combinationProducer';
import { SELECTABLE_COMBINATIONS, applyPredefinedFilters } from './optimizationUtils';

export async function runMasterOptimization(job: Job): Promise<any> {
    const startTime = new Date();
    const redisClient = new IORedis(redisConnection);
    console.log(`--- MASTER JOB ${job.id} STARTED ---`);

    const { configId } = job.data;
    const configRepo = AppDataSource.getRepository(Configuration);
    const tradeRepo = AppDataSource.getRepository(Trade);
    const resultRepo = AppDataSource.getRepository(OptimizationResult);
    const tempResultRepo = AppDataSource.getRepository(TemporaryResult);
    
    try {
        const config = await configRepo.findOneBy({ id: configId });
        if (!config) throw new Error("Configuration not found.");
        const settings = config.settings as any;

        const timeWindowsToTest: any[] = [];
        const baseTimeFilter = settings.predefinedFilters.find((f: any) => f.type === 'timeRange');
        if (baseTimeFilter && baseTimeFilter.condition.minMinutes && baseTimeFilter.condition.maxMinutes) {
            const baseTime = baseTimeFilter.condition;
            timeWindowsToTest.push({ min: baseTime.minMinutes, max: baseTime.maxMinutes });
            if (settings.enableTimeShift) {
                const minH = parseInt(baseTime.minMinutes.split(':')[0]);
                const maxH = parseInt(baseTime.maxMinutes.split(':')[0]);
                timeWindowsToTest.push({ min: `${String(minH - 1).padStart(2, '0')}:00`, max: `${String(maxH).padStart(2, '0')}:00` });
                timeWindowsToTest.push({ min: `${String(minH - 1).padStart(2, '0')}:00`, max: `${String(maxH - 1).padStart(2, '0')}:00` });
                timeWindowsToTest.push({ min: `${String(minH - 1).padStart(2, '0')}:00`, max: `${String(maxH - 2).padStart(2, '0')}:00` });
                timeWindowsToTest.push({ min: `${String(minH - 1).padStart(2, '0')}:00`, max: `${String(maxH + 1).padStart(2, '0')}:00` });
                timeWindowsToTest.push({ min: `${String(minH - 1).padStart(2, '0')}:00`, max: `${String(maxH + 2).padStart(2, '0')}:00` });

                timeWindowsToTest.push({ min: `${String(minH).padStart(2, '0')}:00`, max: `${String(maxH - 1).padStart(2, '0')}:00` });
                timeWindowsToTest.push({ min: `${String(minH).padStart(2, '0')}:00`, max: `${String(maxH - 2).padStart(2, '0')}:00` });
                timeWindowsToTest.push({ min: `${String(minH).padStart(2, '0')}:00`, max: `${String(maxH + 1).padStart(2, '0')}:00` });
                timeWindowsToTest.push({ min: `${String(minH).padStart(2, '0')}:00`, max: `${String(maxH + 2).padStart(2, '0')}:00` });

                timeWindowsToTest.push({ min: `${String(minH - 2).padStart(2, '0')}:00`, max: `${String(maxH).padStart(2, '0')}:00` });
                timeWindowsToTest.push({ min: `${String(minH - 2).padStart(2, '0')}:00`, max: `${String(maxH - 1).padStart(2, '0')}:00` });
                timeWindowsToTest.push({ min: `${String(minH - 2).padStart(2, '0')}:00`, max: `${String(maxH - 2).padStart(2, '0')}:00` });
                timeWindowsToTest.push({ min: `${String(minH - 2).padStart(2, '0')}:00`, max: `${String(maxH + 1).padStart(2, '0')}:00` });
                timeWindowsToTest.push({ min: `${String(minH - 2).padStart(2, '0')}:00`, max: `${String(maxH + 2).padStart(2, '0')}:00` });

                timeWindowsToTest.push({ min: `${String(minH - 1).padStart(2, '0')}:00`, max: `${String(maxH).padStart(2, '0')}:00` });
                timeWindowsToTest.push({ min: `${String(minH - 2).padStart(2, '0')}:00`, max: `${String(maxH).padStart(2, '0')}:00` });
                timeWindowsToTest.push({ min: `${String(minH + 1).padStart(2, '0')}:00`, max: `${String(maxH).padStart(2, '0')}:00` });
                timeWindowsToTest.push({ min: `${String(minH + 2).padStart(2, '0')}:00`, max: `${String(maxH).padStart(2, '0')}:00` });
            }
        } else {
            timeWindowsToTest.push(null);
        }
        console.log("Time windows to be included in combinations:", timeWindowsToTest);
        
        const enabledCombinationDefs = SELECTABLE_COMBINATIONS.filter(def => settings.combinationsToTest.includes(def.name));
        const combinatorialCriteria = enabledCombinationDefs.flatMap(def => def.criterias);
        const totalCombinations = await produceCombinations(String(job.id!), combinatorialCriteria, timeWindowsToTest, redisClient);
        
        await job.updateData({ ...job.data, totalCombinations });
        await job.updateProgress(5);

        let allTrades = await tradeRepo.find();
        const nonTimeFilters = settings.predefinedFilters.filter((f: any) => f.type !== 'timeRange');
        const preFilteredTrades = applyPredefinedFilters(allTrades, nonTimeFilters);
        
        await job.updateData({ ...job.data, preFilteredTrades, settings });
        
        console.log(`[Master for Job ${job.id}]: Waiting for consumers to process ${totalCombinations} combinations...`);
        const redisKey = `combinations-for-job:${job.id!}`;
        while (await redisClient.llen(redisKey) > 0) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            const stopSignal = await redisClient.get(`stop-job:${job.id!}`);
            if (stopSignal) {
                console.log(`[Master for Job ${job.id}]: Stop signal detected. Terminating wait.`);
                throw new Error("Job stopped by user signal.");
            }
        }
        console.log(`[Master for Job ${job.id}]: Consumers finished.`);
        await job.updateProgress(95);

        const topTempResults = await tempResultRepo.find({
            where: { jobId: String(job.id!) },
            order: { overallScore: 'DESC' },
            take: 100,
        });
        const finalResults = topTempResults.map(tr => tr.resultData);

        const newResult = resultRepo.create({
            configuration: config,
            results: finalResults,
            startedAt: startTime,
        });
        await resultRepo.save(newResult);
        
        await tempResultRepo.delete({ jobId: String(job.id!) });
        await redisClient.del(redisKey);

        console.log(`--- MASTER JOB ${job.id} FINISHED SUCCESSFULLY ---`);
        return { success: true };

    } catch (error) {
        console.error(`--- MASTER JOB ${job.id} FAILED ---`, error);
        await tempResultRepo.delete({ jobId: String(job.id!) });
        await redisClient.del(`combinations-for-job:${job.id!}`);
        await redisClient.del(`stop-job:${job.id!}`);
        throw error;
    }
}