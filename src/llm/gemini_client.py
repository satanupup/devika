from typing import Any  # 新增匯入
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

from src.config import Config

class Gemini:
    def __init__(self):
        config = Config()
        self.api_key = config.get_gemini_api_key()

    def inference(self, model_id: str, prompt: str) -> str:
        # 設定安全性參數
        safety_settings = {
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
            # 可根據需求調整其他類別
        }
        # 動態存取 generate 方法
        generate_method = getattr(genai, "generate", None)
        if not callable(generate_method):
            raise AttributeError("The 'generate' method is not available in 'google.generativeai'.")

        # 呼叫 generate 方法
        response: Any = generate_method(
            model=model_id,
            prompt=prompt,
            api_key=self.api_key,
            temperature=0,
            safety_settings=safety_settings,
        )
        try:
            # 檢查回應是否包含文字
            if hasattr(response, "text") and response.text:
                return response.text
            else:
                raise AttributeError("Response does not contain text.")
        except AttributeError:
            # 如果回應不包含文字，處理錯誤
            if hasattr(response, "prompt_feedback"):
                print("Prompt feedback:", response.prompt_feedback)
            if hasattr(response, "candidates") and response.candidates:
                print("Finish reason:", response.candidates[0].finish_reason)
                print("Safety ratings:", response.candidates[0].safety_ratings)
            return "Error: Unable to generate content with Gemini API"
