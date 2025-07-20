package optimizer

var SelectableCombinations = []map[string]interface{}{
	{
		"name": "Gaussian",
		"criterias": []interface{}{
			map[string]interface{}{"columnHeader": "Gaussian_Trend_1", "type": "exact", "testValues": []interface{}{true, nil}, "thresholds": []interface{}{}, "mode": ""},
			map[string]interface{}{"columnHeader": "Gaussian_Trend_2", "type": "exact", "testValues": []interface{}{true, nil}, "thresholds": []interface{}{}, "mode": ""},
			map[string]interface{}{"columnHeader": "Gaussian_Trend_3", "type": "exact", "testValues": []interface{}{true, nil}, "thresholds": []interface{}{}, "mode": ""},
			map[string]interface{}{"columnHeader": "Gaussian_Trend_4", "type": "exact", "testValues": []interface{}{true, nil}, "thresholds": []interface{}{}, "mode": ""},
			map[string]interface{}{"columnHeader": "Gaussian_Trend_5", "type": "exact", "testValues": []interface{}{true, nil}, "thresholds": []interface{}{}, "mode": ""},
			map[string]interface{}{"columnHeader": "Gaussian_Trend_6", "type": "exact", "testValues": []interface{}{true, nil}, "thresholds": []interface{}{}, "mode": ""},
			map[string]interface{}{"columnHeader": "Gaussian_Trend_7", "type": "exact", "testValues": []interface{}{true, nil}, "thresholds": []interface{}{}, "mode": ""},
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
	{
		"name": "S2 Pullback Distance Max",
		"criterias": []interface{}{
			map[string]interface{}{"columnHeader": "S2 Previous Support Distance|S2 Previous Resistance Distance", "type": "numericRange", "testValues": []interface{}{}, "thresholds": []interface{}{2, 5, 7.5, 10, 12.5, 15, 20, 25, nil}, "mode": "MAX"},
		},
	},
}

var TradeStrategies = []map[string]interface{}{
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

func BuildEnabledCriteria(settings map[string]interface{}) []CombinationCriterion {
	enabledComboNamesInterface, ok := settings["combinationsToTest"].([]interface{})
	if !ok {
		// Return empty slice if the setting is missing or invalid
		return []CombinationCriterion{}
	}

	enabledComboNames := make(map[string]bool)
	for _, name := range enabledComboNamesInterface {
		if n, ok := name.(string); ok {
			enabledComboNames[n] = true
		}
	}

	var enabledCombinationDefs []CombinationCriterion
	for _, def := range SelectableCombinations {
		defName, _ := def["name"].(string)
		if enabledComboNames[defName] {
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
	return enabledCombinationDefs
}
