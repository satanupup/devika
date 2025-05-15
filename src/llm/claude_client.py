from anthropic import Anthropic
from anthropic.types import TextBlock # 新增匯入

from src.config import Config

class Claude:
    def __init__(self):
        config = Config()
        api_key = config.get_claude_api_key()
        self.client = Anthropic(
            api_key=api_key,
        )

    def inference(self, model_id: str, prompt: str) -> str:
        message = self.client.messages.create(
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": prompt.strip(),
                }
            ],
            model=model_id,
            temperature=0
        )

        response_text: list[str] = []  # 明確指定型別為 list[str]
        if message.content:
            for block in message.content:
                if isinstance(block, TextBlock):  # 僅檢查是否為 TextBlock
                    response_text.append(block.text)
        
        return "".join(response_text)  # response_text 的型別現在是明確的 list[str]
