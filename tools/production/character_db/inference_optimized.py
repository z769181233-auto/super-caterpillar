
import torch
from diffusers import StableDiffusionPipeline, UNet2DConditionModel
import os
import traceback

class CustomLoRAAttnProcessor(torch.nn.Module):
    def __init__(self, hidden_size, cross_attention_dim=None, rank=16):
        super().__init__()
        self.rank = rank
        self.to_q_lora = torch.nn.Linear(hidden_size, rank, bias=False)
        self.to_q_lora_up = torch.nn.Linear(rank, hidden_size, bias=False)
        self.to_k_lora = torch.nn.Linear(cross_attention_dim or hidden_size, rank, bias=False)
        self.to_k_lora_up = torch.nn.Linear(rank, hidden_size, bias=False)
        self.to_v_lora = torch.nn.Linear(cross_attention_dim or hidden_size, rank, bias=False)
        self.to_v_lora_up = torch.nn.Linear(rank, hidden_size, bias=False)
        self.to_out_lora = torch.nn.Linear(hidden_size, rank, bias=False)
        self.to_out_lora_up = torch.nn.Linear(rank, hidden_size, bias=False)

    def __call__(self, attn, hidden_states, encoder_hidden_states=None, attention_mask=None):
        query = attn.to_q(hidden_states) + self.to_q_lora_up(self.to_q_lora(hidden_states))
        encoder_hidden_states = encoder_hidden_states if encoder_hidden_states is not None else hidden_states
        key = attn.to_k(encoder_hidden_states) + self.to_k_lora_up(self.to_k_lora(encoder_hidden_states))
        value = attn.to_v(encoder_hidden_states) + self.to_v_lora_up(self.to_v_lora(encoder_hidden_states))
        
        query = attn.head_to_batch_dim(query)
        key = attn.head_to_batch_dim(key)
        value = attn.head_to_batch_dim(value)
        
        attention_probs = attn.get_attention_scores(query, key, attention_mask)
        hidden_states = torch.bmm(attention_probs, value)
        hidden_states = attn.batch_to_head_dim(hidden_states)
        
        hidden_states = attn.to_out[0](hidden_states) + self.to_out_lora_up(self.to_out_lora(hidden_states))
        hidden_states = attn.to_out[1](hidden_states)
        return hidden_states

def run_inference():
    try:
        model_id = "runwayml/stable-diffusion-v1-5"
        lora_path = "/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/output/lora_chenpingan/pytorch_lora_weights.bin"
        output_dir = "/Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/output/lora_chenpingan/optimized_samples"
        os.makedirs(output_dir, exist_ok=True)

        print(f"Loading base model and injecting LoRA...")
        pipe = StableDiffusionPipeline.from_pretrained(
            model_id, 
            torch_dtype=torch.float32,
            safety_checker=None
        )
        
        # Inject Custom LoRA into Unet
        unet = pipe.unet
        lora_attn_procs = torch.nn.ModuleDict()
        for name, attn in unet.attn_processors.items():
            attn_obj = unet.get_submodule(name.replace(".processor", ""))
            hidden_size = attn_obj.to_q.in_features
            cross_attention_dim = attn_obj.to_k.in_features if attn_obj.to_k.in_features != hidden_size else None
            proc = CustomLoRAAttnProcessor(hidden_size, cross_attention_dim, rank=16)
            lora_attn_procs[name.replace(".", "_")] = proc
            attn_obj.processor = proc

        # Load weights
        print(f"Loading LoRA weights from {lora_path}...")
        state_dict = torch.load(lora_path, map_location="cpu")
        lora_attn_procs.load_state_dict(state_dict)
        
        pipe.to("mps")

        prompts = [
            "a portrait of chenpingan"
        ]
        
        negative_prompt = "darkness, heavy shadows, low contrast, gloomy, black face, underexposed, low quality"
        cfg_scale = 9.5
        num_steps = 30
        seed = 42 + 500

        print(f"Running optimized inference...")

        for i, prompt in enumerate(prompts):
            if hasattr(torch, "mps"): torch.mps.empty_cache()
            generator = torch.Generator("mps").manual_seed(seed)
            
            image = pipe(
                prompt, 
                negative_prompt=negative_prompt, 
                guidance_scale=cfg_scale, 
                num_inference_steps=num_steps,
                generator=generator
            ).images[0]
            
            save_path = os.path.join(output_dir, f"optimized_{i}.png")
            image.save(save_path)
            print(f"Saved: {save_path}")

    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    run_inference()
