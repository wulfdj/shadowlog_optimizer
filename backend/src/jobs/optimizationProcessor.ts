import { Job } from 'bullmq';
import { AppDataSource } from '../database/data-source';
import { Configuration } from '../entities/Configuration';
import { Trade } from '../entities/Trade';
import { OptimizationResult } from '../entities/OptimizationResult';

// --- Ported SCRIPT_CONFIG Constants ---
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


export const runOptimization = async (job: Job) => {
    const startTime = new Date();
    const { configId } = job.data;
    console.log(`Worker processing job ${job.id} for config ID: ${configId} at ${startTime.toISOString()}`);
    

    const configRepo = AppDataSource.getRepository(Configuration);
    const tradeRepo = AppDataSource.getRepository(Trade);
    const resultRepo = AppDataSource.getRepository(OptimizationResult);

    try {
        const config = await configRepo.findOneBy({ id: configId });
        if (!config) throw new Error(`Config ${configId} not found.`);

        const settings = config.settings as any;
        console.log("Config: ", settings);
        // Fetch all trades for the specified timeframe (e.g., '5M', '15M').
        // You would need a column in your Trade entity to store the timeframe
        // if you were supporting multiple timeframes in one table.
        // For now, we assume all data is for the intended timeframe.
        let allTrades = await tradeRepo.find();
        console.log(`Fetched ${allTrades.length} total trades from the database.`);

        // 1. Apply Predefined Filters (THE CORE CHANGE)
        const preFilteredTrades = applyPredefinedFilters(allTrades, settings.predefinedFilters);
        console.log(`Trades after applying predefined filters: ${preFilteredTrades.length}`);

        if (preFilteredTrades.length === 0) {
            console.log("No trades remained after pre-filtering. Aborting optimization.");
            await job.updateProgress(100);
            // Optionally save a result indicating no data was found
            const emptyResult = resultRepo.create({
                configuration: config,
                results: { message: "No trades matched the predefined filters." },
            });
            await resultRepo.save(emptyResult);
            return { success: true, validCombinations: 0, message: "No trades matched predefined filters." };
        }

        // 2. Generate Combinations to Test (No changes here)
        const enabledCombinationDefs = SELECTABLE_COMBINATIONS.filter(def => 
            settings.combinationsToTest.includes(def.name)
        );
        const combinatorialCriteria = enabledCombinationDefs.flatMap(def => def.criterias);
        const combinations = generateCombinationsIterative(combinatorialCriteria); //generateCombinations(combinatorialCriteria, 0, {});

        //console.log(combinations);

        const totalCombinations = Math.min(combinations.length, settings.maxCombinationsToTest || 100000);
        console.log(`Generated ${totalCombinations} combinations to test.`);

        await job.updateData({
            ...job.data,
            totalCombinations: totalCombinations
        });
        await job.updateProgress(0);
        // 3. Loop, Calculate, and Score (No changes here)
        const results = [];
        for (let i = 0; i < totalCombinations; i++) {
            const combo = combinations[i];
            const { filteredTrades, ltaCombination } = applyFilters(preFilteredTrades, combo);
            
            if (filteredTrades.length < (settings.minTradeCount || 5)) continue;
            if (ltaCombination) {
                //console.log("Combo has LTA: ", combo);
            }
            
            const { resultsByStrategy, overallTradeCount } = calculateMetricsForAllStrategies(filteredTrades, ltaCombination, settings, combo);
            if (resultsByStrategy === null || resultsByStrategy === undefined) {
                //console.log("combination has no valid results: ", combo);
                if (i % 500 === 0) { // Update progress less frequently
                    const progress = Math.round((i / totalCombinations) * 100);
                    await job.updateProgress(Math.min(progress, 100));
                }
                continue;
            }
            
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
                results.push({
                    combination: combo,
                    overallScore,
                    overallTradeCount,
                    metrics: resultsByStrategy,
                    strategyScores,
                });
            }
            
            // --- CORE FIX 2: Periodically yield the event loop ---
            if (i % 500 === 0 && i > 0) {
                console.log(`Tested ${i} / ${totalCombinations} combinations...`);
                
                const progress = Math.round((i / totalCombinations) * 100);
                await job.updateProgress(Math.min(progress, 100));

                // This is the key line. It pauses the loop for a "tick",
                // allowing pending operations like the lock renewal to execute.
                await new Promise(resolve => setImmediate(resolve));
            }
        }

        // 4. Sort and Save Top Results (No changes here)
        results.sort((a, b) => b.overallScore - a.overallScore);
        const topResults = results.slice(0, 100);
        console.log(`Optimization finished. Found ${results.length} valid combinations. Best score: ${topResults[0]?.overallScore || 'N/A'}`);

        const newResult = resultRepo.create({
            configuration: config,
            results: topResults,
            startedAt: startTime,
        });
        await resultRepo.save(newResult);
        console.log(`Saved top ${topResults.length} results to database for config ${configId}.`);

        await job.updateProgress(100);
        return { success: true, validCombinations: results.length };

    } catch (error) {
        console.error(`Job ${job.id} failed:`, error);
        throw error;
    }
};