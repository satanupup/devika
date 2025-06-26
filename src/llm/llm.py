import sys
import os
import datetime
import threading
from typing import Tuple, Dict, Optional, Union, Any, cast

import tiktoken

from src.socket_instance import emit_agent  # type: ignore
from .ollama_client import Ollama
from .claude_client import Claude
from .openai_client import OpenAi
from .gemini_client import Gemini
from .mistral_client import MistralAi
from .groq_client import Groq
from .lm_studio_client import LMStudio
from .token_accounting import TokenAccountingModule, DEFAULT_MODEL_RATES  # 匯入拆分的模組

from src.state import AgentState
from src.config import Config
from src.logger import Logger

TIKTOKEN_ENC = tiktoken.get_encoding("cl100k_base")

ollama = Ollama()
logger = Logger()
agentState = AgentState()
config = Config()


class LLM:
    def __init__(self, model_id: Optional[str] = None):
        self.model_id: Optional[str] = model_id
        self.log_prompts: bool = config.get_logging_prompts()
        self.timeout_inference: int = config.get_timeout_inference()
        self.models: Dict[str, list[Tuple[str, str]]] = {
            "CLAUDE": [
                ("Claude 3 Opus", "claude-3-opus-20240229"),
                ("Claude 3 Sonnet", "claude-3-sonnet-20240229"),
                ("Claude 3 Haiku", "claude-3-haiku-20240307"),
                ("Claude 3.5 Sonnet", "claude-3-5-sonnet-20241022"),  # 新增 Claude 3.5 Sonnet
            ],
            "OPENAI": [
                ("GPT-4o-mini", "gpt-4o-mini"),
                ("GPT-4o", "gpt-4o"),
                ("GPT-4 Turbo", "gpt-4-turbo"),
                ("GPT-3.5 Turbo", "gpt-3.5-turbo-0125"),
            ],
            "GOOGLE": [
                ("Gemini 1.0 Pro", "gemini-pro"),
                ("Gemini 1.5 Flash", "gemini-1.5-flash"),
                ("Gemini 1.5 Pro", "gemini-1.5-pro"),
                ("Gemini 2.0 Flash", "gemini-2.0-flash"),  # 新增 Gemini 2.0 Flash
                ("Gemini 2.5 Pro (Preview 05-06)", "gemini-2.5-pro-preview-05-06"),  # 新增 Gemini 2.5 Pro
            ],
            "MISTRAL": [
                ("Mistral 7b", "open-mistral-7b"),
                ("Mistral 8x7b", "open-mixtral-8x7b"),
                ("Mistral Medium", "mistral-medium-latest"),
                ("Mistral Small", "mistral-small-latest"),
                ("Mistral Large", "mistral-large-latest"),
            ],
            "GROQ": [
                ("LLAMA3 8B", "llama3-8b-8192"),
                ("LLAMA3 70B", "llama3-70b-8192"),
                ("LLAMA2 70B", "llama2-70b-4096"),
                ("Mixtral", "mixtral-8x7b-32768"),
                ("GEMMA 7B", "gemma-7b-it"),
            ],
            "OLLAMA": [],
            "LM_STUDIO": [
                ("LM Studio", "local-model"),    
            ],
            
        }
        if ollama.client:
            # 修正 KeyError，根據 model 型態取 name
            def get_model_name(model: Union[Dict[str, Any], Any]) -> str: # model 的 value 可以是 Any
                if isinstance(model, dict):
                    # 明確告知 Pylance model 在此分支中的型別
                    # narrowed_model: Dict[str, Any] = model # Pylance 對此行提出問題
                    # 在 isinstance(model, dict) 之後，我們斷言 model 是 Dict[str, Any]
                    # 以便存取 "name" 等字串鍵。
                    narrowed_model = cast(Dict[str, Any], model)
                    name_value = narrowed_model.get("name") # name_value 的型別應推斷為 Optional[Any]
                    if isinstance(name_value, str):
                        return name_value
                    return "unknown" # 如果 name 不是字串或不存在，回傳 "unknown"
                elif hasattr(model, "name"):
                    name_attr = getattr(model, "name")
                    if isinstance(name_attr, str):
                        return name_attr
                    return str(name_attr) # 如果 name 屬性不是字串，嘗試轉換為字串
                else:
                    return str(model)

            self.models["OLLAMA"] = [
                (get_model_name(model), get_model_name(model)) for model in ollama.models
            ]
        self.token_accounting = TokenAccountingModule(
            log_file_path="logs/token_usage_log.txt",
            token_threshold=8000
        )

    def list_models(self) -> Dict[str, list[Tuple[str, str]]]:
        return self.models

    def model_enum(self, model_name: str) -> Tuple[Optional[str], Optional[str]]:
        model_dict: Dict[str, Tuple[Optional[str], Optional[str]]] = {
            model[0]: (model_enum, model[1]) 
            for model_enum, models in self.models.items() 
            for model in models
        }
        return model_dict.get(model_name, (None, None))

    @staticmethod
    def update_global_token_usage(string: str, project_name: str) -> None:
        token_usage: int = len(TIKTOKEN_ENC.encode(string))
        agentState.update_token_usage(project_name, token_usage)

        total: int = agentState.get_latest_token_usage(project_name) + token_usage
        emit_agent("tokens", {"token_usage": total})

    def _get_model_and_enum(self) -> Tuple[str, str, Any]:
        model_enum, model_name = self.model_enum(self.model_id or "")
        if model_enum is None:
            raise ValueError(f"Model {self.model_id} not supported")
        model_mapping: Dict[str, Union[Ollama, Claude, OpenAi, Gemini, MistralAi, Groq, LMStudio]] = {
            "OLLAMA": ollama,
            "CLAUDE": Claude(),
            "OPENAI": OpenAi(),
            "GOOGLE": Gemini(),
            "MISTRAL": MistralAi(),
            "GROQ": Groq(),
            "LM_STUDIO": LMStudio()
        }
        try:
            model = model_mapping[model_enum]
        except KeyError:
            raise ValueError(f"Model {model_enum} not supported")
        return model_enum, model_name, model

    def _handle_paid_api_tokens(self, model_enum: str, prompt: str) -> int:
        paid_apis: set[str] = {"OPENAI", "CLAUDE", "GOOGLE", "MISTRAL", "GROQ"}
        if model_enum in paid_apis:
            input_tokens: int = len(TIKTOKEN_ENC.encode(prompt))
            print(f"[付費API] Input tokens: {input_tokens}")
            return input_tokens
        return 0

    def _run_inference_with_timeout(self, model, model_name, prompt) -> Tuple[str, float]:
        import concurrent.futures
        import time
        start_time: float = time.time()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future: concurrent.futures.Future[str] = executor.submit(
                model.inference, model_name or "", prompt
            )
            while True:
                elapsed_time: float = time.time() - start_time
                elapsed_seconds: str = format(elapsed_time, ".2f")
                emit_agent("inference", {"type": "time", "elapsed_time": elapsed_seconds})
                if int(elapsed_time) == 5:
                    emit_agent("inference", {"type": "warning", "message": "Inference is taking longer than expected"})
                if elapsed_time > self.timeout_inference:
                    raise concurrent.futures.TimeoutError
                if future.done():
                    break
                time.sleep(0.5)
            response: str = future.result(timeout=self.timeout_inference).strip()
        elapsed: float = time.time() - start_time
        return response, elapsed

    def _log_token_usage_if_needed(self, model_enum: str, model_name: str, prompt: str, response: str, elapsed: float):
        """如為付費API則記錄token用量與費用"""
        paid_apis = {"OPENAI", "CLAUDE", "GOOGLE", "MISTRAL", "GROQ"}
        if model_enum in paid_apis:
            input_tokens = len(TIKTOKEN_ENC.encode(prompt))
            output_tokens = len(TIKTOKEN_ENC.encode(response))
            print(f"[付費API] Output tokens: {output_tokens}")
            self.token_accounting.log_usage(
                model_name=model_name or "unknown",
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                elapsed_time=elapsed
            )

    def inference(self, prompt: str, project_name: str) -> str:
        """主推論流程，簡化結構，錯誤集中處理"""
        self.update_global_token_usage(prompt, project_name)
        try:
            model_enum, model_name, model = self._get_model_and_enum()
            print(f"Model: {self.model_id}, Enum: {model_enum}")
            response, elapsed = self._run_inference_with_timeout(model, model_name, prompt)
            self._log_token_usage_if_needed(model_enum, model_name, prompt, response, elapsed)
        except Exception as e:
            logger.error(str(e))
            emit_agent("inference", {"type": "error", "message": str(e)})
            response = ""
            sys.exit()
        if self.log_prompts:
            logger.debug(f"Response ({model}): --> {response}")
        self.update_global_token_usage(response, project_name)
        return response

# --- 參考：Gemini 2.0 Flash API 呼叫方式 ---
# curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=GEMINI_API_KEY" \
# -H 'Content-Type: application/json' \
# -X POST \
# -d '{
#   "contents": [{
#     "parts":[{"text": "Explain how AI works"}]
#     }]
#    }'
# ------------------------------------------------
