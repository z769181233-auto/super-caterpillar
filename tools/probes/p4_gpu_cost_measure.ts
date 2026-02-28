import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config(); // fallback to .env if .env.local is missing
import axios from 'axios';
import * as fs from 'fs';

const RUN_COUNT = 5;

async function measureGPUCost() {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
        console.error("ERROR: REPLICATE_API_TOKEN not found in environment.");
        console.error("Please export REPLICATE_API_TOKEN='your_token' and run again.");
        process.exit(1);
    }

    console.log(`Starting GPU rendering benchmark for ${RUN_COUNT} iterations...`);

    const predictTimes: number[] = [];
    const totalTimes: number[] = [];

    let count429 = 0;
    let count401 = 0;
    let countFailed = 0;

    for (let i = 0; i < RUN_COUNT; i++) {
        console.log(`\n--- Iteration ${i + 1}/${RUN_COUNT} ---`);
        const startTime = Date.now();
        try {
            const res = await axios.post(
                'https://api.replicate.com/v1/predictions',
                {
                    version: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b", // SDXL
                    input: {
                        prompt: "A beautiful majestic cyber caterpillar in an epic sci-fi neon city, 4k, masterpiece, highly detailed",
                        width: 1024,
                        height: 1024,
                        num_outputs: 1,
                        scheduler: "K_EULER",
                        num_inference_steps: 20
                    }
                },
                {
                    headers: {
                        'Authorization': `Token ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            let prediction = res.data;
            process.stdout.write(`Prediction ${prediction.id} polling`);

            // Poll
            while (prediction.status !== "succeeded" && prediction.status !== "failed") {
                await new Promise(r => setTimeout(r, 1000));
                const pollRes = await axios.get(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
                    headers: { 'Authorization': `Token ${token}` }
                });
                prediction = pollRes.data;
                process.stdout.write('.');
            }
            console.log(''); // newline

            const totalTime = (Date.now() - startTime) / 1000;

            if (prediction.status === 'succeeded') {
                const pTime = prediction.metrics?.predict_time || 0;
                predictTimes.push(pTime);
                totalTimes.push(totalTime);
                console.log(`Iter ${i + 1} Success -> Predict Time: ${pTime}s, Wall Clock: ${totalTime}s`);
            } else {
                countFailed++;
                console.error(`Iter ${i + 1} Failed:`, prediction.error);
            }
        } catch (error: any) {
            const status = error.response?.status;
            if (status === 429) count429++;
            if (status === 401) count401++;
            countFailed++;
            console.error(`Iter ${i + 1} API Error (${status || 'UNKNOWN'}):`, error.response?.data || error.message);
        }
    }

    const isValidSampleSet = countFailed === 0 && count429 === 0 && count401 === 0 && predictTimes.length === RUN_COUNT;
    let invalidReason = 'NONE';
    if (!isValidSampleSet) {
        if (count401 > 0) invalidReason = 'UNAUTH_401';
        else if (count429 > 0) invalidReason = 'THROTTLED_429';
        else invalidReason = 'INCOMPLETE_OR_FAILED';
    }

    if (predictTimes.length === 0) {
        console.error("\n[ABORT] All iterations failed. Exiting.");
        process.exit(1);
    }

    // Calculate metrics
    predictTimes.sort((a, b) => a - b);
    const sumPredict = predictTimes.reduce((a, b) => a + b, 0);
    const avgPredict = sumPredict / predictTimes.length;
    const minPredict = predictTimes[0];
    const maxPredict = predictTimes[predictTimes.length - 1];

    // P95 calculation
    const p95Index = Math.floor(predictTimes.length * 0.95);
    const p95Predict = predictTimes[Math.max(0, p95Index - 1)];

    const sumTotal = totalTimes.reduce((a, b) => a + b, 0);
    const avgTotal = sumTotal / totalTimes.length;
    const avgQueueDelay = avgTotal - avgPredict;

    console.log("\n==================================");
    console.log("====== GPU BENCHMARK RESULTS =====");
    console.log("==================================");
    console.log(`Attempted Runs:   ${RUN_COUNT}`);
    console.log(`Succeeded Runs:   ${predictTimes.length}`);
    console.log(`Failed / 429 / 401: ${countFailed} / ${count429} / ${count401}`);
    console.log(`Sample Set Valid: ${isValidSampleSet ? 'YES (SEAL CANDIDATE)' : 'NO (INVALID_SAMPLE_SET: ' + invalidReason + ')'}`);
    console.log(`----------------------------------`);
    if (isValidSampleSet) {
        console.log(`Predict Time MIN: ${minPredict.toFixed(3)} s`);
        console.log(`Predict Time MAX: ${maxPredict.toFixed(3)} s`);
        console.log(`Predict Time AVG: ${avgPredict.toFixed(3)} s`);
        console.log(`Predict Time P95: ${p95Predict.toFixed(3)} s`);
        console.log(`Total Wall SUM:   ${sumTotal.toFixed(3)} s`);
        console.log(`Total Wall AVG:   ${avgTotal.toFixed(3)} s`);
        console.log(`Avg Queue Delay:  ${avgQueueDelay.toFixed(3)} s`);

        console.log("\n[STEADY STATE THRESHOLDS (INFO ONLY)]");
        console.log(`Threshold: Queue Delay AVG <= 2.0s  | Current: ${avgQueueDelay <= 2.0 ? 'PASS' : 'WARN - HIGH DELAY'}`);
        // Math proxy for p95 queue simply utilizing max vs p95 concept
        console.log(`==================================`);
        console.log("\n[NEXT STEP FOR YOU - P4-A.DATA-2]:");
        console.log("1. This is a VALID STEADY-STATE sample set! Go to Replicate Dashboard.");
        console.log(`2. Find the EXACT cost deducted for these 5 calls.`);
        console.log("3. Calculate: Total Cost / 5 = realCostPerImage.");
        console.log("4. Create tools/probes/p4_real_cost_baseline.json as instructed.");
    } else {
        console.log("\n[ABORT] DATA IS POLLUTED BY LIMITS OR ERRORS.");
        console.log("DO NOT USE THIS DATA FOR SEALING.");
    }

    fs.writeFileSync("p4_gpu_cost_measure_result.log", JSON.stringify({
        attempted: RUN_COUNT,
        succeeded: predictTimes.length,
        is_valid_sample_set: isValidSampleSet,
        invalid_reason: invalidReason,
        error_counts: { "429": count429, "401": count401, failed: countFailed },
        predict_time: {
            min: minPredict,
            max: maxPredict,
            avg: avgPredict,
            p95: p95Predict
        },
        total_time: {
            sum: sumTotal,
            avg: avgTotal
        },
        avg_queue_delay: avgQueueDelay,
        thresholds: {
            queue_delay_avg_limit: 2.0,
            queue_delay_p95_limit: 3.0
        }
    }, null, 2));
}

measureGPUCost();
