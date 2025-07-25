package main

import (
	"encoding/json"
	"fmt"
	"go-optimizer/database"
	"go-optimizer/optimizer"
	"go-optimizer/reporting"
	"log"
	"os"
	"runtime"
	"strconv"
	"sync"
	"time"
)

var debugLog = log.New(os.Stderr, "[Go-Optimizer-Debug] ", log.Ltime)

func main() {
	startTime := time.Now()
	debugLog.Printf("--- GO OPTIMIZER ENGINE STARTED at %s ----", startTime.Format(time.RFC3339))
	defer func() {
		duration := time.Since(startTime)
		debugLog.Printf("--- GO OPTIMIZER ENGINE FINISHED. Total duration: %s ---", duration)
	}()

	// --- 1. System and Environment Setup ---
	instrument, configID, jobID, numWorkers := parseArgsAndSetup()
	dbURL, redisURL := getEnvVars()

	// --- 2. Initial Data Loading ---
	db, err := database.NewDBPool(dbURL)
	if err != nil {
		debugLog.Fatalf("Database connection failed: %v", err)
	}
	defer db.Pool.Close()

	config, err := db.FetchConfiguration(configID)
	if err != nil {
		debugLog.Fatalf("Failed to fetch configuration: %v", err)
	}
	allTrades, err := db.FetchAllTrades(instrument, config.Settings["dataSheetName"].(string))
	if err != nil {
		debugLog.Fatalf("Failed to fetch trades: %v", err)
	}
	debugLog.Printf("Fetched %d total trades.", len(allTrades))

	// --- 3. Pre-Analysis and Job Generation ---
	finalTrades, timeWindows, err := optimizer.PrepareTradesForAnalysis(allTrades, config.Settings)
	if err != nil {
		debugLog.Fatalf("Error preparing trades: %v", err)
	}
	debugLog.Printf("Finished pre-filtering. %d trades remain for optimization.", len(finalTrades))

	if len(finalTrades) == 0 {
		outputEmptyResult()
		return
	}

	enabledCriteria := optimizer.BuildEnabledCriteria(config.Settings)
	timeShiftEnabled, _ := config.Settings["enableTimeShift"].(bool)
	totalJobs := optimizer.CalculateTotalCombinations(enabledCriteria, timeWindows, timeShiftEnabled)
	debugLog.Printf("Calculated total jobs to process: %d", totalJobs)
	//baseCombinations := optimizer.GenerateCombinations(enabledCriteria)
	//combinationsJSON, _ := json.Marshal(baseCombinations)
	//log.Println(string(combinationsJSON))
	//totalJobs := len(baseCombinations)
	//if len(timeWindows) > 0 {
	//	totalJobs *= len(timeWindows)
	//}
	//debugLog.Printf("Generated %d base combinations. Total jobs to process: %d", len(baseCombinations), totalJobs)

	// --- 4. Setup Workers, Channels, and Reporting ---
	var processedCounter uint64
	reporter, err := reporting.NewProgressReporter(redisURL, jobID, totalJobs, &processedCounter)
	if err != nil {
		debugLog.Fatalf("Failed to start progress reporter: %v", err)
	}
	defer reporter.Stop()

	baseComboChan := make(chan optimizer.Combination, 1000)
	comboChan := make(chan optimizer.Combination, 5000)
	resultsChan := make(chan optimizer.Result, 1000)

	var processWg, genWg sync.WaitGroup // Use two separate WaitGroups

	inputData := &optimizer.InputData{Config: config, Trades: finalTrades}

	for w := 1; w <= numWorkers; w++ {
		processWg.Add(1)
		go optimizer.CombinationWorker(w, comboChan, resultsChan, &processWg, inputData, &processedCounter)
	}

	// --- 5. Start Generation and Orchestrate Pipeline ---

	numGenerators := determineGeneratorCount(len(enabledCriteria))
	for i := 0; i < numGenerators; i++ {
		//start, end := calculateChunk(i, numGenerators, len(baseCombinations))
		genWg.Add(1)
		go optimizer.GeneratorWorker(&genWg, baseComboChan, timeWindows, comboChan, len(timeWindows) > 0)
	}

	// Goroutine to close the jobs channel once all generators are done
	go func() {
		genWg.Wait()
		close(comboChan)
	}()

	// Launch the master generator that feeds the whole pipeline.
	// It will close baseComboChan when it's done, signaling the generator workers to stop.
	go func() {
		defer close(baseComboChan)
		initialCombo := make(optimizer.Combination)
		optimizer.GenerateBaseCombinationsRecursive(enabledCriteria, 0, initialCombo, baseComboChan)
	}()

	// Create a slice to hold the final results.
	var rawResults []optimizer.Result

	// This WaitGroup is for the collector goroutine.
	var collectorWg sync.WaitGroup
	collectorWg.Add(1)

	// Start a dedicated collector goroutine.
	// Its only job is to drain the results channel.
	go func() {
		defer collectorWg.Done()
		for result := range resultsChan {
			rawResults = append(rawResults, result)
		}
	}()

	// Now, wait for the processing workers to finish their jobs.
	// They can now freely send to resultsChan because the collector is draining it.
	processWg.Wait()

	// After the workers are done, we know no more results will be sent.
	// So, we can safely close the results channel.
	close(resultsChan)

	// Finally, wait for the collector goroutine to finish its last loop
	// (after the channel is closed).
	collectorWg.Wait()
	debugLog.Println("All processing workers and collectors finished.")

	// --- 6. Finalize and Output Results ---
	// The `rawResults` slice is now fully populated.
	finalOutput := optimizer.ProcessFinalResults(rawResults)
	debugLog.Printf("Processing complete. Found top results for %d strategies.", len(finalOutput)) // It might not be len(topResultsPerStrategy) anymore

	outputJSON, err := json.Marshal(finalOutput)
	if err != nil {
		debugLog.Fatalf("Error marshaling final output JSON: %v", err)
	}
	fmt.Print(string(outputJSON))
}

// --- Main Helper Functions ---

func parseArgsAndSetup() (instrument string, configID int, jobID string, numWorkers int) {
	if len(os.Args) < 4 {
		log.Fatal("Usage: ./optimizer <instrument> <configID> <jobId> [priority]")
	}
	var err error
	configID, err = strconv.Atoi(os.Args[2])
	if err != nil {
		log.Fatalf("Invalid Config ID: %s", os.Args[2])
	}

	instrument = os.Args[1]
	if instrument == "" {
		log.Fatalf("No instrument given")
	}

	jobID = os.Args[3]

	numWorkers = runtime.NumCPU() / 2
	if len(os.Args) > 4 && os.Args[4] == "high" {
		numWorkers = runtime.NumCPU()
	}
	if numWorkers < 1 {
		numWorkers = 1
	}
	return
}

func getEnvVars() (dbURL, redisURL string) {
	dbURL = os.Getenv("DATABASE_URL")
	redisURL = os.Getenv("REDIS_URL")
	if dbURL == "" || redisURL == "" {
		log.Fatal("DATABASE_URL and REDIS_URL environment variables must be set.")
	}
	return
}

func determineGeneratorCount(numBaseCombos int) int {
	numGen := runtime.NumCPU() / 2
	if numGen < 1 {
		numGen = 1
	}
	if numGen > numBaseCombos && numBaseCombos > 0 {
		numGen = numBaseCombos
	}
	return numGen
}

func outputEmptyResult() {
	debugLog.Println("No trades remaining. Exiting successfully.")
	fmt.Print("[]")
}
