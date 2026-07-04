# Complete Guide: Google AI Studio for Image Generation
## Generate Your LinkedIn Poster Using Google's AI Models

---

## IMPORTANT CLARIFICATION

**Google AI Studio** (formerly called "MakerSuite" or "Google AI Generative Studio") is primarily designed for **testing LLMs and multimodal models**, not direct image generation.

However, you have **three options** to generate images using Google's ecosystem:

1. **Google Imagen** (via API, requires setup)
2. **Vertex AI Vision** (Google Cloud, requires billing)
3. **Use Google AI Studio to write prompts**, then run them in a compatible service

**Note:** "Nano Banana" likely refers to **Banana.dev** (serverless GPU platform) or a lightweight image model.

This guide covers **all three approaches** with full step-by-step instructions.

---

# OPTION 1: Google AI Studio + Vertex AI Imagen (Best Quality)
## Full Setup & Execution

### Step 1: Set Up Google Cloud Project

**1.1 Create a Google Cloud Account**
- Go to [Google Cloud Console](https://console.cloud.google.com)
- Sign in with your Google account
- Click "Select a Project" → "New Project"
- Project name: `UQ-Consulting-Posters`
- Click "Create"
- Wait 30 seconds for project to initialize

**1.2 Enable Required APIs**
- In the left sidebar, go to **"APIs & Services"** → **"Enabled APIs & Services"**
- Click **"+ ENABLE APIS AND SERVICES"** (top button)
- Search for: `Vertex AI API`
- Click it → **"ENABLE"**
- Wait 1-2 minutes for API to enable
- Go back and repeat for: `Cloud Resource Manager API` (enable it)

**1.3 Set Up Billing (Required)**
- Left sidebar → **"Billing"**
- Click **"Create Account"** if you don't have one
- Link a credit card (Google gives $300 free credits)
- Go back to your project and ensure billing is linked
- **Cost estimate:** Image generation costs ~$0.04 per image (100 images = $4)

**1.4 Create a Service Account (for API access)**
- Left sidebar → **"APIs & Services"** → **"Credentials"**
- Click **"+ CREATE CREDENTIALS"** → **"Service Account"**
- Service account name: `uq-poster-generator`
- Click "Create and Continue"
- Grant role: **"Editor"** (or "Vertex AI User" for least privilege)
- Click "Continue" → "Done"

**1.5 Generate API Key**
- In Credentials page, find your newly created service account
- Click on it (the email address)
- Go to **"Keys"** tab
- Click **"Add Key"** → **"Create new key"** → **"JSON"**
- A JSON file downloads to your computer
- **Save this file** as `google-cloud-key.json` (keep it private!)

---

### Step 2: Access Google AI Studio

**2.1 Open Google AI Studio**
- Go to [Google AI Studio](https://aistudio.google.com) (or `makersuite.google.com`)
- Sign in with your Google account
- Click **"Create new project"** or **"Start coding"**

**2.2 Get Your API Key (from AI Studio)**
- In AI Studio, go to **"Get API Key"** (top-right corner)
- Click **"Create API key in Google Cloud"**
- This opens Google Cloud Console
- Create an API key (if you don't have one)
- Copy the API key and **save it** (you'll need it)

**2.3 Verify Vertex AI Access**
- Go back to [Google Cloud Console](https://console.cloud.google.com)
- Ensure you're in your `UQ-Consulting-Posters` project
- Left sidebar → **"Vertex AI"** → **"Vision"**
- You should see "Imagen API" listed (if Vertex AI API is enabled)

---

### Step 3: Generate Images Using Vertex AI Imagen

**Option A: Using Python (Recommended for Batch Generation)**

**3A.1 Install Required Tools**
- Download & install [Python 3.9+](https://www.python.org/downloads/)
- Open Terminal/PowerShell and run:
```bash
pip install google-cloud-aiplatform Pillow
```

**3A.2 Create a Python Script**
- Create a new file: `generate_poster.py`
- Copy this code:

```python
from google.cloud import aiplatform
from google.oauth2 import service_account
import json

# 1. Load your service account key
credentials = service_account.Credentials.from_service_account_file(
    'google-cloud-key.json'
)

# 2. Initialize Vertex AI
aiplatform.init(
    project='YOUR_PROJECT_ID',
    location='us-central1',
    credentials=credentials
)

# 3. Define your image generation prompt
prompt = """
A premium LinkedIn advertising poster (1200x2640px vertical format) showing:

FOREGROUND - Central Hero Image:
Professional male finance auditor, age 35-40, confident expression, wearing navy business blazer, 
shaking hands with a holographic/digital AI figure (glowing blue-gold, ethereal, non-threatening).
The human hand is realistic skin tone, warm lighting. The AI hand is translucent, 
surrounded by glowing nodes and digital particles in blue & gold.
Handshake at center, creating visual anchor point.
Golden-hour warm lighting illuminating the human, cool blue glow around the AI figure.
Shallow depth of field (f/2.8), sharp on handshake, soft background.

BACKGROUND:
Premium modern office environment (minimalist desk, laptop, professional workspace).
Deep navy to royal blue gradient background.
Subtle office scene (blurred, bokeh): window with golden light, plants, premium furniture.
Ethereal particle effects and glowing AI network nodes floating in the air.
Very faint grid pattern overlay (luxury tech aesthetic).

TEXT LAYOUT:
Top (centered):
- "UQ Consulting" (14px, gold, uppercase)
- "AI Meets Expertise" (42px, bold, white)
- "One Platform. Seven AI Specialists. Your Career Made Simple." (18px, light blue)

Left side (8 feature cards):
1. "🎯 7 AI SPECIALISTS" / "Audit, IFRS-FRS, Tax, Forensic, ESG, Legal, Technical Accounting"
2. "🎤 INTERVIEW PREP" / "Job-specific coaching, role-aware questions, kind tone"
3. "📋 CV SCORING & TAILORING" / "ATS analysis, honest feedback, structure optimization"
4. "🌍 GAAP COMPARE" / "7 jurisdictions, side-by-side research, instant clarity"
5. "📑 FINANCIAL REVIEWS" / "Upload documents, AI auditor review, real Word comments"
6. "📰 HOT MARKET TOPICS" / "Real-time IFRS/FRC news, auto-refreshed every 3 hours"
7. "💾 YOUR WORKSPACE" / "Save consultations, resume anytime, email reply-to-continue"
8. "🤖 ASKAI ASSISTANT" / "24/7 Q&A, finance & career, calm professional advisor"

Bottom CTA:
"Start Free Today — uqconsulting.org"
"No credit card. No commitment. Forever free."

STYLE:
Professional fintech (Apple, Stripe, McKinsey level), luxury premium feel,
cinematic photography with warm golden light on human and cool blue glow on AI,
modern UI elements, high contrast (navy + white + gold),
photorealistic human, holographic ethereal AI figure,
depth and parallax, original premium composition,
Shot on Canon 5D Mark IV, f/2.8, golden hour lighting,
Ultra high resolution, pristine quality, ready for LinkedIn.
"""

# 4. Generate the image
try:
    response = aiplatform.gapic.PredictionServiceClient().predict(
        endpoint=f"projects/YOUR_PROJECT_ID/locations/us-central1/endpoints/YOUR_ENDPOINT_ID",
        instances=[{
            "prompt": prompt,
            "sampleCount": 1,
            "aspectRatio": "9:20"  # LinkedIn vertical ratio
        }]
    )
    
    # 5. Save the generated image
    print(f"Image generated successfully!")
    print(f"Response: {response.predictions}")
    
except Exception as e:
    print(f"Error: {e}")
    print("Make sure:")
    print("1. Replace YOUR_PROJECT_ID with your actual project ID")
    print("2. Replace YOUR_ENDPOINT_ID with your Imagen endpoint ID")
    print("3. google-cloud-key.json exists in the same directory")
```

**3A.3 Run the Script**
- Open Terminal/PowerShell in the same directory
- Run:
```bash
python generate_poster.py
```
- Wait 2-3 minutes for image generation
- Image saves to your directory as PNG

---

**Option B: Using Google Cloud Console (No Code)**

**3B.1 Navigate to Vertex AI Console**
- Go to [Google Cloud Vertex AI](https://console.cloud.google.com/vertex-ai)
- Left sidebar → **"Vision"** → **"Imagen"**
- Click **"Try Imagen"** or **"Create"**

**3B.2 Enter Your Prompt**
- Copy the **"DETAILED POSTER PROMPT"** from [`DETAILED_POSTER_MIDJOURNEY_PROMPT.md`](DETAILED_POSTER_MIDJOURNEY_PROMPT.md)
- Paste into the prompt field
- Set **"Aspect Ratio"** to **9:20** (vertical LinkedIn format)
- Set **"Quality"** to **High**
- Click **"Generate"**
- Wait 2-3 minutes

**3B.3 Download Image**
- Right-click generated image → **"Save image as"**
- Save as PNG (high quality)
- Resize to **1200×2640px** if needed (use online tool or Photoshop)

---

# OPTION 2: Google AI Studio + Banana.dev (Lightweight)
## For Faster, Cheaper Image Generation

### What is Banana.dev?
Banana.dev is a **serverless GPU platform** that runs image generation models like **Stable Diffusion** and other lightweight models.

### Step 1: Set Up Banana.dev Account

**1.1 Create Account**
- Go to [Banana.dev](https://www.banana.dev)
- Sign up with email
- Verify email
- Go to **"Dashboard"**

**1.2 Create API Key**
- Left sidebar → **"API Keys"**
- Click **"Create API Key"**
- Name it: `uq-poster-generator`
- Copy the API key (save it safely)

**1.3 Choose a Model**
- Go to **"Models"** → Search **"Stable Diffusion XL"** or **"Realistic Vision"**
- Click the model
- Click **"Deploy"** or **"Use"**
- Note the model name/ID

---

### Step 2: Generate Image via Banana.dev

**2.1 Using Python**

```python
import banana_dev as banana
import json

# 1. Initialize with your API key
api_key = "YOUR_BANANA_API_KEY"
model_key = "YOUR_MODEL_KEY"  # From Banana dashboard

# 2. Define your prompt
prompt = """
Premium LinkedIn advertising poster (1200x2640px vertical, 9:20 ratio).
Professional male finance auditor (35-40, navy blazer, confident) shaking hands 
with holographic AI figure (glowing blue-gold, ethereal).
Warm golden lighting on human, cool blue glow on AI.
Deep navy to royal blue gradient background, office setting (blurred).
Text overlays: "UQ Consulting" (gold), "AI Meets Expertise" (white), 
8 feature cards in 2x4 grid with detailed descriptions,
CTA: "Start Free Today — uqconsulting.org"
Professional fintech aesthetic (Apple/Stripe level), cinematic, photorealistic,
shallow depth of field, premium quality, ready for LinkedIn.
"""

# 3. Make API call
try:
    result = banana.run(
        api_key=api_key,
        model_key=model_key,
        json_in={
            "prompt": prompt,
            "num_outputs": 1,
            "num_inference_steps": 50,
            "guidance_scale": 7.5,
            "width": 1200,
            "height": 2640,
            "seed": 123  # For reproducibility
        }
    )
    
    # 4. Save image
    image_url = result['modelOutputs'][0]['image_url']
    print(f"Image generated: {image_url}")
    
    # Download the image (optional)
    import urllib.request
    urllib.request.urlretrieve(image_url, "linkedin_poster.png")
    print("Image saved as linkedin_poster.png")
    
except Exception as e:
    print(f"Error: {e}")
```

**2.2 Using cURL (Terminal Command)**

```bash
curl -X POST https://api.banana.dev/start/v4/ \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_BANANA_API_KEY",
    "modelKey": "YOUR_MODEL_KEY",
    "startRequest": {
      "prompt": "Premium LinkedIn poster showing professional shaking hands with holographic AI. Navy + gold aesthetic. 1200x2640px vertical. 8 feature cards with descriptions. Fintech luxury style. Photorealistic. Shallow depth of field.",
      "num_outputs": 1,
      "num_inference_steps": 50,
      "guidance_scale": 7.5,
      "width": 1200,
      "height": 2640
    }
  }'
```

**Cost:** $0.10-0.50 per image (significantly cheaper than Google Imagen)

---

# OPTION 3: Google AI Studio to Write Enhanced Prompts
## Use Google's LLMs to Optimize Your Prompts

### Step 1: Open Google AI Studio
- Go to [aistudio.google.com](https://aistudio.google.com)
- Sign in with Google account

### Step 2: Create a New Chat/Prompt

**2.1 Start a New Conversation**
- Click **"Create new chat"**
- Select **"Gemini Pro"** (the most capable text model)

**2.2 Ask Claude/Gemini to Refine Your Prompt**

Paste this:

```
I need you to create an ultra-detailed image generation prompt for a LinkedIn poster.

Requirements:
- Format: 1200x2640px vertical (9:20 aspect ratio)
- Subject: Professional finance auditor (35-40, male, navy blazer) shaking hands with a holographic AI figure
- Background: Premium modern office, deep navy to royal blue gradient
- Lighting: Warm golden hour on human, cool blue glow on AI
- Text overlays: "UQ Consulting" (gold), "AI Meets Expertise" (white), + 8 detailed feature cards
- Style: Apple/Stripe/McKinsey level luxury fintech
- Quality: Photorealistic human, ethereal holographic AI, cinematic, high contrast
- Use case: LinkedIn advertising post

Please write a comprehensive, detailed prompt (800+ words) suitable for:
1. Midjourney v6
2. Stable Diffusion XL (via Banana.dev)
3. Google Imagen API

Include specific instructions for:
- Composition and positioning
- Lighting and shadows
- Color grading
- Text hierarchy and placement
- Image quality and resolution
- Technical camera settings
```

**2.3 Copy the Refined Prompt**
- Gemini will generate an enhanced, highly detailed prompt
- Copy the entire response
- Use it in any image generation tool (Midjourney, Banana, Imagen, Flux, etc.)

**Cost:** Free (Google AI Studio is free for testing)

---

# COMPLETE STEP-BY-STEP EXECUTION PLAN

## Option 1A: Google Imagen (Highest Quality, Most Official)

```
Step 1: Set up Google Cloud Project (15 minutes)
├─ Create project on console.cloud.google.com
├─ Enable Vertex AI API + Cloud Resource Manager API
├─ Set up billing (credit card required, $300 free credits)
├─ Create service account + download JSON key

Step 2: Access Vertex AI (5 minutes)
├─ Go to console.cloud.google.com/vertex-ai
├─ Navigate to Vision → Imagen
├─ Get your API key from AI Studio

Step 3: Generate Image (10 minutes)
├─ Use Python script (Option 3A.2) OR
├─ Use Google Cloud Console UI (Option 3B)
├─ Set aspect ratio to 9:20 (vertical LinkedIn)
├─ Paste detailed prompt from DETAILED_POSTER_MIDJOURNEY_PROMPT.md
├─ Wait 2-3 minutes for generation
├─ Download PNG image

Step 4: Upload to LinkedIn (5 minutes)
├─ Go to LinkedIn.com
├─ Click "Start a post"
├─ Upload image
├─ Paste caption from file
├─ Publish

TOTAL TIME: 35-45 minutes
TOTAL COST: $0.04-0.10 per image
```

## Option 2: Banana.dev (Fast, Cheap)

```
Step 1: Set up Banana.dev (10 minutes)
├─ Sign up at banana.dev
├─ Create API key
├─ Deploy a Stable Diffusion XL model

Step 2: Generate Image (5-10 minutes)
├─ Use Python script (Option 2.1) OR cURL command (Option 2.2)
├─ Paste your detailed prompt
├─ Run the code
├─ Wait 1-2 minutes
├─ Download image

Step 3: Upload to LinkedIn (5 minutes)
├─ Upload image
├─ Add caption
├─ Publish

TOTAL TIME: 20-25 minutes
TOTAL COST: $0.10-0.50 per image
```

## Option 3: Google AI Studio Prompt Refinement (Free)

```
Step 1: Refine Your Prompt (10 minutes)
├─ Go to aistudio.google.com
├─ Chat with Gemini Pro
├─ Ask it to enhance your poster prompt
├─ Copy the refined prompt

Step 2: Use Refined Prompt Elsewhere (5 minutes)
├─ Paste into Midjourney, Flux, Banana, or Imagen
├─ Generate image
├─ Download

Step 3: Upload to LinkedIn (5 minutes)
├─ Upload & publish

TOTAL TIME: 20 minutes
TOTAL COST: Free (use free credits elsewhere)
```

---

# COMPARISON TABLE

| Option | Quality | Speed | Cost | Setup | Best For |
|--------|---------|-------|------|-------|----------|
| **Google Imagen** | ⭐⭐⭐⭐⭐ Excellent | 2-3 min | $0.04-0.10 | 20 min | Official Google, premium quality |
| **Banana.dev** | ⭐⭐⭐⭐ Great | 1-2 min | $0.10-0.50 | 10 min | Fast, cheap, lightweight |
| **Gemini Prompt Refine** | N/A (text) | 2-3 min | Free | 5 min | Optimizing prompts before generation |
| **Midjourney** (previous guide) | ⭐⭐⭐⭐⭐ Excellent | 2-5 min | $0.40 | 0 min | No setup, best overall |
| **Flux** (previous guide) | ⭐⭐⭐⭐⭐ Excellent | 1-2 min | $1-2 | 0 min | Fast, high quality |

---

# TROUBLESHOOTING

## Issue: "API key invalid" or "Authentication failed"
**Solution:**
- Go to [aistudio.google.com](https://aistudio.google.com) → Get API Key
- Make sure it's the **"API Key"** not the **service account key**
- Ensure the project has billing enabled

## Issue: "Quota exceeded" or "Rate limit"
**Solution:**
- You've hit the free tier limit
- Upgrade to paid billing in Google Cloud Console
- Wait 24 hours for quota reset

## Issue: "Endpoint not found" or "Model not deployed"
**Solution:**
- For Vertex AI: Ensure Imagen API is enabled in your project
- Go to console.cloud.google.com → APIs & Services → Search "Imagen" → Enable

## Issue: Python script won't run
**Solution:**
- Install dependencies: `pip install google-cloud-aiplatform Pillow`
- Ensure `google-cloud-key.json` is in the same directory as your script
- Use `python3` instead of `python` if on Mac/Linux

---

# QUICK START CHECKLIST

- [ ] Create Google Cloud Project
- [ ] Enable Vertex AI API + Cloud Resource Manager API
- [ ] Set up billing (credit card required)
- [ ] Create service account + download JSON key
- [ ] Get API key from AI Studio
- [ ] Copy detailed poster prompt from [`DETAILED_POSTER_MIDJOURNEY_PROMPT.md`](DETAILED_POSTER_MIDJOURNEY_PROMPT.md)
- [ ] Choose execution method (Imagen, Banana, or Gemini prompt refinement)
- [ ] Run image generation
- [ ] Download PNG image
- [ ] Upload to LinkedIn with provided caption
- [ ] Monitor engagement

---

# NEXT STEPS

1. **Choose your method:** Google Imagen (official), Banana.dev (fast), or Gemini (free prompt refinement)
2. **Follow the step-by-step guide** for your chosen method above
3. **Generate 3-5 variations** (different seeds/prompts) to A/B test
4. **Post to LinkedIn** and track which performs best
5. **Iterate:** Use top performer as reference for next round of posters

**Ready to generate?** Pick your method and start above. Any questions on a specific step?
