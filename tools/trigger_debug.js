const sh = require('child_process');
async function run() {
    try {
        const dbUrl = "postgresql://postgres:postgres@localhost:5433/scu";
        const cmd = `psql "${dbUrl}" -Atc "SELECT s.id, sc.id, p.id FROM shots s JOIN scenes sc ON s.\\"sceneId\\" = sc.id JOIN projects p ON sc.project_id = p.id ORDER BY s.id DESC LIMIT 1;"`;
        const data = sh.execSync(cmd).toString().trim();
        if (!data) throw new Error("No data");
        const [shotId, sceneId, projectId] = data.split('|');
        console.log("Found IDs:", { shotId, sceneId, projectId });

        const absPath = require('path').resolve("temp/debug_seed/0.png");
        console.log("Source Image:", absPath);

        const body = {
            prompt: "A digital sunrise, cinematic",
            projectId, shotId, sceneId,
            sourceImagePath: absPath,
            jobId: `week2_seal_auto_${Date.now()}`
        };

        console.log("Sending request to http://127.0.0.1:3000/api/admin/prod-gate/shot-render");
        const res = await fetch('http://127.0.0.1:3000/api/admin/prod-gate/shot-render', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        console.log("Response Status:", res.status);
        const text = await res.text();
        console.log("Response Body:", text);
    } catch (e) {
        console.error("Error:", e);
    }
}
run();
