package reporting

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/go-redis/redis/v8"
)

// ProgressReporter sends job progress updates to Redis.
type ProgressReporter struct {
	rdb              *redis.Client
	jobID            string
	totalJobs        int
	processedCounter *uint64
	ctx              context.Context
	cancel           context.CancelFunc
	wg               sync.WaitGroup
}

// NewProgressReporter creates and starts a new progress reporter.
func NewProgressReporter(redisURL, jobID string, totalJobs int, counter *uint64) (*ProgressReporter, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("unable to parse Redis URL: %w", err)
	}
	rdb := redis.NewClient(opt)

	ctx, cancel := context.WithCancel(context.Background())

	reporter := &ProgressReporter{
		rdb:              rdb,
		jobID:            jobID,
		totalJobs:        totalJobs,
		processedCounter: counter,
		ctx:              ctx,
		cancel:           cancel,
	}
	reporter.wg.Add(1)
	go reporter.run()
	return reporter, nil
}

// run is the internal loop that periodically sends updates.
func (pr *ProgressReporter) run() {
	defer pr.wg.Done()
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	progressKey := fmt.Sprintf("progress-for-job:%s", pr.jobID)

	for {
		select {
		case <-ticker.C:
			processed := atomic.LoadUint64(pr.processedCounter)
			progress := 0
			if pr.totalJobs > 0 {
				progress = int((float64(processed) / float64(pr.totalJobs)) * 100)
			}
			pr.rdb.Set(pr.ctx, progressKey, progress, 1*time.Hour)
		case <-pr.ctx.Done():
			return
		}
	}
}

// Stop gracefully shuts down the reporter.
func (pr *ProgressReporter) Stop() {
	pr.cancel()
	pr.wg.Wait()
	pr.rdb.Close()
}
