import Replicate from 'replicate';
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

async function main() {
    try {
        console.log("Fetching hunyuan-video...");
        const model = await replicate.models.get("tencent", "hunyuan-video");
        console.log("Hunyuan version:", model.latest_version.id);
    } catch(e:any) { console.error(e.message) }

    try {
        console.log("Fetching luma/ray...");
        const model2 = await replicate.models.get("luma", "ray");
        console.log("Luma version:", model2.latest_version.id);
    } catch(e:any) { console.error(e.message) }
}
main();
