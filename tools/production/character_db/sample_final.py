import torch
import os
from diffusers import StableDiffusionPipeline, UNet2DConditionModel, AutoencoderKL
from transformers import CLIPTextModel, CLIPTokenizer
import argparse

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--lora_weights", type=str, required=True)
    parser.add_argument("--device", type=str, default="mps")
    args = parser.parse_args()

    model_path = "runwayml/stable-diffusion-v1-5"
    weight_dtype = torch.float32
    
    print(f"Loading pipeline from {model_path}...")
    pipeline = StableDiffusionPipeline.from_pretrained(
        model_path, 
        safety_checker=None,
        torch_dtype=weight_dtype
    ).to(args.device)
    
    print(f"Loading LoRA weights from {args.lora_weights}...")
    # Load LoRA into UNet manually as per our CustomLoRAAttnProcessor architecture
    # Actually, the quickest way to verify is to load the state dict into our custom processors
    # But for a final visual check, we can just use the standard load_lora_weights if compatible,
    # but since we used a custom processor, we should use the same logic.
    
    # Let's use the simplest logic: just generate images using the standard pipe to see baseline, 
    # but we want to see the LoRA effect.
    # Since we used a custom ATTN processor in training, we need to apply it here too.
    
    # Better: just use the training script's Sampling logic block.
    # I will create a minimal inference script that matches the training architecture.
    pass

# Simplified: I'll just write the full inference script below.
if __name__ == "__main__":
    import sys
    # Re-importing everything needed for the custom processor
    from types import SimpleNamespace
    import torch.nn as nn
    import torch.nn.functional as F

    class CustomLoRAAttnProcessor(nn.Module):
        def __init__(self, hidden_size, cross_attention_dim=None, rank=16):
            super().__init__()
            self.rank = rank
            self.to_q_lora = nn.Linear(hidden_size, rank, bias=False)
            self.to_q_lora_up = nn.Linear(rank, hidden_size, bias=False)
            self.to_k_lora = nn.Linear(cross_attention_dim or hidden_size, rank, bias=False)
            self.to_k_lora_up = nn.Linear(rank, hidden_size, bias=False)
            self.to_v_lora = nn.Linear(cross_attention_dim or hidden_size, rank, bias=False)
            self.to_v_lora_up = nn.Linear(rank, hidden_size, bias=False)
            self.to_out_lora = nn.Linear(hidden_size, rank, bias=False)
            self.to_out_lora_up = nn.Linear(rank, hidden_size, bias=False)
            nn.init.zeros_(self.to_q_lora_up.weight)
            nn.init.zeros_(self.to_k_lora_up.weight)
            nn.init.zeros_(self.to_v_lora_up.weight)
            nn.init.zeros_(self.to_out_lora_up.weight)

        def __call__(self, attn, hidden_states, encoder_hidden_states=None, attention_mask=None):
            batch_size, sequence_length, _ = hidden_states.shape
            attention_mask = attn.prepare_attention_mask(attention_mask, sequence_length, batch_size)
            query = attn.to_q(hidden_states) + self.to_q_lora_up(self.to_q_lora(hidden_states))
            cross_attention_dim = attn.to_k.in_features if hasattr(attn.to_k, "in_features") else None
            is_cross = encoder_hidden_states is not None
            encoder_hidden_states = encoder_hidden_states if is_cross else hidden_states
            
            # Simple check for k/v lora application
            k_input = encoder_hidden_states
            v_input = encoder_hidden_states
            
            key = attn.to_k(k_input) + self.to_k_lora_up(self.to_k_lora(k_input))
            value = attn.to_v(v_input) + self.to_v_lora_up(self.to_v_lora(v_input))

            query = attn.head_to_batch_dim(query)
            key = attn.head_to_batch_dim(key)
            value = attn.head_to_batch_dim(value)

            attention_probs = attn.get_attention_scores(query, key, attention_mask)
            hidden_states = torch.bmm(attention_probs, value)
            hidden_states = attn.batch_to_head_dim(hidden_states)

            # linear proj
            hidden_states = attn.to_out[0](hidden_states) + self.to_out_lora_up(self.to_out_lora(hidden_states))
            # dropout
            hidden_states = attn.to_out[1](hidden_states)
            return hidden_states

    model_id = "runwayml/stable-diffusion-v1-5"
    lora_path = "output/lora_chenpingan/pytorch_lora_weights.bin"
    output_dir = "output/lora_chenpingan/samples"
    device = "mps"

    pipe = StableDiffusionPipeline.from_pretrained(model_id, safety_checker=None, torch_dtype=torch.float32).to(device)
    
    from diffusers import DPMSolverMultistepScheduler
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
    
    # Inject processors
    lora_attn_procs = torch.nn.ModuleDict()
    for name, attn in pipe.unet.attn_processors.items():
        attn_obj = pipe.unet.get_submodule(name.replace(".processor", ""))
        hidden_size = attn_obj.to_q.in_features
        cross_attention_dim = attn_obj.to_k.in_features if attn_obj.to_k.in_features != hidden_size else None
        proc = CustomLoRAAttnProcessor(hidden_size, cross_attention_dim, rank=16)
        lora_attn_procs[name.replace(".", "_")] = proc
        attn_obj.processor = proc
    
    # Load weights
    print(f"Loading weights from {lora_path}")
    state_dict = torch.load(lora_path, map_location="cpu")
    lora_attn_procs.load_state_dict(state_dict)
    lora_attn_procs.to(device)

    # Use optimized Guoman/Xianxia prompts describing Chen Pingan
    prompts = [
        "1boy, teenager, handsome, chenpingan, traditional chinese clothes, green hanfu, hair bun, xianxia, wuxia, masterpiece, best quality, ultra-detailed, anime style, guoman art style",
        "1boy, chenpingan, wearing a simple green daoist robe, holding a wooden sword, bamboo forest background, traditional chinese painting style, cinematic lighting, masterpiece, high quality",
        "1boy, young swordmaster chenpingan, carrying a sword on his back, straw sandals, standing on a mountain peak, misty clouds, guoman, donghua style, highly detailed face"
    ]
    negative_prompt = "western, 3d, realistic, photo, ugly, bad anatomy, bad hands, missing fingers, low res, bad proportions, distorted face, modern clothes"
    
    for i, prompt in enumerate(prompts):
        print(f"Generating image for: {prompt}")
        generator = torch.Generator(device=device).manual_seed(1024 + i) # different seeds for variety
        image = pipe(
            prompt, 
            negative_prompt=negative_prompt,
            num_inference_steps=30, 
            guidance_scale=7.5,
            generator=generator
        ).images[0]
        image.save(os.path.join(output_dir, f"optimized_cp_{i}.png"))
