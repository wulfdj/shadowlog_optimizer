package optimizer

import (
	"encoding/json"
	"fmt"
	"go-optimizer/utils"
	"log"
	"math"
	"os"
	"reflect"
	"sort"
	"strings"
)

var debugLog = log.New(os.Stderr, "[Go-Optimizer-Debug] ", log.Ltime)

// reflection-based Helper to get a field value from a Trade struct.
func getField(v *Trade, field string) reflect.Value {
	r := reflect.ValueOf(v)
	f := reflect.Indirect(r).FieldByName(field)
	return f
}

// ApplyFilters takes a list of trades and a combination, returning the trades that match.
func ApplyFilters(trades []Trade, combo Combination) ([]Trade, bool) {
	// ... (code from original applyFilters, no changes, but ensure it uses utils.TimeToMinutes) ...
	var filteredTrades []Trade
	ltaCombination := false
	if _, ok := combo["Closed_In_LTA"]; ok {
		ltaCombination = true
	}

tradeLoop:
	for _, trade := range trades {
		for key, condition := range combo {
			if key == "TimeFilter" {
				timeConditionMap, ok := condition.(map[string]int)
				if !ok {
					continue tradeLoop
				}

				tradeTime, err := utils.TimeToMinutes(trade.Time)
				if err != nil {
					continue tradeLoop
				}

				minVal, minOk := timeConditionMap["minMinutes"]
				maxVal, maxOk := timeConditionMap["maxMinutes"]

				if minOk && tradeTime < minVal {
					continue tradeLoop
				}
				if maxOk && tradeTime > maxVal {
					continue tradeLoop
				}
				continue
			}
			var tradeValue reflect.Value
			if strings.Contains(key, "|") {
				parts := strings.Split(key, "|")
				if trade.Direction == "BUY" {
					tradeValue = getField(&trade, parts[0])
				} else {
					tradeValue = getField(&trade, parts[1])
				}
			}

			tradeValue = getField(&trade, key)
			if !tradeValue.IsValid() {
				continue
			}
			switch cond := condition.(type) {
			case bool:
				if tradeValue.Bool() != cond {
					continue tradeLoop
				}
			case map[string]float64: // For numeric ranges
				min, minOk := cond["min"]
				max, maxOk := cond["max"]
				var val float64
				if tradeValue.CanInt() {
					val = float64(tradeValue.Int())
				} else if tradeValue.CanFloat() {
					val = tradeValue.Float()
				}
				if minOk && val < min {
					continue tradeLoop
				}
				if maxOk && val > max {
					continue tradeLoop
				}
			}
		}
		filteredTrades = append(filteredTrades, trade)
	}
	return filteredTrades, ltaCombination
}

// CalculateMetrics computes all strategy metrics for a given set of trades.
func CalculateMetrics(trades []Trade, ltaCombination bool, settings map[string]interface{}) map[string]StrategyMetrics {
	// ... (code from original calculateMetrics, no changes needed) ...
	results := make(map[string]StrategyMetrics)
	allSetupsFailed := true

	minSLToTPRatio, _ := settings["minSLToTPRatio"].(float64)
	maxTPToSLRatio, _ := settings["maxTPToSLRatio"].(float64)
	minWinRate, _ := settings["minWinRate"].(float64)
	minProfitFactor, _ := settings["minProfitFactor"].(float64)
	predefinedSetup, _ := settings["predefinedSetup"].(string)

	for _, strategy := range TradeStrategies {
		name := strategy["name"].(string)
		isLTA := strategy["lta"].(bool)
		isS2 := strategy["s2"].(bool)

		wonTrades, grossProfit, grossLoss, strategyTrades := 0, 0.0, 0.0, 0

		if (ltaCombination && isLTA) || (!ltaCombination && !isLTA) {
			for _, trade := range trades {
				isWin := getField(&trade, strategy["winColumn"].(string)).Bool()
				tpPips := getField(&trade, strategy["tpPipsColumn"].(string)).Float()
				slPips := getField(&trade, strategy["slPipsColumn"].(string)).Float()

				if slPips == 0 {
					continue
				}
				if tpPips == 0 {
					tpPips = slPips
				}

				ratio := tpPips / slPips
				if minSLToTPRatio != 0 && ratio < minSLToTPRatio {
					continue
				}
				if maxTPToSLRatio != 0 && ratio > maxTPToSLRatio {
					continue
				}
				if tpPips < 1.0 {
					continue
				}

				strategyTrades++
				moneyPerPip := 100.0 / slPips
				if isWin {
					wonTrades++
					grossProfit += tpPips * moneyPerPip
				} else {
					grossLoss += 100.0
				}
			}
		}
		if predefinedSetup == "S2" && !isS2 {
			wonTrades, grossProfit, grossLoss, strategyTrades = 0, 0.0, 0.0, 0
		}

		winRate := 0.0
		if strategyTrades > 0 {
			winRate = float64(wonTrades) / float64(strategyTrades)
		}

		profitFactor := 0.0
		if grossLoss > 0 {
			profitFactor = grossProfit / grossLoss
		} else if grossProfit > 0 {
			profitFactor = math.Inf(1)
		}

		if (profitFactor >= minProfitFactor || profitFactor == math.Inf(1)) && (winRate*100 >= minWinRate) {
			allSetupsFailed = false
		}

		results[name] = StrategyMetrics{
			WinRate:                 winRate,
			ProfitFactor:            profitFactor,
			TotalTradesThisStrategy: strategyTrades,
			NetProfit:               grossProfit - grossLoss,
		}
	}
	if allSetupsFailed {
		return nil
	}
	return results
}

// CalculateCompositeScore calculates the final weighted score for a strategy's performance.
func CalculateCompositeScore(metrics StrategyMetrics, weights map[string]interface{}) float64 {
	// ... (code from original calculateCompositeScore, no changes needed) ...
	if metrics.TotalTradesThisStrategy == 0 || metrics.NetProfit < 0 {
		return math.Inf(-1)
	}
	pfWeight, _ := weights["profitFactor"].(float64)
	wrWeight, _ := weights["winRate"].(float64)
	tcWeight, _ := weights["tradeCount"].(float64)
	npWeight, _ := weights["netProfitPips"].(float64)

	pfScore := 0.0
	if metrics.ProfitFactor == math.Inf(1) {
		pfScore = 10.0
	} else if !math.IsNaN(metrics.ProfitFactor) {
		pfScore = math.Min(metrics.ProfitFactor, 10.0)
	}

	score := (pfScore * pfWeight) +
		(metrics.WinRate * wrWeight) +
		(math.Log1p(float64(metrics.TotalTradesThisStrategy)) * tcWeight) +
		((metrics.NetProfit / float64(metrics.TotalTradesThisStrategy)) * npWeight)

	if math.IsNaN(score) {
		return -1.0
	}
	return score
}

// --- The main pre-filtering logic ---
func ApplyPredefinedFilters(trades []Trade, filters []interface{}) []Trade {
	if len(filters) == 0 {
		return trades
	}

	var filteredTrades []Trade

tradeLoop:
	for i := range trades {
		trade := &trades[i] // Use pointer to avoid copying
		entered := getField(trade, "Entered")
		if !entered.Bool() {
			continue
		}

		// A trade must pass ALL filters to be included
		for _, filterInterface := range filters {
			filter := filterInterface.(map[string]interface{})
			filterType := filter["type"].(string)

			if filterType == "exact" {
				columnHeader := filter["columnHeader"].(string)
				condition := filter["condition"]
				tradeValue := getField(trade, columnHeader)

				if !tradeValue.IsValid() {
					continue
				}

				// Compare based on type
				switch cond := condition.(type) {
				case bool:
					if tradeValue.Bool() != cond {
						continue tradeLoop
					}
				case string:
					if tradeValue.String() != cond {
						continue tradeLoop
					}
				}
			} else if filterType == "timeRange" {
				// The trade's Time field is not in the Trade struct, needs to be added if this filter is used.
				// For now, this is a placeholder. You would add `Time string` to your Trade struct.
				tradeTime, err := utils.TimeToMinutes(trade.Time)
				if err != nil {
					continue tradeLoop
				}

				condition := filter["condition"].(map[string]interface{})
				min, minOk := condition["minMinutes"].(string)
				max, maxOk := condition["maxMinutes"].(string)

				if minOk {
					minMins, _ := utils.TimeToMinutes(min)
					if tradeTime < minMins {
						continue tradeLoop
					}
				}
				if maxOk {
					maxMins, _ := utils.TimeToMinutes(max)
					if tradeTime > maxMins {
						continue tradeLoop
					}
				}
			}
		}
		// If the trade survived all filters, add it to the result slice
		filteredTrades = append(filteredTrades, *trade)
	}
	return filteredTrades
}

// extractTimeWindowFromFilters is a private helper to find a time range filter.
func extractTimeWindowFromFilters(filters []interface{}) (minStr, maxStr string, found bool) {
	for _, filterInterface := range filters {
		filter, ok := filterInterface.(map[string]interface{})
		if !ok {
			continue
		}

		if filter["columnHeader"] == "Time" && filter["type"] == "timeRange" {
			condition, ok := filter["condition"].(map[string]interface{})
			if !ok {
				return "", "", false
			}

			min, _ := condition["minMinutes"].(string)
			max, _ := condition["maxMinutes"].(string)
			return min, max, true
		}
	}
	return "", "", false
}

// removeTimeFilter is a private helper that returns a new slice of filters without the time range filter.
func removeTimeFilter(filters []interface{}) []interface{} {
	var filtered []interface{}
	for _, filterInterface := range filters {
		filterMap, ok := filterInterface.(map[string]interface{})
		if !ok {
			filtered = append(filtered, filterInterface)
			continue
		}
		if filterMap["columnHeader"] == "Time" && filterMap["type"] == "timeRange" {
			continue // Skip
		}
		filtered = append(filtered, filterInterface)
	}
	return filtered
}

// PrepareTradesForAnalysis handles the initial data preparation, including applying
// predefined filters and extracting the base time window for optimization.
func PrepareTradesForAnalysis(allTrades []Trade, settings map[string]interface{}) ([]Trade, []map[string]int, error) {
	predefinedFilters, ok := settings["predefinedFilters"].([]interface{})
	if !ok {
		return nil, nil, fmt.Errorf("'predefinedFilters' setting is missing or not an array")
	}

	enableTimeShift, _ := settings["enableTimeShift"].(bool)
	var timeWindowVariations []map[string]int

	// Extract base time window if time shift is enabled
	if enableTimeShift {
		minStr, maxStr, found := extractTimeWindowFromFilters(predefinedFilters)
		if found {
			debugLog.Println("Time shift enabled, removing timeRange from predefined filters.")
			predefinedFilters = removeTimeFilter(predefinedFilters)

			baseMinMinutes, errMin := utils.TimeToMinutes(minStr)
			baseMaxMinutes, errMax := utils.TimeToMinutes(maxStr)
			if errMin != nil || errMax != nil {
				return nil, nil, fmt.Errorf("invalid time format in timeRange filter")
			}

			// These settings should ideally come from the config file itself
			minShiftHours := -1.0
			maxShiftHours := 1.0
			stepMinutes := 60

			timeWindowVariations = GenerateTimeWindows(baseMinMinutes, baseMaxMinutes, minShiftHours, maxShiftHours, int(stepMinutes))
			debugLog.Printf("Generated %d time window variations.", len(timeWindowVariations))
		}
	}

	// Apply the remaining predefined filters
	var filteredTrades []Trade
	filteredTrades = ApplyPredefinedFilters(allTrades, predefinedFilters)
	return filteredTrades, timeWindowVariations, nil
}

// ProcessFinalResults sorts and filters the raw results from workers to get the top N for each strategy.
func ProcessFinalResultsSimple(rawResults []Result) []Result {
	if len(rawResults) == 0 {
		return []Result{}
	}

	topResultsPerStrategy := make(map[string][]Result)

	for _, strategy := range TradeStrategies {
		strategyName := strategy["name"].(string)
		var relevantResults []Result
		for _, res := range rawResults {
			if score, ok := res.StrategyScores[strategyName]; ok && !math.IsInf(score, 0) && score > 0 {
				relevantResults = append(relevantResults, res)
			}
		}

		// Sort relevant results by this strategy's specific score, descending
		sort.Slice(relevantResults, func(i, j int) bool {
			scoreI := relevantResults[i].StrategyScores[strategyName]
			scoreJ := relevantResults[j].StrategyScores[strategyName]
			return scoreI > scoreJ
		})

		// Keep only the top 10
		if len(relevantResults) > 10 {
			relevantResults = relevantResults[:10]
		}
		if len(relevantResults) > 0 {
			topResultsPerStrategy[strategyName] = relevantResults
		}
	}

	// Flatten the map into a final list for output
	var endResults []Result
	for _, results := range topResultsPerStrategy {
		endResults = append(endResults, results...)
	}

	return endResults
}

// extractMaxFromCombo is a small, safe helper to get the 'max' value from a numeric range filter in a combination.
func extractMaxFromCombo(combo Combination, key string) (float64, bool) {
	// 1. Check if the key (e.g., "Breakout_Distance") exists in the combination.
	val, ok := combo[key]
	if !ok {
		return 0, false
	}

	// 2. Safely assert the type to a map representing the numeric range.
	rangeMap, ok := val.(map[string]float64)
	if !ok {
		return 0, false
	}

	// 3. Get the 'max' value from that map.
	maxVal, ok := rangeMap["max"]
	if !ok {
		// This handles cases where there might be only a "min"
		return 0, false
	}

	return maxVal, true
}

// --- MODIFIED FUNCTION ---
// ProcessFinalResults sorts and filters the raw results to get the top N for each strategy.
func ProcessFinalResults(rawResults []Result) []Result {
	if len(rawResults) == 0 {
		return []Result{}
	}

	// Define the order of importance for tie-breaking.
	// We will prioritize maximizing the 'max' value of these keys in this order.
	var tieBreakerKeys = []string{
		"Breakout_Distance",
		"Entry_Distance",
		"Candle_Size",
		"Breakout_Candle_Count",
	}

	topResultsPerStrategy := make(map[string][]Result)

	for _, strategy := range TradeStrategies {
		strategyName := strategy["name"].(string)
		var relevantResults []Result
		for _, res := range rawResults {
			if score, ok := res.StrategyScores[strategyName]; ok && !math.IsInf(score, 0) && score > 0 {
				relevantResults = append(relevantResults, res)
			}
		}

		// *** MODIFIED SORTING LOGIC ***
		sort.Slice(relevantResults, func(i, j int) bool {
			resI := relevantResults[i]
			resJ := relevantResults[j]
			scoreI := resI.StrategyScores[strategyName]
			scoreJ := resJ.StrategyScores[strategyName]

			// Layer 1: Primary sort by score.
			if scoreI != scoreJ {
				return scoreI > scoreJ
			}

			// Layer 2: Tie-breaker logic if scores are equal.
			for _, key := range tieBreakerKeys {
				maxI, okI := extractMaxFromCombo(resI.Combination, key)
				maxJ, okJ := extractMaxFromCombo(resJ.Combination, key)

				// Only compare if both combinations have this tie-breaker key.
				if okI && okJ {
					if maxI != maxJ {
						// The user wants the one with the HIGHER max value to be ranked higher (return true).
						return maxI > maxJ
					}
				}
			}

			// Layer 3: Final fallback for deterministic sorting if all else is equal.
			// This prevents results from shuffling between runs.
			comboIBytes, _ := json.Marshal(resI.Combination)
			comboJBytes, _ := json.Marshal(resJ.Combination)
			return string(comboIBytes) < string(comboJBytes) // Arbitrary but stable
		})
		// *** END OF MODIFIED SORTING LOGIC ***

		// Keep only the top 10
		if len(relevantResults) > 10 {
			relevantResults = relevantResults[:10]
		}
		if len(relevantResults) > 0 {
			topResultsPerStrategy[strategyName] = relevantResults
		}
	}

	// --- NEW DEDUPLICATION LOGIC STARTS HERE ---

	// 1. Gather all top candidates into a single slice.
	var allTopCandidates []Result
	for _, results := range topResultsPerStrategy {
		allTopCandidates = append(allTopCandidates, results...)
	}

	// 2. Sort the entire candidate list by OverallScore first. This is crucial.
	// This ensures that the first time we see a combination, it's its best-scoring version.
	sort.Slice(allTopCandidates, func(i, j int) bool {
		return allTopCandidates[i].OverallScore > allTopCandidates[j].OverallScore
	})

	// 3. Deduplicate the sorted list.
	var finalResults []Result
	seenCombinations := make(map[string]struct{}) // Use a map as a "set" for efficiency.

	for _, result := range allTopCandidates {
		// Create a unique, canonical key for the combination map by marshaling it to JSON.
		comboKey, err := json.Marshal(result.Combination)
		if err != nil {
			continue // Should not happen, but good practice to handle
		}

		// Check if we have already added a result for this exact combination.
		if _, seen := seenCombinations[string(comboKey)]; !seen {
			// If not seen, add it to our final list...
			finalResults = append(finalResults, result)
			// ...and mark this combination as seen.
			seenCombinations[string(comboKey)] = struct{}{}
		}
	}

	// *** NEW/MODIFIED SECTION: Final Robust Sort ***
	// Apply the same detailed, multi-layer tie-breaking sort to the final, deduplicated list.
	// This ensures the final ranking is consistent and respects all tie-breaker rules.
	sort.Slice(finalResults, func(i, j int) bool {
		resI := finalResults[i]
		resJ := finalResults[j]
		scoreI := resI.OverallScore
		scoreJ := resJ.OverallScore

		// Layer 1: Primary sort by the overall score.
		if scoreI != scoreJ {
			return scoreI > scoreJ
		}

		// Layer 2: Tie-breaker logic if scores are equal.
		for _, key := range tieBreakerKeys {
			maxI, okI := extractMaxFromCombo(resI.Combination, key)
			maxJ, okJ := extractMaxFromCombo(resJ.Combination, key)

			if okI && okJ {
				if maxI != maxJ {
					// Rank the one with the HIGHER max value higher.
					return maxI > maxJ
				}
			}
		}

		// Layer 3: Final fallback for deterministic sorting.
		comboIBytes, _ := json.Marshal(resI.Combination)
		comboJBytes, _ := json.Marshal(resJ.Combination)
		return string(comboIBytes) < string(comboJBytes)
	})

	return finalResults
}
