package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"os"
	"reflect"
	"runtime/debug"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v4/pgxpool"
)

// MarshalJSON is a special function name that the `encoding/json` package looks for.
// If it exists on a struct, it will be used instead of the default marshalling logic.
func (r Result) MarshalJSON() ([]byte, error) {
	// Create an alias type to avoid an infinite recursion loop when calling json.Marshal
	type Alias Result

	// Replace -Inf with null in the strategy scores map
	scoresForJSON := make(map[string]interface{})
	for key, value := range r.StrategyScores {
		if math.IsInf(value, -1) {
			scoresForJSON[key] = nil // Replace -Inf with null
		} else {
			scoresForJSON[key] = value
		}
	}

	// Replace -Inf in the overall score
	overallScoreForJSON := r.OverallScore
	if math.IsInf(r.OverallScore, -1) {
		overallScoreForJSON = 0 // Or you could use a custom marshaler to make it null
	}

	// Replace Infinity with a large number or string for ProfitFactor
	metricsForJSON := make(map[string]interface{})
	for key, value := range r.Metrics {
		pf := value.ProfitFactor
		if math.IsInf(pf, 1) {
			pf = 9999.0 // Replace Infinity with a large number
		}
		metricsForJSON[key] = map[string]interface{}{
			"winRate":                 value.WinRate,
			"profitFactor":            pf,
			"totalTradesThisStrategy": value.TotalTradesThisStrategy,
			"netProfit":               value.NetProfit,
		}
	}

	// Use a new struct with the cleaned-up values to marshal
	return json.Marshal(&struct {
		StrategyScores map[string]interface{} `json:"strategyScores"`
		OverallScore   float64                `json:"overallScore"`
		Metrics        map[string]interface{} `json:"metrics"`
		*Alias
	}{
		StrategyScores: scoresForJSON,
		OverallScore:   overallScoreForJSON,
		Metrics:        metricsForJSON,
		Alias:          (*Alias)(&r),
	})
}

var SELECTABLE_COMBINATIONS = []map[string]interface{}{
	{
		"name": "Gaussian",
		"criterias": []interface{}{
			map[string]interface{}{"columnHeader": "Gaussian_Trend_1", "type": "exact", "testValues": []interface{}{true, nil}, "thresholds": []interface{}{}, "mode": ""},
			// ... add other Gaussian criteria maps here
		},
	},
	{
		"name": "Candle Size Min Max",
		"criterias": []interface{}{
			map[string]interface{}{"columnHeader": "Candle_Size", "type": "numericRange", "testValues": []interface{}{}, "thresholds": []interface{}{2.0, 5.0, 8.0, 10.0, 15.0, 18.0, 25.0, nil}, "mode": "PERMUTATION"},
		},
	},
	{
		"name": "Breakout Candle Count Max",
		"criterias": []interface{}{
			map[string]interface{}{"columnHeader": "Breakout_Candle_Count", "type": "numericRange", "testValues": []interface{}{}, "thresholds": []interface{}{1, 2, 3, nil}, "mode": "MAX"},
		},
	},
	{
		"name": "Entry Distance Max",
		"criterias": []interface{}{
			map[string]interface{}{"columnHeader": "Entry_Distance", "type": "numericRange", "testValues": []interface{}{}, "thresholds": []interface{}{2, 5, 7.5, 10, 12.5, 15, 20, 25, nil}, "mode": "MAX"},
		},
	},
	{
		"name": "Breakout Distance Max",
		"criterias": []interface{}{
			map[string]interface{}{"columnHeader": "Breakout_Distance", "type": "numericRange", "testValues": []interface{}{}, "thresholds": []interface{}{2, 5, 7.5, 10, 12.5, 15, 20, 25, nil}, "mode": "MAX"},
		},
	},
	{
		"name": "Closed In LTA",
		"criterias": []interface{}{
			map[string]interface{}{"columnHeader": "Closed_In_LTA", "type": "exact", "testValues": []interface{}{true, nil}, "thresholds": []interface{}{}, "mode": ""},
		},
	},
	{
		"name": "Setup Candle Has Wick",
		"criterias": []interface{}{
			map[string]interface{}{"columnHeader": "Setup_Candle_Has_Wick", "type": "exact", "testValues": []interface{}{true, nil}, "thresholds": []interface{}{}, "mode": ""},
		},
	},
	{
		"name": "Candle Closed",
		"criterias": []interface{}{
			map[string]interface{}{"columnHeader": "M10_Candle", "type": "exact", "testValues": []interface{}{true, nil}, "thresholds": []interface{}{}, "mode": ""},
			map[string]interface{}{"columnHeader": "M15_Candle", "type": "exact", "testValues": []interface{}{true, nil}, "thresholds": []interface{}{}, "mode": ""},
			map[string]interface{}{"columnHeader": "M30_Candle", "type": "exact", "testValues": []interface{}{true, nil}, "thresholds": []interface{}{}, "mode": ""},
			map[string]interface{}{"columnHeader": "H1_Candle", "type": "exact", "testValues": []interface{}{true, nil}, "thresholds": []interface{}{}, "mode": ""},
			map[string]interface{}{"columnHeader": "H4_Candle", "type": "exact", "testValues": []interface{}{true, nil}, "thresholds": []interface{}{}, "mode": ""},
			map[string]interface{}{"columnHeader": "D1_Candle", "type": "exact", "testValues": []interface{}{true, nil}, "thresholds": []interface{}{}, "mode": ""},
		},
	},
	{
		"name": "Candle Open",
		"criterias": []interface{}{
			map[string]interface{}{"columnHeader": "M10_Candle_Open", "type": "exact", "testValues": []interface{}{true, nil}, "thresholds": []interface{}{}, "mode": ""},
			map[string]interface{}{"columnHeader": "M15_Candle_Open", "type": "exact", "testValues": []interface{}{true, nil}, "thresholds": []interface{}{}, "mode": ""},
			map[string]interface{}{"columnHeader": "M30_Candle_Open", "type": "exact", "testValues": []interface{}{true, nil}, "thresholds": []interface{}{}, "mode": ""},
			map[string]interface{}{"columnHeader": "H1_Candle_Open", "type": "exact", "testValues": []interface{}{true, nil}, "thresholds": []interface{}{}, "mode": ""},
			map[string]interface{}{"columnHeader": "H4_Candle_Open", "type": "exact", "testValues": []interface{}{true, nil}, "thresholds": []interface{}{}, "mode": ""},
			map[string]interface{}{"columnHeader": "D1_Candle_Open", "type": "exact", "testValues": []interface{}{true, nil}, "thresholds": []interface{}{}, "mode": ""},
		},
	},
}

// --- Struct Definitions ---

type Trade struct {
	ID                       int     `db:"id" json:"-"` // Exclude from JSON for performance
	Time                     string  `db:"Time"`
	Setup                    string  `db:"´Setup"`
	Entered                  bool    `db:"Entered"`
	Canceled_After_Candles   int     `db:"Canceled_After_Candles"`
	Breakout_Candle_Count    int     `db:"Breakout_Candle_Count"`
	Candle_Size              float64 `db:"Candle_Size"`
	Breakout_Distance        float64 `db:"Breakout_Distance"`
	Entry_Distance           float64 `db:"Entry_Distance"`
	Entry_Candle_Has_Wick    bool    `db:"Entry_Candle_Has_Wick"`
	Closed_In_LTA            bool    `db:"Closed_In_LTA"`
	Gaussian_Trend_1         bool    `db:"Gaussian_Trend_1"`
	Gaussian_Trend_4         bool    `db:"Gaussian_Trend_4"`
	Gaussian_Trend_7         bool    `db:"Gaussian_Trend_7"`
	TP_1RR_PW_WIN            bool    `db:"TP_1RR_PW_WIN"`
	TP_1RR_STR_WIN           bool    `db:"TP_1RR_STR_WIN"`
	TP_SR_LTA_SL_PW_WIN      bool    `db:"TP_SR_LTA_SL_PW_WIN"`
	TP_SR_LTA_SL_STR_WIN     bool    `db:"TP_SR_LTA_SL_STR_WIN"`
	TP_SR_NEAREST_SL_PW_WIN  bool    `db:"TP_SR_NEAREST_SL_PW_WIN"`
	TP_SR_NEAREST_SL_STR_WIN bool    `db:"TP_SR_NEAREST_SL_STR_WIN"`
	TP_SR_STATIC_SL_PW_WIN   bool    `db:"TP_SR_STATIC_SL_PW_WIN"`
	TP_SR_STATIC_SL_STR_WIN  bool    `db:"TP_SR_STATIC_SL_STR_WIN"`
	TP_SR_CURRENT_PW_WIN     bool    `db:"TP_SR_CURRENT_PW_WIN"`
	TP_SR_CURRENT_STR_WIN    bool    `db:"TP_SR_CURRENT_STR_WIN"`
	TP_1RR_PW_PIPS           float64 `db:"TP_1RR_PW_PIPS"`
	TP_1RR_STR_PIPS          float64 `db:"TP_1RR_STR_PIPS"`
	TP_SR_LTA_PIPS           float64 `db:"TP_SR_LTA_PIPS"`
	TP_SR_NEAREST_PIPS       float64 `db:"TP_SR_NEAREST_PIPS"`
	TP_SR_STATIC_PIPS        float64 `db:"TP_SR_STATIC_PIPS"`
	TP_SR_CURRENT_PIPS       float64 `db:"TP_SR_CURRENT_PIPS"`
	SL_PW_PIPS               float64 `db:"SL_PW_PIPS"`
	SL_STR_PIPS              float64 `db:"SL_STR_PIPS"`
	LTA_Range_Breakout       bool    `db:"LTA_Range_Breakout"`
	Nearest_Range_Breakout   bool    `db:"Nearest_Range_Breakout"`
	Static_Range_Breakout    bool    `db:"Static_Range_Breakout"`
	Current_Range_Breakout   bool    `db:"Current_Range_Breakout"`
	M10_Candle               bool    `db:"M10_Candle"`
	M15_Candle               bool    `db:"M15_Candle"`
	M30_Candle               bool    `db:"M30_Candle"`
	H1_Candle                bool    `db:"H1_Candle"`
	H4_Candle                bool    `db:"H4_Candle"`
	D1_Candle                bool    `db:"D1_Candle"`
	M10_Candle_Open          bool    `db:"M10_Candle_Open"`
	M15_Candle_Open          bool    `db:"M15_Candle_Open"`
	M30_Candle_Open          bool    `db:"M30_Candle_Open"`
	H1_Candle_Open           bool    `db:"H1_Candle_Open"`
	H4_Candle_Open           bool    `db:"H4_Candle_Open"`
	D1_Candle_Open           bool    `db:"D1_Candle_Open"`
}

type Configuration struct {
	ID       int                    `json:"id"`
	Name     string                 `json:"name"`
	Settings map[string]interface{} `json:"settings"`
}

type CombinationCriterion struct {
	ColumnHeader string        `json:"columnHeader"`
	Type         string        `json:"type"`
	TestValues   []interface{} `json:"testValues"`
	Thresholds   []interface{} `json:"thresholds"`
	Mode         string        `json:"mode"`
}

type InputData struct {
	Config                Configuration          `json:"config"`
	Trades                []Trade                `json:"trades"`
	CombinatorialCriteria []CombinationCriterion `json:"combinatorialCriteria"`
	TimeWindow            map[string]string      `json:"timeWindow"`
}

type Combination map[string]interface{}

type StrategyMetrics struct {
	WinRate                 float64 `json:"winRate"`
	ProfitFactor            float64 `json:"profitFactor"`
	TotalTradesThisStrategy int     `json:"totalTradesThisStrategy"`
	NetProfit               float64 `json:"netProfit"`
}

type Result struct {
	Combination       Combination                `json:"combination"`
	OverallScore      float64                    `json:"overallScore"`
	OverallTradeCount int                        `json:"overallTradeCount"`
	Metrics           map[string]StrategyMetrics `json:"metrics"`
	StrategyScores    map[string]float64         `json:"strategyScores"`
}

var tradeStrategies = []map[string]interface{}{
	{"name": "1RR PW", "winColumn": "TP_1RR_PW_WIN", "tpPipsColumn": "TP_1RR_PW_PIPS", "slPipsColumn": "SL_PW_PIPS", "lta": false, "s2": false, "rangeBreakoutColumn": ""},
	{"name": "1RR STR", "winColumn": "TP_1RR_STR_WIN", "tpPipsColumn": "TP_1RR_STR_PIPS", "slPipsColumn": "SL_STR_PIPS", "lta": false, "s2": false, "rangeBreakoutColumn": ""},
	{"name": "SR LTA SL PW", "winColumn": "TP_SR_LTA_SL_PW_WIN", "tpPipsColumn": "TP_SR_LTA_PIPS", "slPipsColumn": "SL_PW_PIPS", "rangeBreakoutColumn": "LTA_Range_Breakout", "lta": true, "s2": false},
	{"name": "SR LTA SL STR", "winColumn": "TP_SR_LTA_SL_STR_WIN", "tpPipsColumn": "TP_SR_LTA_PIPS", "slPipsColumn": "SL_STR_PIPS", "rangeBreakoutColumn": "LTA_Range_Breakout", "lta": true, "s2": false},
	{"name": "SR NEAR SL PW", "winColumn": "TP_SR_NEAREST_SL_PW_WIN", "tpPipsColumn": "TP_SR_NEAREST_PIPS", "slPipsColumn": "SL_PW_PIPS", "rangeBreakoutColumn": "Nearest_Range_Breakout", "lta": false, "s2": false},
	{"name": "SR NEAR SL STR", "winColumn": "TP_SR_NEAREST_SL_STR_WIN", "tpPipsColumn": "TP_SR_NEAREST_PIPS", "slPipsColumn": "SL_STR_PIPS", "rangeBreakoutColumn": "Nearest_Range_Breakout", "lta": false, "s2": false},
	{"name": "SR STATIC SL PW", "winColumn": "TP_SR_STATIC_SL_PW_WIN", "tpPipsColumn": "TP_SR_STATIC_PIPS", "slPipsColumn": "SL_PW_PIPS", "rangeBreakoutColumn": "Static_Range_Breakout", "lta": false, "s2": false},
	{"name": "SR STATIC SL STR", "winColumn": "TP_SR_STATIC_SL_STR_WIN", "tpPipsColumn": "TP_SR_STATIC_PIPS", "slPipsColumn": "SL_STR_PIPS", "rangeBreakoutColumn": "Static_Range_Breakout", "lta": false, "s2": false},
	{"name": "SR CURR SL PW", "winColumn": "TP_SR_CURRENT_PW_WIN", "tpPipsColumn": "TP_SR_CURRENT_PIPS", "slPipsColumn": "SL_PW_PIPS", "rangeBreakoutColumn": "Current_Range_Breakout", "lta": false, "s2": true},
	{"name": "SR CURR SL STR", "winColumn": "TP_SR_CURRENT_STR_WIN", "tpPipsColumn": "TP_SR_CURRENT_PIPS", "slPipsColumn": "SL_STR_PIPS", "rangeBreakoutColumn": "Current_Range_Breakout", "lta": false, "s2": true},
}

// --- Helper to convert HH:mm string to minutes from midnight ---
func timeToMinutes(timeValue string) (int, error) {
	parts := strings.Split(timeValue, ":")
	if len(parts) < 2 {
		return 0, fmt.Errorf("invalid time format: %s", timeValue)
	}
	hours, errH := strconv.Atoi(parts[0])
	minutes, errM := strconv.Atoi(parts[1])
	if errH != nil || errM != nil {
		return 0, fmt.Errorf("error parsing time: %s", timeValue)
	}
	return hours*60 + minutes, nil
}

// --- The main pre-filtering logic ---
func applyPredefinedFilters(trades []Trade, filters []interface{}) ([]Trade, error) {
	if len(filters) == 0 {
		return trades, nil
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
				tradeTime, err := timeToMinutes(trade.Time)
				if err != nil {
					continue tradeLoop
				}

				condition := filter["condition"].(map[string]interface{})
				min, minOk := condition["minMinutes"].(string)
				max, maxOk := condition["maxMinutes"].(string)

				if minOk {
					minMins, _ := timeToMinutes(min)
					if tradeTime < minMins {
						continue tradeLoop
					}
				}
				if maxOk {
					maxMins, _ := timeToMinutes(max)
					if tradeTime > maxMins {
						continue tradeLoop
					}
				}
			}
		}
		// If the trade survived all filters, add it to the result slice
		filteredTrades = append(filteredTrades, *trade)
	}
	return filteredTrades, nil
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
func generateCombinations(criteria []CombinationCriterion) []Combination {
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

// --- Reflection-based Helper ---
func getField(v *Trade, field string) reflect.Value {
	r := reflect.ValueOf(v)
	f := reflect.Indirect(r).FieldByName(field)
	return f
}

// --- Ported Calculation Logic ---

func applyFilters(trades []Trade, combo Combination) ([]Trade, bool) {
	var filteredTrades []Trade
	ltaCombination := false
	if _, ok := combo["Closed_In_LTA"]; ok {
		ltaCombination = true
	}

tradeLoop:
	for _, trade := range trades {
		for key, condition := range combo {
			if key == "TimeWindow" {
				continue
			}
			tradeValue := getField(&trade, key)
			if !tradeValue.IsValid() {
				continue // Or handle as an error
			}

			//Print type of condition
			//log.Printf("Condition type: %T, type trade: %T", condition, tradeValue)

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
				if minOk && val < min { // val is float64, min is float64
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

func calculateMetrics(trades []Trade, ltaCombination bool, settings map[string]interface{}) map[string]StrategyMetrics {

	//log.Printf("CalculateMetrics: %s")

	results := make(map[string]StrategyMetrics)
	allSetupsFailed := true

	minSLToTPRatio, _ := settings["minSLToTPRatio"].(float64)
	maxTPToSLRatio, _ := settings["maxTPToSLRatio"].(float64)
	minWinRate, _ := settings["minWinRate"].(float64)
	minProfitFactor, _ := settings["minProfitFactor"].(float64)
	predefinedSetup, _ := settings["predefinedSetup"].(string)

	for _, strategy := range tradeStrategies {
		name := strategy["name"].(string)
		isLTA := strategy["lta"].(bool)
		isS2 := strategy["s2"].(bool)

		wonTrades, grossProfit, grossLoss, strategyTrades := 0, 0.0, 0.0, 0

		if (ltaCombination && isLTA) || (!ltaCombination && !isLTA) {
			for _, trade := range trades {
				isWin := getField(&trade, strategy["winColumn"].(string)).Bool()
				tpPips := getField(&trade, strategy["tpPipsColumn"].(string)).Float()
				slPips := getField(&trade, strategy["slPipsColumn"].(string)).Float()

				// Simplified logic from JS port
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

func calculateCompositeScore(metrics StrategyMetrics, weights map[string]interface{}) float64 {
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

// --- Main Worker Logic ---
func combinationWorker(
	id int,
	jobs <-chan Combination,
	results chan<- Result,
	wg *sync.WaitGroup,
	inputData InputData,
) {
	defer wg.Done()
	// Add panic recovery here
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Worker %d PANIC: %v. Stack: %s", id, r, debug.Stack())
			// Optionally, send a special error result or just let the worker die if it's unrecoverable
		}
	}()

	log.Printf("Worker %d started", id)
	jobCount := 0

	for combo := range jobs {
		jobCount += 1
		if jobCount%500 == 0 {
			log.Printf("Worker %d processed %d jobs...", id, jobCount)
		}
		//comboJSON, err := json.Marshal(combo)
		//if err != nil {
		//	log.Printf("Error marshaling combination to JSON: %v", err)
		//}
		//log.Printf("Combination: %s trades: %d", string(comboJSON), len(inputData.Trades))
		filteredTrades, ltaCombination := applyFilters(inputData.Trades, combo)
		//log.Printf("After filtering %s -> %d", string(comboJSON), len(filteredTrades))
		if len(filteredTrades) < int(inputData.Config.Settings["minTradeCount"].(float64)) {
			continue
		}

		metrics := calculateMetrics(filteredTrades, ltaCombination, inputData.Config.Settings)
		if metrics == nil {
			continue
		}

		scores := make(map[string]float64)
		sumOfScores, scoredStrategies := 0.0, 0
		weights := inputData.Config.Settings["rankingWeights"].(map[string]interface{})

		for name, metric := range metrics {
			score := calculateCompositeScore(metric, weights)
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
			//combo["TimeWindow"] = inputData.TimeWindow["name"]
			results <- Result{
				Combination:       combo,
				OverallScore:      overallScore,
				OverallTradeCount: len(filteredTrades),
				Metrics:           metrics,
				StrategyScores:    scores,
			}
		}

	}
}

func fetchConfiguration(pool *pgxpool.Pool, configID int) (Configuration, error) {
	var config Configuration
	var settingsJSON []byte
	err := pool.QueryRow(context.Background(),
		"SELECT id, name, settings FROM configuration WHERE id=$1", configID,
	).Scan(&config.ID, &config.Name, &settingsJSON)

	if err != nil {
		return Configuration{}, fmt.Errorf("could not find configuration with id %d: %w", configID, err)
	}

	if err := json.Unmarshal(settingsJSON, &config.Settings); err != nil {
		return Configuration{}, fmt.Errorf("could not unmarshal settings json: %w", err)
	}
	return config, nil
}

func fetchAllTrades(pool *pgxpool.Pool, timeframe string) ([]Trade, error) {
	// This query needs to be adapted to select all columns from your trade table.
	// For brevity, only a few columns are shown here.
	query := `
	SELECT 
		"Time",
		"Setup",
		"Entered", 
		"Canceled_After_Candles",
		"Breakout_Candle_Count", 
		"Candle_Size",
		"Breakout_Distance",
		"Entry_Distance",
		"Entry_Candle_Has_Wick",
		"Closed_In_LTA",
		"TP_1RR_PW_WIN",
		"TP_1RR_STR_WIN",
		"TP_1RR_PW_PIPS",
		"TP_1RR_STR_PIPS",
		"SL_PW_PIPS",
		"SL_STR_PIPS",
		"LTA_Range_Breakout",
		"Nearest_Range_Breakout",
		"Static_Range_Breakout",
		"Current_Range_Breakout",
		"TP_SR_LTA_SL_PW_WIN",
		"TP_SR_LTA_PIPS",
		"TP_SR_LTA_SL_STR_WIN",
		"TP_SR_NEAREST_SL_PW_WIN",
		"TP_SR_NEAREST_SL_STR_WIN",
		"TP_SR_NEAREST_PIPS",
		"TP_SR_STATIC_SL_PW_WIN",
		"TP_SR_STATIC_SL_STR_WIN",
		"TP_SR_STATIC_PIPS",
		"TP_SR_CURRENT_PW_WIN",
		"TP_SR_CURRENT_STR_WIN",
		"TP_SR_CURRENT_PIPS",
		"M10_Candle",
		"M15_Candle",
		"M30_Candle",
		"H1_Candle",
		"H4_Candle",
		"D1_Candle",
		"M10_Candle_Open",
		"M15_Candle_Open",
		"M30_Candle_Open",
		"H1_Candle_Open",
		"H4_Candle_Open",
		"D1_Candle_Open"
	FROM trade 
	WHERE timeframe=$1
`
	rows, err := pool.Query(context.Background(), query, timeframe)
	if err != nil {
		return nil, fmt.Errorf("error querying trades: %w", err)
	}
	defer rows.Close()

	var trades []Trade
	for rows.Next() {
		var t Trade
		err := rows.Scan(
			&t.Time,
			&t.Setup,
			&t.Entered,
			&t.Canceled_After_Candles,
			&t.Breakout_Candle_Count,
			&t.Candle_Size,
			&t.Breakout_Distance,
			&t.Entry_Distance,
			&t.Entry_Candle_Has_Wick,
			&t.Closed_In_LTA,
			&t.TP_1RR_PW_WIN,
			&t.TP_1RR_STR_WIN,
			&t.TP_1RR_PW_PIPS,
			&t.TP_1RR_STR_PIPS,
			&t.SL_PW_PIPS,
			&t.SL_STR_PIPS,
			&t.LTA_Range_Breakout,
			&t.Nearest_Range_Breakout,
			&t.Static_Range_Breakout,
			&t.Current_Range_Breakout,
			&t.TP_SR_LTA_SL_PW_WIN,
			&t.TP_SR_LTA_PIPS,
			&t.TP_SR_LTA_SL_STR_WIN,
			&t.TP_SR_NEAREST_SL_PW_WIN,
			&t.TP_SR_NEAREST_SL_STR_WIN,
			&t.TP_SR_NEAREST_PIPS,
			&t.TP_SR_STATIC_SL_PW_WIN,
			&t.TP_SR_STATIC_SL_STR_WIN,
			&t.TP_SR_STATIC_PIPS,
			&t.TP_SR_CURRENT_PW_WIN,
			&t.TP_SR_CURRENT_STR_WIN,
			&t.TP_SR_CURRENT_PIPS,
			&t.M10_Candle,
			&t.M15_Candle,
			&t.M30_Candle,
			&t.H1_Candle,
			&t.H4_Candle,
			&t.D1_Candle,
			&t.M10_Candle_Open,
			&t.M15_Candle_Open,
			&t.M30_Candle_Open,
			&t.H1_Candle_Open,
			&t.H4_Candle_Open,
			&t.D1_Candle_Open,
		)
		if err != nil {
			return nil, fmt.Errorf("error scanning trade row: %w", err)
		}
		trades = append(trades, t)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error during rows iteration: %w", err)
	}
	return trades, nil
}

func main() {
	startTime := time.Now() // Record start time
	log.Printf("--- GO OPTIMIZER ENGINE STARTED at %s ----", startTime.Format(time.RFC3339))

	// Defer a function to log the execution duration at the end
	defer func() {
		duration := time.Since(startTime)
		log.Printf("--- GO OPTIMIZER ENGINE FINISHED. Total duration: %s ---", duration)
	}()

	if len(os.Args) < 2 {
		log.Fatal("Usage: ./optimizer <configID>")
	}
	configID, err := strconv.Atoi(os.Args[1])
	if err != nil {
		log.Fatalf("Invalid Config ID provided: %s", os.Args[1])
	}
	log.Printf("Processing job for Config ID: %d", configID)

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL environment variable is not set.")
	}

	pool, err := pgxpool.Connect(context.Background(), dbURL)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
	}
	defer pool.Close()
	log.Println("Database connection successful.")

	config, err := fetchConfiguration(pool, configID)
	if err != nil {
		log.Fatalf("Failed to fetch configuration: %v", err)
	}

	settings := config.Settings

	log.Println("Settings:")
	settingsJSON, err := json.Marshal(settings)
	if err != nil {
		log.Fatalf("Error marshaling output JSON: %v", err)
	}
	log.Println(string(settingsJSON))

	dataSheetName := settings["dataSheetName"].(string)

	allTrades, err := fetchAllTrades(pool, dataSheetName)
	if err != nil {
		log.Fatalf("Failed to fetch trades: %v", err)
	}
	log.Printf("Fetched %d trades for timeframe %s.", len(allTrades), dataSheetName)

	predefinedFilters, ok := settings["predefinedFilters"].([]interface{})
	if !ok {
		log.Fatal("FATAL: 'predefinedFilters' setting is missing or not an array.")
	}

	// Apply the filters
	finalTrades, err := applyPredefinedFilters(allTrades, predefinedFilters)
	if err != nil {
		log.Fatalf("FATAL: Error during pre-filtering: %v", err)
	}
	log.Printf("Finished pre-filtering. %d trades remain for optimization.", len(finalTrades))

	if len(finalTrades) == 0 {
		log.Println("No trades remaining after pre-filtering. Exiting successfully.")
		// Output an empty result so the orchestrator knows it's done
		fmt.Print("[]")
		os.Exit(0)
	}

	// --- Step 4: Generate Combinations (with corrected selection logic) ---

	// First, get the list of enabled combination names from the settings
	enabledComboNamesInterface, ok := settings["combinationsToTest"].([]interface{})
	if !ok {
		log.Fatal("FATAL: 'combinationsToTest' setting is missing or not an array.")
	}
	enabledComboNames := make(map[string]bool)
	for _, name := range enabledComboNamesInterface {
		enabledComboNames[name.(string)] = true
	}

	// Now, filter the master SELECTABLE_COMBINATIONS list
	var enabledCombinationDefs []CombinationCriterion
	// Assuming SELECTABLE_COMBINATIONS is defined globally in this file
	for _, def := range SELECTABLE_COMBINATIONS {
		defName, _ := def["name"].(string)
		if enabledComboNames[defName] {
			// This is a complex conversion from map[string]interface{} to CombinationCriterion struct
			// A helper function is cleaner for this.
			criteriaMaps := def["criterias"].([]interface{})
			for _, critMapIntf := range criteriaMaps {
				critMap := critMapIntf.(map[string]interface{})
				enabledCombinationDefs = append(enabledCombinationDefs, CombinationCriterion{
					ColumnHeader: critMap["columnHeader"].(string),
					Type:         critMap["type"].(string),
					TestValues:   critMap["testValues"].([]interface{}),
					Thresholds:   critMap["thresholds"].([]interface{}),
					Mode:         critMap["mode"].(string),
				})
			}
		}
	}

	// Flatten the criteria from the enabled definitions
	// Note: The above loop already does this effectively. If the structure was nested,
	// you would flatten it here. For now, enabledCombinationDefs is correct.

	log.Printf("Starting combination generation with %d enabled criteria.", len(enabledCombinationDefs))

	// --- The main processing logic ---
	log.Println("Starting combination generation...")
	allCombinations := generateCombinations(enabledCombinationDefs)
	log.Printf("Combinations %d generated", len(allCombinations))
	//allCombinationsJSON, _ := json.Marshal(allCombinations)
	//log.Println(string(allCombinationsJSON))

	numWorkers := 4
	resultsChan := make(chan Result, 100000)
	var wg sync.WaitGroup

	log.Printf("Starting %d concurrent workers...", numWorkers)
	comboChan := make(chan Combination, 50000000)
	inputData := InputData{
		Config: config,
		Trades: finalTrades,
	}
	for w := 1; w <= numWorkers; w++ {
		// Create a channel for jobs to be sent to workers
		// This channel will be closed after all combinations are sent
		// This is a common pattern for distributing work to a pool of workers

		wg.Add(1)

		go combinationWorker(w, comboChan, resultsChan, &wg, inputData)
	}
	go func() {
		defer close(comboChan)
		for _, combo := range allCombinations {
			comboChan <- combo
		}
	}()

	wg.Wait()

	close(resultsChan)
	log.Println("All workers have finished.")

	finalResults := make([]Result, 0)
	for result := range resultsChan {
		finalResults = append(finalResults, result)
	}

	endResults := make([]Result, 0)

	// Map to hold top 10 results per strategy
	topResultsPerStrategy := make(map[string][]Result)

	// Iterate through each defined strategy to find its top combinations
	for _, strategy := range tradeStrategies {
		strategyName := strategy["name"].(string)

		// Filter results that have valid scores for this specific strategy
		var relevantResults []Result
		for _, res := range finalResults {
			// Check if the strategy exists in Metrics and its score is not infinite (meaning it passed min criteria)
			if _, metricsOk := res.Metrics[strategyName]; metricsOk && !math.IsInf(res.StrategyScores[strategyName], 0) {
				relevantResults = append(relevantResults, res)
			}
		}

		// Sort relevant results by this strategy's score in descending order
		sort.Slice(relevantResults, func(i, j int) bool {
			scoreI := relevantResults[i].StrategyScores[strategyName]
			scoreJ := relevantResults[j].StrategyScores[strategyName]
			return scoreI > scoreJ
		})

		// Take the top 10 for this strategy
		currentStrategyTop10 := relevantResults
		if len(relevantResults) > 10 {
			currentStrategyTop10 = relevantResults[:10]
		}
		topResultsPerStrategy[strategyName] = currentStrategyTop10
		endResults = append(endResults, currentStrategyTop10...)
	}

	log.Printf("Processing complete. Generated top results for %d strategies.", len(topResultsPerStrategy))

	// Marshal the final structured results to JSON
	outputJSON, err := json.Marshal(endResults) //json.MarshalIndent(topResultsPerStrategy, "", "  ")
	if err != nil {
		log.Fatalf("Error marshaling final output JSON: %v", err)
	}

	fmt.Print(string(outputJSON))
}
