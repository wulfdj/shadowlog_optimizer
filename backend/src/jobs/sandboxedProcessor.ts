import { SandboxedJob } from 'bullmq';
import { AppDataSource } from '../database/data-source';
import { Configuration } from '../entities/Configuration';
import { Trade } from '../entities/Trade';
import { OptimizationResult } from '../entities/OptimizationResult';
import IORedis from 'ioredis';
import { redisConnection } from './redisConnection';

// These define the structure of the strategies and selectable combinations
const TRADE_STRATEGIES = [
    { name: "1RR PW", winColumn: "TP_1RR_PW_WIN", tpPipsColumn: "TP_1RR_PW_PIPS", slPipsColumn: "SL_PW_PIPS", lta:false, s2: false, rangeBreakoutColumn: '' },
    { name: "1RR STR", winColumn: "TP_1RR_STR_WIN", tpPipsColumn: "TP_1RR_STR_PIPS", slPipsColumn: "SL_STR_PIPS", lta:false, s2:false,rangeBreakoutColumn: '' },
    { name: "SR LTA SL PW", winColumn: "TP_SR_LTA_SL_PW_WIN", tpPipsColumn: "TP_SR_LTA_PIPS", slPipsColumn: "SL_PW_PIPS", rangeBreakoutColumn: "LTA_Range_Breakout", lta: true, s2: false },
    { name: "SR LTA SL STR", winColumn: "TP_SR_LTA_SL_STR_WIN", tpPipsColumn: "TP_SR_LTA_PIPS", slPipsColumn: "SL_STR_PIPS", rangeBreakoutColumn: "LTA_Range_Breakout", lta: true, s2: false },
    { name: "SR NEAR SL PW", winColumn: "TP_SR_NEAREST_SL_PW_WIN", tpPipsColumn: "TP_SR_NEAREST_PIPS", slPipsColumn: "SL_PW_PIPS", rangeBreakoutColumn: "Nearest_Range_Breakout", lta: false, s2: false },
    { name: "SR NEAR SL STR", winColumn: "TP_SR_NEAREST_SL_STR_WIN", tpPipsColumn: "TP_SR_NEAREST_PIPS", slPipsColumn: "SL_STR_PIPS", rangeBreakoutColumn: "Nearest_Range_Breakout", lta: false, s2: false },
    { name: "SR STATIC SL PW", winColumn: "TP_SR_STATIC_SL_PW_WIN", tpPipsColumn: "TP_SR_STATIC_PIPS", slPipsColumn: "SL_PW_PIPS", rangeBreakoutColumn: "Static_Range_Breakout", lta: false, s2: false },
    { name: "SR STATIC SL STR", winColumn: "TP_SR_STATIC_SL_STR_WIN", tpPipsColumn: "TP_SR_STATIC_PIPS", slPipsColumn: "SL_STR_PIPS", rangeBreakoutColumn: "Static_Range_Breakout", lta: false, s2: false },
    { name: "SR CURR SL PW", winColumn: "TP_SR_CURRENT_PW_WIN", tpPipsColumn: "TP_SR_CURRENT_PIPS", slPipsColumn: "SL_PW_PIPS", rangeBreakoutColumn: "Current_Range_Breakout", lta: false, s2: true },
    { name: "SR CURR SL STR", winColumn: "TP_SR_CURRENT_STR_WIN", tpPipsColumn: "TP_SR_CURRENT_PIPS", slPipsColumn: "SL_STR_PIPS", rangeBreakoutColumn: "Current_Range_Breakout", lta: false, s2: true },
    
];

const SELECTABLE_COMBINATIONS = [
    { name: "Gaussian", criterias: [{ columnHeader: "Gaussian_Trend_1", type: "exact", testValues: [true, null], thresholds: [] }, /* ... other Gaussians */] },
    { name: "Candle Closed", criterias: [{ columnHeader: "M10_Candle", type: "exact", testValues: [true, null], thresholds: [] }, { columnHeader: "M15_Candle", type: "exact", testValues: [true, null], thresholds: [] }, { columnHeader: "M30_Candle", type: "exact", testValues: [true, null], thresholds: [] },{ columnHeader: "H1_Candle", type: "exact", testValues: [true, null], thresholds: [] },{ columnHeader: "H4_Candle", type: "exact", testValues: [true, null], thresholds: [] },{ columnHeader: "D1_Candle", type: "exact", testValues: [true, null], thresholds: [] },] },
    { name: "Candle Open", criterias: [{ columnHeader: "M10_Candle_Open", type: "exact", testValues: [true, null], thresholds: [] }, { columnHeader: "M15_Candle_Open", type: "exact", testValues: [true, null], thresholds: [] }, { columnHeader: "M30_Candle_Open", type: "exact", testValues: [true, null], thresholds: [] },{ columnHeader: "H1_Candle_Open", type: "exact", testValues: [true, null], thresholds: [] },{ columnHeader: "H4_Candle_Open", type: "exact", testValues: [true, null], thresholds: [] },{ columnHeader: "D1_Candle", type: "exact", testValues: [true, null], thresholds: [] },] },
    { name: "Candle Size Min Max", criterias: [{ columnHeader: "Candle_Size", type: "numericRange", testValues: [], thresholds: [2, 5, 8, 10, 15, 18, 25, null], mode: "PERMUTATION" }] },
    { name: "Breakout Distance Max", criterias: [{ columnHeader: "Breakout_Distance", type: "numericRange", testValues: [], thresholds: [2, 5, 7.5, 10, 12.5, 15, 20, 25, null], mode: "MAX" }] },
    { name: "Entry Distance Max", criterias: [{ columnHeader: "Entry_Distance", type: "numericRange", testValues:[], thresholds: [2, 5, 7.5, 10, 12.5, 15, 20, 25, null], mode: "MAX" }, ] },
    { name: "Entry Candle Has Wick", criterias: [{ columnHeader: "Entry_Candle_Has_Wick", type: "exact", thresholds: [], testValues: [true, null] }] },
    { name: "Breakout Candle Count Max", criterias: [{ columnHeader: "Breakout_Candle_Count", type: "numericRange", testValues:[], thresholds: [1, 2, 3, null], mode: "MAX" }] },
    { name: "Closed In LTA", criterias: [{ columnHeader: "Closed_In_LTA", type: "exact", thresholds: [], testValues: [true, null] }, ] },
    
];
// --- Helper Functions (Directly Ported and Adapted) ---


/**
 * Recursively calculates the total number of possible combinations without generating them.
 * This is extremely fast as it relies on the multiplication principle.
 * @param {Array<Object>} criteria The array of combinatorial criteria.
 * @param {number} index The current criterion index being processed.
 * @returns {number} The total number of combinations that will be generated.
 */
function countTotalCombinations(criteria: any[], index: number = 0): number {
    // Base case: If we've considered all criteria, we've completed one full path.
    if (index === criteria.length) {
        return 1;
    }

    const criterion = criteria[index];
    let optionsCount = 0;

    // Calculate how many options this single criterion provides.
    if (criterion.type === 'numericRange') {
        // We must call generateNumericRanges to know how many distinct ranges it produces.
        // This is a small, one-time cost per numeric criterion.
        const ranges = generateNumericRanges(criterion.thresholds || [null], criterion.mode);
        optionsCount = ranges.length;
    } else { // 'exact' type
        optionsCount = (criterion.testValues && criterion.testValues.length > 0) ? criterion.testValues.length : 1;
    }

    // The total is the number of options for this level multiplied by the
    // total number of combinations for all subsequent levels.
    return optionsCount * countTotalCombinations(criteria, index + 1);
}

/**
 * Generates all possible filter combinations using a highly optimized, iterative approach
 * that builds the final objects directly, avoiding intermediate data structures and a
 * final mapping step. This is the fastest version.
 * @param {Array<Object>} criteria The array of combinatorial criteria from the config.
 * @returns {Array<Object>} An array of all possible combination objects.
 */
function generateCombinationsIterative(criteria: any[]) {
  if (!criteria || criteria.length === 0) {
    // If there are no criteria, there is only one "combination": the empty set.
    return [{}];
  }

  // Start with an array containing one empty object. This represents the base case
  // (the result with no filters applied).
  let combinations = [{}];

  // Sequentially apply each criterion to the growing list of combinations.
  for (const criterion of criteria) {
    const newCombinations = [];
    let effectiveTestValues;

    // Determine the possible values for the current criterion.
    if (criterion.type === 'numericRange') {
      effectiveTestValues = generateNumericRanges(criterion.thresholds || [null], criterion.mode);
    } else { // 'exact' type
      effectiveTestValues = (criterion.testValues && criterion.testValues.length > 0) ? [...criterion.testValues] : [null];
    }
    
    // For each combination we've built so far...
    for (const existingCombo of combinations) {
      // ...combine it with each possible value for the NEW criterion.
      for (const value of effectiveTestValues) {
        if (value === null) {
          // A `null` value means "any", so this new possibility is just the
          // existing combination without the new filter.
          newCombinations.push(existingCombo);
        } else {
          // For a specific value, create a new object by copying the existing
          // one and adding the new filter property.
          const newCombo = { ...existingCombo, [criterion.columnHeader]: value };
          newCombinations.push(newCombo);
        }
      }
    }
    
    // The newly generated set becomes the basis for the next criterion.
    combinations = newCombinations;
  }

  return combinations;
}

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



function generateNumericRanges(thresholds: (number | null)[], mode: string) {
    const ranges: any[] = [];
    if (!thresholds || thresholds.length === 0) return [null];
    const sortedThresholds = thresholds.filter((t): t is number => t !== null).sort((a, b) => a - b);
    
    if (thresholds.includes(null)) ranges.push(null);

    if (mode === "PERMUTATION") {
        for (let i = 0; i < sortedThresholds.length; i++) {
            for (let j = i + 1; j < sortedThresholds.length; j++) {
                ranges.push({ min: sortedThresholds[i], max: sortedThresholds[j] });
            }
        }
    } else if (mode === "MAX") {
        for (const t of sortedThresholds) {
            ranges.push({ max: t });
        }
    } else { // Default range generation
        ranges.push({ max: sortedThresholds[0] });
        for (let i = 0; i < sortedThresholds.length - 1; i++) {
            ranges.push({ min: sortedThresholds[i], max: sortedThresholds[i + 1] });
        }
        ranges.push({ min: sortedThresholds[sortedThresholds.length - 1] });
    }
    return ranges;
}

function applyFilters(trades: Trade[], combination: any) {
    let ltaCombination = false;
    const filteredTrades =  trades.filter(trade => {
        for (const columnHeader in combination) {
            if (columnHeader === "Closed_In_LTA") ltaCombination = true;
            const filterCondition = combination[columnHeader];
            const cellValue = (trade as any)[columnHeader];

            if (typeof filterCondition === 'object' && filterCondition !== null && (filterCondition.min !== undefined || filterCondition.max !== undefined)) { // Numeric range
                if (cellValue === null || isNaN(cellValue)) return false;
                if (filterCondition.min !== undefined && cellValue < filterCondition.min) return false;
                if (filterCondition.max !== undefined && cellValue > filterCondition.max) return false; // Max is exclusive
            } else { // Exact match
                if (cellValue !== filterCondition) return false;
            }
        }
        return true;
    });

    return {filteredTrades, ltaCombination};
}

function calculateMetricsForAllStrategies(trades: Trade[], ltaCombination: boolean, settings: any, combo: any) {
    const resultsByStrategy: { [key: string]: any } = {};
    const overallTradeCount = trades.length;

    let allSetupsFailed = true;
    TRADE_STRATEGIES.forEach(strategy => {
        let wonTrades = 0, grossProfit = 0, grossLoss = 0, strategyTrades = 0;

        if ((ltaCombination && strategy.lta === true) || (!ltaCombination && strategy.lta === false)) {
            trades.forEach(trade => {
                
                const isWin = (trade as any)[strategy.winColumn];
                let tpPips = (trade as any)[strategy.tpPipsColumn] || 0;
                const slPips = (trade as any)[strategy.slPipsColumn] || 0;
                let breakout = false;
                if (strategy.rangeBreakoutColumn !== "") {
                    breakout = (trade as any)[strategy.rangeBreakoutColumn] == true || String((trade as any)[strategy.rangeBreakoutColumn]) === "TRUE";
                    if (!breakout && tpPips === 0) return;
                }

                if (tpPips === 0.0) tpPips = slPips;

                const slToTPRatio = tpPips / slPips;
                if (settings.minSLToTPRatio !== 0 && slToTPRatio < settings.minSLToTPRatio) return;
                if (settings.maxTPToSLRatio !== 0 && slToTPRatio > settings.maxTPToSLRatio) return;
                if (tpPips < 1.0) return;
                
                strategyTrades++;
                
                const moneyPerPip = 100 / slPips;
                const tpMonetary = tpPips * moneyPerPip;

                if (isWin) {
                    wonTrades++;
                    grossProfit += tpMonetary;
                } else {
                    grossLoss += 100;
                }
            });
        } else {
            //console.log("LTA: " + ltaCombination + " but strategy: " + strategy.lta, strategy, combo );
        }  

        if (settings.predefinedFilters.setup == "S2" && strategy.s2 === false) {
            wonTrades = 0, grossProfit = 0, grossLoss = 0, strategyTrades = 0;
        }

        const winRate = strategyTrades > 0 ? wonTrades / strategyTrades : 0;
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);

        const isProfitFactorOk = (profitFactor === Infinity || (isFinite(profitFactor) && profitFactor > settings.minProfitFactor));
        const isWinRateOk = winRate >= ((settings.minWinRate / 100));

        if (isProfitFactorOk && isWinRateOk) {
            allSetupsFailed = false;
            //console.log("Not All Setups Failed PF: " + profitFactor + "-> MIN: " + settings.minProfitFactor + ", WR: " + winRate + "-> MIN: " + settings.minWinRate);
        }

        resultsByStrategy[strategy.name] = {
            winRate,
            profitFactor,
            totalTradesThisStrategy: strategyTrades,
            wonTrades,
            lostTrades: strategyTrades - wonTrades,
            grossProfit,
            grossLoss,
            netProfit: grossProfit - grossLoss,
        };
    });

    if (allSetupsFailed) return { undefined, overallTradeCount};

    return { resultsByStrategy, overallTradeCount };
}

function calculateCompositeScore(metrics: any, weights: any) {
    if (!metrics || metrics.totalTradesThisStrategy === 0) return -Infinity;
    if (metrics.netProfit < 0) return -Infinity; // Don't rank losing strategies

    let score = 0;
    const pfValue = metrics.profitFactor;
    let pfScoreContribution = 0;
    
    if (pfValue === Infinity) pfScoreContribution = 10;
    else if (isFinite(pfValue)) pfScoreContribution = Math.min(pfValue, 10);
    
    score += pfScoreContribution * (weights.profitFactor || 0);
    score += metrics.winRate * (weights.winRate || 0);
    score += Math.log1p(metrics.totalTradesThisStrategy) * (weights.tradeCount || 0);
    score += (metrics.netProfit / (metrics.totalTradesThisStrategy || 1)) * (weights.netProfitPips || 0);

    return isNaN(score) ? -Infinity : score;
}

function timeToMinutes(timeValue: string): number {
    if (typeof timeValue !== 'string') return NaN;
    const parts = timeValue.split(':');
    if (parts.length >= 2) {
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        if (!isNaN(hours) && !isNaN(minutes)) {
            return hours * 60 + minutes;
        }
    }
    return NaN;
}

function applyPredefinedFilters(trades: Trade[], filters: any[]): Trade[] {
    if (!filters || filters.length === 0) {
        return trades;
    }

    return trades.filter(trade => {
        // A trade is valid if it passes *every* filter in the array.
        //trades.filter(t => t.Entered && (t as any)['Canceled_After_Candles'] === 0
        if (!trade.Entered) return false;
        if (trade.Canceled_After_Candles > 0) return false;
        for (const filter of filters) {
            const cellValue = (trade as any)[filter.columnHeader];

            if (filter.type === 'exact') {
                // For booleans, the condition from the frontend will be `true`.
                // For strings (like Session/Setup), it will be the string value.
                if (cellValue !== filter.condition) {
                    return false; // Fails this filter, so exclude the trade.
                }
            }
            else if (filter.type === 'timeRange') {
                const tradeTimeInMinutes = timeToMinutes(trade.Time);
                if (isNaN(tradeTimeInMinutes)) {
                    return false; // Trade has invalid time format.
                }

                const minTimeInMinutes = filter.condition.minMinutes ? timeToMinutes(filter.condition.minMinutes) : -Infinity;
                const maxTimeInMinutes = filter.condition.maxMinutes ? timeToMinutes(filter.condition.maxMinutes) : Infinity;

                if (tradeTimeInMinutes < minTimeInMinutes || tradeTimeInMinutes > maxTimeInMinutes) {
                    return false; // Fails the time range check.
                }
            }
            else if (filter.type === 'numericRange') {
                 // This type isn't used by your current form but is included for completeness.
                if (cellValue === null || isNaN(cellValue)) return false;
                if (filter.condition.min !== undefined && cellValue < filter.condition.min) return false;
                if (filter.condition.max !== undefined && cellValue >= filter.condition.max) return false;
            }
        }
        // If the trade survived all the filters, include it.
        return true;
    });
}

// The Redis client must be created inside the sandboxed process.
const redisClient = new IORedis(redisConnection);

// ===================================================================================
//  The Sub-Optimization function, now inside the sandbox.
// ===================================================================================
async function runOptimizationForTimeWindow(
    preFilteredTrades: Trade[],
    settings: any,
    timeWindow: { min: string; max: string } | null,
    singleTimeWindow: boolean,
    totalCombinations: number,
    job: SandboxedJob 
): Promise<any[]> {
    console.log(`--- Starting Sub-Run for Time Window: ${timeWindow ? `${timeWindow.min} - ${timeWindow.max}` : 'Any'} ---`);

    // 1. Apply the specific time window filter for this sub-run
    const timeFilteredTrades = applyPredefinedFilters(preFilteredTrades, [{
        type: 'timeRange',
        condition: { minMinutes: timeWindow?.min, maxMinutes: timeWindow?.max }
    }]);

    console.log(`Trades in this time window: ${timeFilteredTrades.length}`);
    if (timeFilteredTrades.length < (settings.minTradeCount || 5)) {
        console.log(`--- Sub-Run skipped due to insufficient trades. ---`);
        return []; // Return empty array if not enough trades
    }

    // 2. Generate combinations (this is now much faster as it's done once per master run)
    const enabledCombinationDefs = SELECTABLE_COMBINATIONS.filter(def => 
        settings.combinationsToTest.includes(def.name)
    );
    const combinatorialCriteria = enabledCombinationDefs.flatMap(def => def.criterias);
    console.log('Generate combinations in this time window...');

     // No large array is created here. This is an instantaneous operation.
    const combinationGenerator = generateCombinationsGenerator(combinatorialCriteria, 0, {});
    //const combinations = generateCombinationsIterative(combinatorialCriteria);
    //const totalCombinations = Math.min(combinations.length, settings.maxCombinationsToTest || 100000);
    
    //console.log(`Total Combinations generated: ${totalCombinations}`);
    // 3. Loop and Score for this time window
    const resultsForThisWindow = [];
    let combosTested = 0;
    for (const combo of combinationGenerator) {
        //const combo = combinations[i];
        // Add the time window to the combination so we know where this result came from
        const comboWithTime = { ...combo, TimeWindow: timeWindow ? `${timeWindow.min}-${timeWindow.max}` : 'Any' };
        
        const { filteredTrades, ltaCombination } = applyFilters(timeFilteredTrades, combo);
        if (filteredTrades.length < (settings.minTradeCount || 5)) continue;

        const { resultsByStrategy, overallTradeCount } = calculateMetricsForAllStrategies(filteredTrades, ltaCombination, settings, combo);
        if (!resultsByStrategy) continue;

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
            resultsForThisWindow.push({
                combination: comboWithTime, // Save the combination that includes the time window
                overallScore,
                overallTradeCount,
                metrics: resultsByStrategy,
                strategyScores,
            });
        }
        combosTested = combosTested + 1;
        if (combosTested % 500 === 0 && combosTested > 0) {
                console.log(`${new Date().toLocaleString()}} Tested ${combosTested} / ${totalCombinations} combinations...`);
                
                const progress = Math.round((combosTested / totalCombinations) * 100);
                await job.updateProgress(Math.min(progress, 100));
            }
        
        


        // Yield event loop between heavy tasks
        await new Promise(resolve => setImmediate(resolve)); 
    }
    console.log(`--- Sub-Run finished, found ${resultsForThisWindow.length} valid combinations. ---`);
    return resultsForThisWindow;
}


// ===================================================================================
//  The Master Optimization function, now the main export of the sandbox.
// ===================================================================================
// The function signature MUST match what BullMQ expects for a sandboxed processor.
export default async function (job: SandboxedJob): Promise<any> {
    // Initialize the database connection for THIS process.
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }
    
    // This is the entire 'runOptimization' function from the previous step.
    // Its logic is IDENTICAL.
    const startTime = new Date();
    const { configId } = job.data;
        console.log(`MASTER JOB ${job.id} STARTED for config ID: ${configId} at: ${new Date().toLocaleString()}`);
    
        const configRepo = AppDataSource.getRepository(Configuration);
        const tradeRepo = AppDataSource.getRepository(Trade);
        const resultRepo = AppDataSource.getRepository(OptimizationResult);
    
        try {
            // --- Step 1: Initialize State and Configuration ---
            const config = await configRepo.findOneBy({ id: configId });
            if (!config) throw new Error(`Config ${configId} not found.`);
            const settings = config.settings as any;
    
            // --- THIS IS THE FAST CALCULATION STEP ---
            const enabledCombinationDefs = SELECTABLE_COMBINATIONS.filter(def => 
                settings.combinationsToTest.includes(def.name)
            );
            const combinatorialCriteria = enabledCombinationDefs.flatMap(def => def.criterias);
            
            // Call the counting function before doing anything else.
            const totalCombinations = countTotalCombinations(combinatorialCriteria);
            console.log(`Calculated total combinations for this run: ${totalCombinations}`);
    
            // --- UPDATE THE JOB DATA ---
            // Now you can update the job with the *actual* total, not the max limit.
            await job.updateData({
                ...job.data,
                totalCombinations: totalCombinations,
                processedCombinations: 0
            });
    
            // --- CORE RESUME LOGIC ---
            // Check if we are resuming a previously started job.
            const isResuming = !!job.data.state;
            // Initialize state either from the existing job data or as a new object.
            const state = job.data.state || {
                completedTimeWindows: [],
                aggregatedResults: [],
            };
    
            if (isResuming) {
                console.log(`Resuming job ${job.id}. State found:`, state);
            }
    
            // --- Step 2: Fetch and Pre-filter data ONCE ---
            let allTrades = await tradeRepo.find();
            let nonTimeFilters = settings.predefinedFilters;
            if (settings.enableTimeShift) {
                nonTimeFilters = settings.predefinedFilters.filter((f: any) => f.type !== 'timeRange');
            }
            const preFilteredTrades = applyPredefinedFilters(allTrades, nonTimeFilters);
            
            // --- Step 3: Generate the full list of time windows to test ---
            const timeWindowsToTest = [];
            const baseTimeFilter = settings.predefinedFilters.find((f: any) => f.type === 'timeRange');
            const baseTime = baseTimeFilter?.condition;
            if (baseTime && baseTime.minMinutes && baseTime.maxMinutes) {
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
    
            console.log("Full list of time windows to test:", timeWindowsToTest);
            
            // --- Step 4: Loop through windows, skipping completed ones ---
            let completedRunsInThisSession = 0;
            for (const timeWindow of timeWindowsToTest) {
                const windowId = timeWindow ? `${timeWindow.min}-${timeWindow.max}` : 'Any';
    
                // --- CORE RESUME LOGIC ---
                if (state.completedTimeWindows.includes(windowId)) {
                    console.log(`Skipping already completed time window: ${windowId}`);
                    continue; // Skip to the next window
                }
    
                // Run the sub-optimization for the current window
                const windowResults = await runOptimizationForTimeWindow(preFilteredTrades, settings, timeWindow, timeWindowsToTest.length === 1, totalCombinations, job);
                
                // Add the new results to our persistent state object
                state.aggregatedResults.push(...windowResults);
                state.completedTimeWindows.push(windowId);
                completedRunsInThisSession++;
    
                // --- CHECKPOINT: Save the updated state back to the job ---
                // This is the most critical step for resiliency.
                await job.updateData({ ...job.data, state: state });
                console.log(`CHECKPOINT SAVED for job ${job.id}. Completed window: ${windowId}`);
    
                // Update master job progress
                const totalProgress = (state.completedTimeWindows.length / timeWindowsToTest.length) * 100;
                await job.updateProgress(Math.min(totalProgress, 100));
                
                // Yield event loop between heavy tasks
                await new Promise(resolve => setImmediate(resolve)); 
            }
            
            // --- Step 5: Finalize and Save Overall Best Results ---
            console.log(`All sub-runs complete. Total valid combinations found: ${state.aggregatedResults.length}`);
            state.aggregatedResults.sort((a, b) => b.overallScore - a.overallScore);
            const topResults = state.aggregatedResults.slice(0, 100);
    
            const newResult = resultRepo.create({
                configuration: config,
                results: topResults,
                startedAt: startTime,
            });
            await resultRepo.save(newResult);
            console.log(`MASTER JOB FINISHED. Saved top ${topResults.length} overall results.`);
            
            await job.updateProgress(100);
            return { success: true, validCombinations: state.aggregatedResults.length };
    
        } catch (error) {
            console.error(`MASTER JOB ${job.id} FAILED:`, error);
            throw error; // Re-throw to make BullMQ mark it as failed
        }
    console.log(`--- MASTER JOB ${job.id} on Process ${process.pid} FINISHED ---`);
    return { success: true };
};