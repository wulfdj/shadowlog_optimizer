package optimizer

import (
	"encoding/json"
	"fmt" // Import from our new utils package
	"runtime/debug"
	"sort"
	"sync"
)

// generateTimeWindows generates a list of time window configurations based on a base window and shift parameters.
// Each generated window is a map with "minMinutes" and "maxMinutes" keys as integers.
func GenerateTimeWindows(baseMin, baseMax int, minShiftHours, maxShiftHours float64, stepMinutes int) []map[string]int {
	var timeWindows []map[string]int

	// Use a map to ensure uniqueness of generated time windows (min-max pairs)
	uniqueWindows := make(map[string]struct{})

	minShiftMins := int(minShiftHours * 60)
	maxShiftMins := int(maxShiftHours * 60)

	// Generate possible shifts for both start and end times
	var offsets []int
	// Include 0 offset to ensure the base window itself is always considered
	for offset := minShiftMins; offset <= maxShiftMins; offset += stepMinutes {
		offsets = append(offsets, offset)
	}

	// Always add the original base window first
	originalWindow := map[string]int{"minMinutes": baseMin, "maxMinutes": baseMax}
	windowKey := fmt.Sprintf("%d-%d", baseMin, baseMax)
	if _, exists := uniqueWindows[windowKey]; !exists {
		timeWindows = append(timeWindows, originalWindow)
		uniqueWindows[windowKey] = struct{}{}
	}

	// Generate combinations of start and end shifts
	for _, startOffset := range offsets {
		for _, endOffset := range offsets {
			newMin := baseMin + startOffset
			newMax := baseMax + endOffset

			// Ensure newMin is less than newMax and there's a reasonable minimum duration (e.g., 15 minutes)
			// Adjust the minimum duration as per your requirements
			if newMin < newMax && (newMax-newMin >= 15) {
				currentWindow := map[string]int{"minMinutes": newMin, "maxMinutes": newMax}
				currentKey := fmt.Sprintf("%d-%d", newMin, newMax)

				if _, exists := uniqueWindows[currentKey]; !exists {
					timeWindows = append(timeWindows, currentWindow)
					uniqueWindows[currentKey] = struct{}{}
				}
			}
		}
	}
	return timeWindows
}

// --- Helper function to generate numeric ranges, ported from JS ---
func generateNumericRanges(thresholds []json.Number, mode string) []interface{} {
	var ranges []interface{}
	var sortedThresholds []float64
	hasNull := false

	for _, t := range thresholds {
		if t.String() == "null" {
			hasNull = true
			continue
		}
		f, err := t.Float64()
		if err == nil {
			sortedThresholds = append(sortedThresholds, f)
		}
	}

	sort.Float64s(sortedThresholds)

	if hasNull {
		ranges = append(ranges, nil)
	}

	if len(sortedThresholds) == 0 {
		return ranges
	}

	switch mode {
	case "PERMUTATION":
		for i := 0; i < len(sortedThresholds); i++ {
			for j := i + 1; j < len(sortedThresholds); j++ {
				ranges = append(ranges, map[string]float64{"min": sortedThresholds[i], "max": sortedThresholds[j]})
			}
		}
	case "MAX":
		for _, t := range sortedThresholds {
			ranges = append(ranges, map[string]float64{"max": t})
		}
	default: // Default range generation
		ranges = append(ranges, map[string]float64{"max": sortedThresholds[0]})
		for i := 0; i < len(sortedThresholds)-1; i++ {
			ranges = append(ranges, map[string]float64{"min": sortedThresholds[i], "max": sortedThresholds[i+1]})
		}
		ranges = append(ranges, map[string]float64{"min": sortedThresholds[len(sortedThresholds)-1]})
	}

	return ranges
}

// --- Full Go implementation of the iterative combination generator (now returns a slice) ---
func GenerateCombinations(criteria []CombinationCriterion) []Combination {
	if len(criteria) == 0 {
		return []Combination{{}}
	}

	// Start with a slice containing one empty Combination map.
	combinations := []Combination{{}}

	// Sequentially apply each criterion.
	for _, criterion := range criteria {
		var newCombinations []Combination
		var effectiveTestValues []interface{}

		// Determine the possible values for the current criterion.
		if criterion.Type == "numericRange" {
			// Convert json.Number thresholds for the helper function
			var jsonNumThresholds []json.Number
			for _, t := range criterion.Thresholds {
				// The JSON unmarshaler might put floats into json.Number strings
				jsonNumThresholds = append(jsonNumThresholds, json.Number(fmt.Sprintf("%v", t)))
			}
			effectiveTestValues = generateNumericRanges(jsonNumThresholds, criterion.Mode)
		} else { // 'exact' type
			if len(criterion.TestValues) > 0 {
				effectiveTestValues = criterion.TestValues
			} else {
				effectiveTestValues = []interface{}{nil}
			}
		}

		// For each combination we've built so far...
		for _, existingCombo := range combinations {
			// ...combine it with each possible value for the NEW criterion.
			for _, value := range effectiveTestValues {
				if value == nil {
					// A nil value means "any", so we just add the existing combo as a valid possibility.
					newCombinations = append(newCombinations, existingCombo)
				} else {
					// For a specific value, create a new map, copy the existing combo,
					// and add the new filter property.
					newCombo := make(Combination)
					for k, v := range existingCombo {
						newCombo[k] = v
					}
					newCombo[criterion.ColumnHeader] = value
					newCombinations = append(newCombinations, newCombo)
				}
			}
		}
		// The newly generated set becomes the basis for the next criterion.
		combinations = newCombinations
	}

	return combinations
}

// generatorWorker takes a slice of base combinations and augments them with all
// time window variations, sending the results to the shared jobs channel.
// func GeneratorWorker(
// 	wg *sync.WaitGroup,
// 	baseCombinationsChunk []Combination,
// 	timeWindowVariations []map[string]int,
// 	jobs chan<- Combination,
// 	enableTimeWindowOptimization bool,
// ) {
// 	defer wg.Done()
// 	defer func() {
// 		if r := recover(); r != nil {
// 			// Log the panic to see what went wrong
// 			debugLog.Printf("FATAL: Generator worker panicked: %v\n%s", r, debug.Stack())
// 		}
// 	}()

// 	for _, baseCombo := range baseCombinationsChunk {
// 		if enableTimeWindowOptimization && len(timeWindowVariations) > 0 {
// 			for _, timeWindow := range timeWindowVariations {
// 				// This is the augmentation logic
// 				newCombo := make(Combination, len(baseCombo)+1)
// 				for k, v := range baseCombo {
// 					newCombo[k] = v
// 				}
// 				newCombo["TimeFilter"] = timeWindow
// 				jobs <- newCombo
// 			}
// 		} else {
// 			// If no time windows, just send the base combination
// 			jobs <- baseCombo
// 		}
// 	}
// }

// GeneratorWorker now consumes from a channel of base combinations instead of a slice.
func GeneratorWorker(
	wg *sync.WaitGroup,
	baseComboChan <-chan Combination, // Changed from slice to channel
	timeWindowVariations []map[string]int,
	jobs chan<- Combination, // This is the output channel (comboChan)
	enableTimeWindowOptimization bool,
) {
	defer wg.Done()
	defer func() {
		if r := recover(); r != nil {
			debugLog.Printf("FATAL: Generator worker panicked: %v\n%s", r, debug.Stack())
		}
	}()

	// The worker now pulls base combos from its input channel.
	for baseCombo := range baseComboChan {
		if enableTimeWindowOptimization && len(timeWindowVariations) > 0 {
			for _, timeWindow := range timeWindowVariations {
				newCombo := make(Combination, len(baseCombo)+1)
				for k, v := range baseCombo {
					newCombo[k] = v
				}
				newCombo["TimeFilter"] = timeWindow
				jobs <- newCombo
			}
		} else {
			jobs <- baseCombo
		}
	}
}

// GenerateBaseCombinationsRecursive streams base combinations directly to a channel
// without ever holding the full list in memory.
func GenerateBaseCombinationsRecursive(
	criteria []CombinationCriterion,
	index int,
	currentCombo Combination,
	baseComboChan chan<- Combination,
) {
	// Base case: If we have processed all criteria, send the complete combo.
	if index == len(criteria) {
		baseComboChan <- currentCombo
		return
	}

	// Recursive step:
	criterion := criteria[index]
	effectiveTestValues := getEffectiveTestValues(criterion)

	for _, value := range effectiveTestValues {
		if value == nil {
			// A nil value means "any", so we proceed without adding to the combo.
			GenerateBaseCombinationsRecursive(criteria, index+1, currentCombo, baseComboChan)
		} else {
			// Create a new map for the next recursive call to ensure immutability.
			nextCombo := make(Combination, len(currentCombo)+1)
			for k, v := range currentCombo {
				nextCombo[k] = v
			}
			nextCombo[criterion.ColumnHeader] = value
			GenerateBaseCombinationsRecursive(criteria, index+1, nextCombo, baseComboChan)
		}
	}
}

// Private helper to get test values
func getEffectiveTestValues(criterion CombinationCriterion) []interface{} {
	if criterion.Type == "numericRange" {
		var jsonNumThresholds []json.Number
		for _, t := range criterion.Thresholds {
			jsonNumThresholds = append(jsonNumThresholds, json.Number(fmt.Sprintf("%v", t)))
		}
		return generateNumericRanges(jsonNumThresholds, criterion.Mode)
	}
	// 'exact' type
	if len(criterion.TestValues) > 0 {
		return criterion.TestValues
	}
	return []interface{}{nil}
}
