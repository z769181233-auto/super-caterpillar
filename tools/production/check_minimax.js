const Replicate = require('replicate');
const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

async function run() {
    try {
        const model = await replicate.models.get('minimax', 'video-01');
        const latestVersion = model.latest_version;
        if (latestVersion && latestVersion.openapi_schema) {
            console.log(JSON.stringify(latestVersion.openapi_schema.components.schemas.Input.properties, null, 2));
            console.log("Pricing:", model.cover_image_url || "N/A"); // Just to check
        } else {
            console.log("No schema found");
        }
    } catch (e) {
        console.error(e);
    }
}
run();
