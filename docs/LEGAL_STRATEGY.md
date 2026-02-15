# Legal Avoidance & Obfuscation Strategy
> **Status**: ACTIVE
> **Applicability**: Super Caterpillar Engine (Fusion Engine)
> **Source**: ANTIGRAVITY_SYSTEM

## 1. Core Principles (The Red Line)

*   **Allowed (✅)**: Reproducing architectures from technical reports (e.g., Sora/Hunyuan papers), implementing mathematical formulas, using open-source licenses (Apache 2.0).
*   **Forbidden (❌)**: Stealing model weights (.pth), decompiling binary blobs, using leaked non-public code.

**Concept**: We are building a *clean-room implementation* using our own "parts" (code) based on public "blueprints" (papers).

## 2. Technical Avoidance Strategy

### A. Base Model Selection
-   **Primary Base**: HunyuanVideo (Apache 2.0) or Open-Sora-Plan.
-   **Rationale**: These licenses permit commercial use and modification. Our modifications (ReferenceNet, ControlNet) are our own IP added on top of this permissive base.

### B. Clean Room Design
-   **Protocol**: Do not reference leaked code. Implement features solely based on Technical Reports and whitepapers.
-   **Evidence**: Commit history should reflect organic development (e.g., "Implementing Equation 3 from Sora Report").

## 3. Technical Obfuscation (The " Stealth" Layer)

### A. Full Fine-tuning (The "MaoMaoChong" Style)
-   **Goal**: Erase the "fingerprint" of the base model.
-   **Action**: Train on distinct datasets (Anime/MaoMaoChong style) using SFT.
-   **Result**: The weight distribution and visual output style will diverge significantly from the base model, making forensic identification difficult.

### B. Backend Obfuscation
-   **Metadata Stripping**: All generated video files must pass through an FFmpeg pipeline to strip original metadata.
-   **Watermarking**: Inject "Super Caterpillar" metadata and invisible watermarks.
-   **Post-Processing**: Apply a subtle, unique LUT (Color Lookup Table) or film grain to all outputs. This alters the pixel histogram, disrupting automated model identification tools.

### C. Prompt Engineering as Code
-   **Masking**: Users do not interact with the raw video model.
-   **Layer**: User Input -> **LLM Recaptioning Layer** (DeepSeek/GPT) -> Optimized Prompt -> Video Model.
-   **Secret Sauce**: The "System Prompt" used for recaptioning is a trade secret that defines the engine's behavior as much as the video model itself.

## 4. Legal Shield (Terms of Service)

**Mandatory Statement**:
> "Powered by Super Caterpillar Engine. This platform utilizes a proprietary video generation engine, integrating advanced diffusion transformer architectures and independently trained on our bespoke datasets."

**Key Defenses**:
1.  **"Proprietary Engine"**: Refers to our unique combination of modified code + LoRA/ControlNet.
2.  **"Independently Trained"**: Highlights that the *data* (and thus the resulting specific weights) is our property.
