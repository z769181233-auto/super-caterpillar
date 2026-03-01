import Replicate from 'replicate';
const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});
async function main() {
    try {
        const model = await replicate.models.get("lucataco", "cogvideox-5b");
        console.log(model.latest_version.id);
    } catch (e: any) {
        console.log("cogvideo failed", e.message);
    }
    
    try {
        const output = await replicate.run("minimax/video-01", {
            input: {
                prompt: "A beautiful cinematic shot."
            }
        });
        console.log("Minimax output:", output);
    } catch (e: any) {
        console.log("minimax failed:", e.message);
    }
}
main();
