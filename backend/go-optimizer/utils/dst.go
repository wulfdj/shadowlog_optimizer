// Package daylight provides functions to calculate Daylight Saving Time (DST)
// transition dates for specific locations, based on the logic from a source MQL5 library.
package utils

import (
	"time"
)

// Location represents a supported timezone for DST calculations.
type Location string

const (
	London  Location = "Europe/London"
	NewYork Location = "America/New_York"
)

// DSTInfo holds the start and end times for Daylight Saving Time for a given year.
// The times are in UTC.
type DSTInfo struct {
	StartUTC time.Time
	EndUTC   time.Time
}

// GetDSTInfo calculates the DST start and end dates for a given year and location.
// It returns a DSTInfo struct containing the transition moments in UTC.
func GetDSTInfo(year int, location Location) (DSTInfo, error) {
	switch location {
	case London:
		// DST begins at 01:00 UTC on the last Sunday of March.
		startSunday := getNthSunday(year, time.March, 5)
		dstStart := startSunday.Add(1 * time.Hour)

		// DST ends at 01:00 UTC (02:00 local) on the last Sunday of October.
		endSunday := getNthSunday(year, time.October, 5)
		dstEnd := endSunday.Add(1 * time.Hour)

		return DSTInfo{StartUTC: dstStart, EndUTC: dstEnd}, nil

	case NewYork:
		// DST begins at 07:00 UTC (02:00 local) on the second Sunday of March.
		// MQL code adds 2 hours to local time, but local time is UTC-5, so 2am local is 7am UTC.
		startSunday := getNthSunday(year, time.March, 2)
		dstStart := startSunday.Add(7 * time.Hour)

		// DST ends at 06:00 UTC (02:00 local) on the first Sunday of November.
		// MQL code adds 2 hours to local time, but local time is UTC-4, so 2am local is 6am UTC.
		endSunday := getNthSunday(year, time.November, 1)
		dstEnd := endSunday.Add(6 * time.Hour)

		return DSTInfo{StartUTC: dstStart, EndUTC: dstEnd}, nil

	default:
		return DSTInfo{}, &time.ParseError{Layout: "Location", Value: string(location), Message: ": unsupported location"}
	}
}

// IsDST checks if a given time `t` is within the Daylight Saving Time period for a specific location.
// Both the input time and the DST boundaries are treated as UTC for a correct comparison.
func (info DSTInfo) IsDST(t time.Time) bool {
	// Ensure the time being checked is also in UTC for a direct comparison.
	tUTC := t.UTC()
	return (tUTC.After(info.StartUTC) || tUTC.Equal(info.StartUTC)) && tUTC.Before(info.EndUTC)
}

// getNthSunday returns the date for the "Nth" Sunday of a given month and year.
// The time is set to midnight UTC.
// If "Nth" is 5, it's interpreted as the last Sunday of the month.
func getNthSunday(year int, month time.Month, nth int) time.Time {
	if nth < 1 || nth > 5 {
		// Return a zero time if Nth is invalid.
		return time.Time{}
	}

	// Start at the first day of the month in UTC.
	firstOfMonth := time.Date(year, month, 1, 0, 0, 0, 0, time.UTC)

	// Calculate how many days we need to add to get to the first Sunday.
	// Go's Sunday is 0, Monday is 1, etc.
	// If firstOfMonth is a Sunday (0), we add (7-0)%7 = 0 days.
	// If firstOfMonth is a Monday (1), we add (7-1)%7 = 6 days.
	daysToAdd := (7 - int(firstOfMonth.Weekday())) % 7

	// Calculate the date of the Nth Sunday.
	// Add days to get to the 1st Sunday, then add (n-1) full weeks.
	nthSunday := firstOfMonth.AddDate(0, 0, daysToAdd+7*(nth-1))

	// Handle the edge case where 'Nth' was 5 but the month has only 4 Sundays.
	// If our calculated date has spilled into the next month, subtract a week.
	if nthSunday.Month() != month {
		nthSunday = nthSunday.AddDate(0, 0, -7)
	}

	return nthSunday
}

func GetServerTimeOffset(timeAsString string) int {
	tradeTime, err := time.Parse("2006.01.02 15:04", timeAsString)
	if err != nil {
		return 0
	}

	//2. Get the DST info for the year of the trade for a specific location
	// This location could also be part of the combination's settings.
	dstInfoUS, err := GetDSTInfo(tradeTime.Year(), NewYork)
	if err != nil {
		return 0 // Unsupported location
	}

	//2. Get the DST info for the year of the trade for a specific location
	// This location could also be part of the combination's settings.
	dstInfoEU, err := GetDSTInfo(tradeTime.Year(), NewYork)
	if err != nil {
		return 0 // Unsupported location
	}

	var isEuDstActive bool
	var isUsDstActive bool

	if (tradeTime.Equal(dstInfoEU.StartUTC) || tradeTime.After(dstInfoEU.StartUTC)) && tradeTime.Before(dstInfoEU.EndUTC) {
		isEuDstActive = true
	}

	if (tradeTime.Equal(dstInfoUS.StartUTC) || tradeTime.After(dstInfoUS.StartUTC)) && tradeTime.Before(dstInfoUS.EndUTC) {
		isUsDstActive = true
	}

	usOffset := 2
	euOffset := 2

	if isUsDstActive && !isEuDstActive {
		euOffset = euOffset + 1
	}

	if isEuDstActive && isUsDstActive {
		euOffset = usOffset
	}

	if !isUsDstActive && !isEuDstActive {
		euOffset = usOffset
	}

	return euOffset
}
