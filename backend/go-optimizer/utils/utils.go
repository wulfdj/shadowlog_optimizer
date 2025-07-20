package utils

import (
	"fmt"
	"strconv"
	"strings"
)

// TimeToMinutes converts an HH:mm string to minutes from midnight.
func TimeToMinutes(timeValue string) (int, error) {
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

// MinutesToTime converts minutes from midnight to an HH:mm string.
func MinutesToTime(minutes int) string {
	h := minutes / 60
	m := minutes % 60
	return fmt.Sprintf("%02d:%02d", h, m)
}
