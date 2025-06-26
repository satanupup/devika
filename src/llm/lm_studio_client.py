from src.logger import Logger
from src.config import Config
from openai import OpenAI


log = Logger()

class LMStudio:
    def __init__(self):
        try:
            self.api_endpoint = Config().get_lmstudio_api_endpoint()
            self.client = OpenAI(base_url=self.api_endpoint, api_key="not-needed")
            log.info("LM Studio available")
        except Exception:
            self.api_endpoint = None
            self.client = None
            log.warning("LM Studio not available")
            log.warning("Make sure to set the LM Studio API endpoint in the config")

    def inference(self, model_id: str, prompt: str) -> str:
        if self.client is None:
            log.error("LM Studio client is not available. Cannot perform inference.")
            raise RuntimeError("LM Studio client not initialized.")

        chat_completion = self.client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": prompt.strip(),
                }
            ],
            model=model_id, # unused 
        )
        content = chat_completion.choices[0].message.content
        if content is None:
            log.warning("LM Studio returned no content for the prompt.")
            return ""
        return content
