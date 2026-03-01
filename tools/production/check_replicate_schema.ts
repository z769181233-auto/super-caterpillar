import Replicate from 'replicate';

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

async function main() {
    try {
        const model = await replicate.models.get('minimax', 'video-01');
        const latestVersion = model.latest_version;
        if (latestVersion && latestVersion.openapi_schema) {
            console.log(JSON.stringify(latestVersion.openapi_schema.components.schemas.Input, null, 2));
        } else {
            console.log("No schema found");
        }

    } catch (e) {
        console.error(e);
    }
}
main();
