import { SandboxedJob } from 'bullmq';
import { AppDataSource } from '../database/data-source';
import { Configuration } from '../entities/Configuration';
import { OptimizationResult } from '../entities/OptimizationResult';
import { spawn } from 'child_process';
import path from 'path';

export default async function (job: SandboxedJob): Promise<any>  {
    const startTime = new Date();
    console.log(`--- NODE ORCHESTRATOR FOR JOB ${job.id} STARTED ---`);

    const { configId } = job.data;

    try {
        if (!AppDataSource.isInitialized) await AppDataSource.initialize();
        const resultRepo = AppDataSource.getRepository(OptimizationResult);
        const configRepo = AppDataSource.getRepository(Configuration);
        
        // We only need to find the config to link the final result to.
        const config = await configRepo.findOneBy({ id: configId });
        if (!config) throw new Error("Configuration not found.");

        // --- Step 1: Prepare to execute the Go binary ---
        console.log("Current Dir: " + process.cwd());
        //list all files and directories from the current directory:        
        const fs = require('fs');
        fs.readdirSync(process.cwd() + "/go-optimizer").forEach((file: any) => {
            console.log(file);
        });

        const goExecutablePath = path.join(process.cwd(), 'go-optimizer', 'optimizer');
        
        // Pass the config ID as a command-line argument.
        const goArgs = [String(configId)];
        
        console.log(`Executing Go optimizer: ${goExecutablePath} ${goArgs.join(' ')}`);
        
        // The Go process will inherit environment variables like DATABASE_URL from its parent (this worker).
        const goProcess = spawn(goExecutablePath, goArgs, { stdio: ['pipe', 'pipe', 'pipe'] });

        // --- Step 2: Capture the output ---
        let output = '';
        let errorOutput = '';
        goProcess.stdout.on('data', (data) => { output += data.toString(); });
        goProcess.stderr.on('data', (data) => { errorOutput += data.toString(); });

        // --- Step 3: Wait for the process to finish ---
        const exitCode = await new Promise<number>((resolve) => {
            goProcess.on('close', (code) => {
                // Log any non-JSON output from Go for debugging
                if (errorOutput) {
                    console.error('Go stderr:', errorOutput);
                }
                resolve(code ?? 1);
            });
        });

        if (exitCode !== 0) {
            throw new Error(`Go optimizer exited with code ${exitCode}.`);
        }
        
        const finalResults = JSON.parse(output);
        console.log(`Go optimizer finished successfully. Found ${finalResults.length} top results.`);

        // --- Step 4: Save the final result to the database ---
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
        throw error;
    }
}