import { Job } from 'bullmq';
import { AppDataSource } from '../database/data-source';
import { Configuration } from '../entities/Configuration';
import { OptimizationResult } from '../entities/OptimizationResult';
import { spawn } from 'child_process';
import path from 'path';
import IORedis from 'ioredis';
import { redisConnection } from './redisConnection';

const redisClient = new IORedis(redisConnection);

export const stopJob = async (job: Job) => {
    const pid = job.data.pid;
    console.log(`Stop job executed for pid: ${pid}`);
    if (pid) {
         try {
            // This sends the termination signal to the process.
            // 'SIGTERM' is a graceful shutdown signal.
            process.kill(pid, 'SIGTERM');
        } catch (e: any) {
            // This can happen if the process has already died but the Redis key hasn't expired.
            console.warn(`Could not kill PID ${pid}, it may have already exited:`, e.message);
        }
    }
};