import json
import re
import httpx
from backend.config import settings

def extract_json_from_text(text: str) -> dict:
    """
    Safely extract JSON object from LLM response text,
    handling markdown blocks or conversational preamble.
    """
    text = text.strip()
    # Match ```json ... ``` or ``` ... ```
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        cleaned = match.group(1).strip()
    else:
        cleaned = text

    # If it starts with { and ends with }, try parsing
    start_idx = cleaned.find("{")
    end_idx = cleaned.rfind("}")
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        cleaned = cleaned[start_idx : end_idx + 1]

    return json.loads(cleaned)


async def call_llm(messages: list, max_tokens: int = 2000, temperature: float = 0.3) -> str:
    """
    Call the configured LLM API (OpenRouter, OpenAI, or Gemini).
    Configurable via environment variables.
    """
    api_key = settings.LLM_API_KEY.strip()
    if not api_key:
        raise ValueError("LLM_API_KEY is not configured in backend environment (.env).")

    provider = settings.LLM_PROVIDER.lower()
    model = settings.LLM_MODEL or "google/gemini-2.5-flash"

    # Default to openrouter if key starts with sk-or-
    if api_key.startswith("sk-or-") or provider == "openrouter":
        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": settings.FRONTEND_URL,
            "X-Title": "AI Project Review Tool",
        }
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
    elif provider == "openai":
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model if model and not model.startswith("google/") else "gpt-4o-mini",
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
    elif provider == "gemini":
        # Google Gemini OpenAI-compatible endpoint
        url = f"https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        clean_model = model.replace("google/", "")
        payload = {
            "model": clean_model if clean_model else "gemini-2.5-flash",
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
    else:
        # Default OpenAI compatible endpoint
        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": settings.FRONTEND_URL,
            "X-Title": "AI Project Review Tool",
        }
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post(url, headers=headers, json=payload)
        
        if response.status_code != 200:
            error_text = response.text
            raise RuntimeError(f"LLM API Error ({response.status_code}): {error_text}")

        data = response.json()
        choices = data.get("choices", [])
        if not choices:
            raise RuntimeError(f"LLM returned no choices: {data}")

        return choices[0]["message"]["content"]

