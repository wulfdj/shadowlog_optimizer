import { Job } from 'bullmq';
import { AppDataSource } from '../database/data-source';
import { Configuration } from '../entities/Configuration';
import { OptimizationResult } from '../entities/OptimizationResult';
import { spawn } from 'child_process';
import path from 'path';

// A robust function to execute the child process and capture all output
function executeGoProcess(executablePath: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
        const process = spawn(executablePath, args);
        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        process.stderr.on('data', (data) => {
            // Log stderr in real-time for immediate feedback
            const logLine = data.toString();
            console.error(`[Go Stderr]: ${logLine.trim()}`);
            stderr += logLine;
        });
        
        // This catches fundamental errors like the file not being found (ENOENT)
        process.on('error', (err) => {
            console.error('[Node Spawn Error]: Failed to start Go sub-process.', err);
            stderr += `\n[Node Spawn Error]: ${err.message}`;
        });

        // The 'close' event fires after all I/O streams have been closed.
        // This is the safest place to resolve the promise.
        process.on('close', (code) => {
            resolve({ code: code ?? 1, stdout, stderr });
        });
    });
}


export default async function(job: Job): Promise<any> {
    const startTime = new Date();
    console.log(`--- NODE ORCHESTRATOR FOR JOB ${job.id} STARTED ---`);

    const { configId } = job.data;
    
    try {
        if (!AppDataSource.isInitialized) await AppDataSource.initialize();
        const resultRepo = AppDataSource.getRepository(OptimizationResult);
        const configRepo = AppDataSource.getRepository(Configuration);
        
        const config = await configRepo.findOneBy({ id: configId });
        if (!config) throw new Error("Configuration not found.");

        // --- DEBUGGING STEP 1: Verify environment variables in Node.js context ---
        console.log(`Verifying environment...`);
        if (!process.env.DATABASE_URL) {
            throw new Error("FATAL in Node.js: DATABASE_URL is not defined.");
        }
        if (!process.env.REDIS_URL) {
            throw new Error("FATAL in Node.js: REDIS_URL is not defined.");
        }
        console.log("Node.js environment variables are present.");


        // --- Step 2: Prepare and Execute Go Process ---
        const goExecutablePath = path.join(process.cwd(), 'go-optimizer', 'go-optimizer');
        const goArgs = [String(configId), String(job.id!)];
        
        console.log(`Executing Go optimizer: ${goExecutablePath} ${goArgs.join(' ')}`);
        
        // The Go process inherits env vars from this Node.js process
        const { code, stdout, stderr } = await executeGoProcess(goExecutablePath, goArgs);

        if (code !== 0) {
            // --- CORE FIX: Include the detailed stderr in the thrown error ---
            throw new Error(`Go optimizer exited with code ${code}. Stderr: ${stderr}`);
        }
        
        const finalResults = JSON.parse(stdout); // Only parse stdout on success
        console.log(`Go optimizer finished successfully. Found ${finalResults.length} top results.`);

        // Step 3: Save the final result
        const newResult = resultRepo.create({
            configuration: config,
            results: finalResults,
            startedAt: startTime,
        });
        await resultRepo.save(newResult);

        console.log(`--- JOB ${job.id} FINISHED SUCCESSFULLY ---`);
        return { success: true };

    } catch (error: any) {
        console.error(`--- JOB ${job.id} FAILED ---`, error.message);
        // Re-throw the rich error message so it appears in the BullMQ dashboard/logs
        throw error;
    }
}