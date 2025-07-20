package optimizer

import (
	"encoding/json"
	"math"
)

// --- Struct Definitions ---

type Trade struct {
	ID                       int     `db:"id" json:"-"`
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
	Config Configuration
	Trades []Trade
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

// MarshalJSON provides custom JSON serialization for the Result struct.
func (r Result) MarshalJSON() ([]byte, error) {
	type Alias Result
	scoresForJSON := make(map[string]interface{})
	for key, value := range r.StrategyScores {
		if math.IsInf(value, -1) {
			scoresForJSON[key] = nil
		} else {
			scoresForJSON[key] = value
		}
	}

	overallScoreForJSON := r.OverallScore
	if math.IsInf(r.OverallScore, -1) {
		overallScoreForJSON = 0
	}

	metricsForJSON := make(map[string]interface{})
	for key, value := range r.Metrics {
		pf := value.ProfitFactor
		if math.IsInf(pf, 1) {
			pf = 9999.0
		}
		metricsForJSON[key] = map[string]interface{}{
			"winRate":                 value.WinRate,
			"profitFactor":            pf,
			"totalTradesThisStrategy": value.TotalTradesThisStrategy,
			"netProfit":               value.NetProfit,
		}
	}

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
