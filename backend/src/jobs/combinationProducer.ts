import IORedis from 'ioredis';
import { generateNumericRanges } from './optimizationUtils'; // Assuming helpers are here

// ===================================================================================
//  THE GENERATOR: This is the core fix for the memory issue.
// ===================================================================================
function* generateCombinationsGenerator(criteria: any[], index: number, currentCombination: any): Generator<any> {
    // Base case: If we've processed all criteria, yield the completed combination.
    if (index === criteria.length) {
        yield Object.assign({}, currentCombination);
        return;
    }

    const criterion = criteria[index];
    let effectiveTestValues: any[];

    if (criterion.type === 'numericRange') {
        effectiveTestValues = generateNumericRanges(criterion.thresholds || [null], criterion.mode);
    } else { // 'exact' type
        effectiveTestValues = (criterion.testValues && criterion.testValues.length > 0) ? [...criterion.testValues] : [null];
    }

    // For each possible value of the current criterion...
    for (const value of effectiveTestValues) {
        const nextCombination = { ...currentCombination };
        if (value !== null) {
            nextCombination[criterion.columnHeader] = value;
        }
        // ...delegate to the generator for the *next* criterion.
        // `yield*` passes control and yields all values from the sub-generator.
        yield* generateCombinationsGenerator(criteria, index + 1, nextCombination);
    }
}


/**
 * The Producer's main responsibility. It now accepts a list of time windows
 * and creates a combination variant for each one.
 * @param jobId The unique ID of the master job.
 * @param combinatorialCriteria The array of criteria.
 * @param timeWindowsToTest An array of time window objects, or [null] for "any time".
 * @param redisClient An IORedis client instance.
 * @returns The total number of combinations pushed to Redis.
 */
export async function produceCombinations(
    jobId: string,
    combinatorialCriteria: any[],
    timeWindowsToTest: (any[] | null),
    redisClient: IORedis
): Promise<number> {
    const redisKey = `combinations-for-job:${jobId}`;
    console.log(`[Producer for Job ${jobId}]: Starting generation for ${timeWindowsToTest?.length} time windows.`);

    const generator = generateCombinationsGenerator(combinatorialCriteria, 0, {});
    let totalPushed = 0;
    const BATCH_SIZE = 500;
    let batch: string[] = [];

    // Loop through the base combinations generated
    for (const baseCombo of generator) {
        // For each base combination, create a variant for each time window
        for (const timeWindow of timeWindowsToTest!) {
            const comboWithTime = {
                ...baseCombo,
                // Attach the time window directly to the combination object.
                // The consumer will use this.
                TimeWindow: timeWindow ? `${timeWindow.min}-${timeWindow.max}` : 'Any',
            };
            
            batch.push(JSON.stringify(comboWithTime));
            totalPushed++;

            if (batch.length >= BATCH_SIZE) {
                await redisClient.rpush(redisKey, ...batch);
                batch = [];
            }
        }
    }

    // Push any remaining combinations in the last batch
    if (batch.length > 0) {
        await redisClient.rpush(redisKey, ...batch);
    }

    await redisClient.expire(redisKey, 43200); // 12 hours

    console.log(`[Producer for Job ${jobId}]: Finished. Pushed ${totalPushed} total combination variants.`);
    return totalPushed;
}