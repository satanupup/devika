from mistralai import Mistral  # 移除未用的 UserMessage

from src.config import Config


class MistralAi:
    def __init__(self):
        config = Config()
        api_key = config.get_mistral_api_key()
        self.client = Mistral(api_key=api_key)

    def inference(self, model_id: str, prompt: str) -> str:
        print("prompt", prompt.strip())
        chat_response = self.client.chat.complete(
            model=model_id,
            messages=[
                {
                    "role": "user",
                    "content": prompt.strip()
                }
            ],
        )
        # 安全存取 choices/message/content
        if not chat_response.choices:
            return ""
        message = chat_response.choices[0].message
        content = getattr(message, "content", None)
        if isinstance(content, str):
            return content
        return ""
