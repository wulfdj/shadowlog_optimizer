package database

import (
	"context"
	"encoding/json"
	"fmt"
	"go-optimizer/optimizer" // Assuming module name is go-optimizer

	"github.com/jackc/pgx/v4/pgxpool"
)

// DB encapsulates the database pool.
type DB struct {
	Pool *pgxpool.Pool
}

// NewDBPool creates and returns a new database connection pool.
func NewDBPool(dbURL string) (*DB, error) {
	pool, err := pgxpool.Connect(context.Background(), dbURL)
	if err != nil {
		return nil, fmt.Errorf("unable to connect to database: %w", err)
	}
	return &DB{Pool: pool}, nil
}

// FetchConfiguration retrieves a specific configuration from the database.
func (db *DB) FetchConfiguration(configID int) (optimizer.Configuration, error) {
	var config optimizer.Configuration
	var settingsJSON []byte
	err := db.Pool.QueryRow(context.Background(),
		"SELECT id, name, settings FROM configuration WHERE id=$1", configID,
	).Scan(&config.ID, &config.Name, &settingsJSON)
	if err != nil {
		return optimizer.Configuration{}, fmt.Errorf("could not find configuration with id %d: %w", configID, err)
	}
	if err := json.Unmarshal(settingsJSON, &config.Settings); err != nil {
		return optimizer.Configuration{}, fmt.Errorf("could not unmarshal settings json: %w", err)
	}
	return config, nil
}

// FetchAllTrades retrieves all trades for a given timeframe from the database.
func (db *DB) FetchAllTrades(timeframe string) ([]optimizer.Trade, error) {
	query := `
	SELECT 
		"Time", "Setup", "Direction", "Entered", "Canceled_After_Candles", "Breakout_Candle_Count", "Candle_Size",
		"Breakout_Distance", "Entry_Distance", "Entry_Candle_Has_Wick", "Closed_In_LTA", "TP_1RR_PW_WIN",
		"TP_1RR_STR_WIN", "TP_1RR_PW_PIPS", "TP_1RR_STR_PIPS", "SL_PW_PIPS", "SL_STR_PIPS",
		"LTA_Range_Breakout", "Nearest_Range_Breakout", "Static_Range_Breakout", "Current_Range_Breakout",
		"TP_SR_LTA_SL_PW_WIN", "TP_SR_LTA_PIPS", "TP_SR_LTA_SL_STR_WIN", "TP_SR_NEAREST_SL_PW_WIN",
		"TP_SR_NEAREST_SL_STR_WIN", "TP_SR_NEAREST_PIPS", "TP_SR_STATIC_SL_PW_WIN",
		"TP_SR_STATIC_SL_STR_WIN", "TP_SR_STATIC_PIPS", "TP_SR_CURRENT_PW_WIN",
		"TP_SR_CURRENT_STR_WIN", "TP_SR_CURRENT_PIPS", "M10_Candle", "M15_Candle", "M30_Candle",
		"H1_Candle", "H4_Candle", "D1_Candle", "M10_Candle_Open", "M15_Candle_Open", "M30_Candle_Open",
		"H1_Candle_Open", "H4_Candle_Open", "D1_Candle_Open"
	FROM trade 
	WHERE timeframe=$1`
	rows, err := db.Pool.Query(context.Background(), query, timeframe)
	if err != nil {
		return nil, fmt.Errorf("error querying trades: %w", err)
	}
	defer rows.Close()

	var trades []optimizer.Trade
	for rows.Next() {
		var t optimizer.Trade
		// The Scan must match the query order exactly.
		err := rows.Scan(
			&t.Time, &t.Setup, &t.Direction, &t.Entered, &t.Canceled_After_Candles, &t.Breakout_Candle_Count, &t.Candle_Size,
			&t.Breakout_Distance, &t.Entry_Distance, &t.Entry_Candle_Has_Wick, &t.Closed_In_LTA, &t.TP_1RR_PW_WIN,
			&t.TP_1RR_STR_WIN, &t.TP_1RR_PW_PIPS, &t.TP_1RR_STR_PIPS, &t.SL_PW_PIPS, &t.SL_STR_PIPS,
			&t.LTA_Range_Breakout, &t.Nearest_Range_Breakout, &t.Static_Range_Breakout, &t.Current_Range_Breakout,
			&t.TP_SR_LTA_SL_PW_WIN, &t.TP_SR_LTA_PIPS, &t.TP_SR_LTA_SL_STR_WIN, &t.TP_SR_NEAREST_SL_PW_WIN,
			&t.TP_SR_NEAREST_SL_STR_WIN, &t.TP_SR_NEAREST_PIPS, &t.TP_SR_STATIC_SL_PW_WIN,
			&t.TP_SR_STATIC_SL_STR_WIN, &t.TP_SR_STATIC_PIPS, &t.TP_SR_CURRENT_PW_WIN,
			&t.TP_SR_CURRENT_STR_WIN, &t.TP_SR_CURRENT_PIPS, &t.M10_Candle, &t.M15_Candle, &t.M30_Candle,
			&t.H1_Candle, &t.H4_Candle, &t.D1_Candle, &t.M10_Candle_Open, &t.M15_Candle_Open, &t.M30_Candle_Open,
			&t.H1_Candle_Open, &t.H4_Candle_Open, &t.D1_Candle_Open,
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
