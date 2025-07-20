package optimizer

import (
	"math"
	"runtime/debug"
	"sync"
	"sync/atomic"
)

// CombinationWorker is the main processing goroutine. It receives jobs, applies filters,
// calculates metrics, and sends valid results to the results channel.
func CombinationWorker(
	id int,
	jobs <-chan Combination,
	results chan<- Result,
	wg *sync.WaitGroup,
	inputData *InputData,
	processedCounter *uint64,
) {
	defer wg.Done()
	defer func() {
		if r := recover(); r != nil {
			debugLog.Printf("Worker %d PANIC: %v. Stack: %s", id, r, debug.Stack())
		}
	}()
	jobCount := 0
	for combo := range jobs {
		jobCount += 1
		if jobCount%1000 == 0 { // Can make this less frequent
			debugLog.Printf("Worker %d processed %d jobs...", id, jobCount)
		}

		filteredTrades, ltaCombination := ApplyFilters(inputData.Trades, combo)
		if len(filteredTrades) < int(inputData.Config.Settings["minTradeCount"].(float64)) {
			atomic.AddUint64(processedCounter, 1)
			continue
		}

		metrics := CalculateMetrics(filteredTrades, ltaCombination, inputData.Config.Settings)
		if metrics == nil {
			atomic.AddUint64(processedCounter, 1)
			continue
		}

		scores := make(map[string]float64)
		sumOfScores, scoredStrategies := 0.0, 0
		weights := inputData.Config.Settings["rankingWeights"].(map[string]interface{})

		for name, metric := range metrics {
			score := CalculateCompositeScore(metric, weights)
			scores[name] = score
			if !math.IsInf(score, 0) {
				sumOfScores += score
				scoredStrategies++
			}
		}

		overallScore := math.Inf(-1)
		if scoredStrategies > 0 {
			overallScore = sumOfScores / float64(scoredStrategies)
		}

		if !math.IsInf(overallScore, 0) {
			results <- Result{
				Combination:       combo,
				OverallScore:      overallScore,
				OverallTradeCount: len(filteredTrades),
				Metrics:           metrics,
				StrategyScores:    scores,
			}
		}
		atomic.AddUint64(processedCounter, 1)
	}
}
