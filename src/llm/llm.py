import sys
import os
import datetime
import threading
from typing import Tuple, Dict, Optional, Union, Any, cast # 新增 cast

import tiktoken

from src.socket_instance import emit_agent  # type: ignore
from .ollama_client import Ollama
from .claude_client import Claude
from .openai_client import OpenAi
from .gemini_client import Gemini
from .mistral_client import MistralAi
from .groq_client import Groq
from .lm_studio_client import LMStudio

from src.state import AgentState

from src.config import Config
from src.logger import Logger

TIKTOKEN_ENC = tiktoken.get_encoding("cl100k_base")

ollama = Ollama()
logger = Logger()
agentState = AgentState()
config = Config()


# --- Token 記帳模組 ---
DEFAULT_MODEL_RATES: Dict[str, Dict[str, Union[float, str]]] = {
    "Gemini 2.5 Pro": {
        "input_per_token": 0.00025,
        "output_per_token": 0.0005,
        "currency": "USD"
    },
    # 可於此擴充其他模型費率
}

class TokenAccountingModule:
    """
    追蹤與記錄 API token 使用量與估算費用的模組（優化版）
    """
    _currency_symbols = {
        "USD": "$",
        "TWD": "NT$",
        "EUR": "€",
        # 可擴充
    }

    def __init__(self,
                 log_file_path: str = "logs/token_usage_log.txt",
                 token_threshold: int = 8000,
                 model_rates: Optional[Dict[str, Dict[str, Union[float, str]]]] = None,
                 default_rate: Optional[Dict[str, Union[float, str]]] = None,
                 log_header: Optional[str] = None):
        self.log_file_path = log_file_path
        self.token_threshold = token_threshold
        self.model_rates: Dict[str, Dict[str, Union[float, str]]] = model_rates if model_rates is not None else DEFAULT_MODEL_RATES
        self.default_rate: Dict[str, Union[float, str]] = default_rate if default_rate is not None else {"input_per_token": 0.0, "output_per_token": 0.0, "currency": "USD"}
        self.log_header = log_header or "Timestamp | Model Name | Input Tokens | Output Tokens | Total Tokens | Elapsed Time (s) | Estimated Cost\n"
        self._lock = threading.Lock()
        self._ensure_log_file_exists()

    def _ensure_log_file_exists(self):
        log_dir = os.path.dirname(self.log_file_path)
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir, exist_ok=True)
        if not os.path.exists(self.log_file_path):
            try:
                with open(self.log_file_path, "w", encoding="utf-8") as f:
                    f.write(self.log_header)
            except IOError as e:
                print(f"Error: Could not create or write to log file {self.log_file_path}: {e}")

    def _get_rate(self, model_name: str) -> Dict[str, Union[float, str]]:
        if model_name in self.model_rates:
            return self.model_rates[model_name]
        else:
            # 自動補齊未知模型
            print(f"Warning: Model '{model_name}' not found in model_rates. Using default rate.")
            return self.default_rate

    def _get_currency_symbol(self, currency: str) -> str:
        return self._currency_symbols.get(currency, currency + " ")

    def _calculate_cost(self, model_name: str, input_tokens: int, output_tokens: int) -> float:
        rates = self._get_rate(model_name)
        try:
            cost = (input_tokens * float(rates.get("input_per_token", 0.0))) + \
                   (output_tokens * float(rates.get("output_per_token", 0.0)))
            return cost
        except Exception:
            return 0.0

    def log_usage(self, model_name: str, input_tokens: int, output_tokens: int, elapsed_time: float,
                  custom_timestamp: Optional[datetime.datetime] = None, show_warning: bool = True) -> str:
        timestamp = custom_timestamp if custom_timestamp else datetime.datetime.now()
        timestamp_str = timestamp.strftime("%Y/%m/%d %H:%M:%S")
        total_tokens = input_tokens + output_tokens
        rates = self._get_rate(model_name)
        estimated_cost = self._calculate_cost(model_name, input_tokens, output_tokens)
        currency = str(rates.get("currency", "USD"))  # 保證為 str
        currency_symbol = self._get_currency_symbol(currency)
        log_entry = (
            f"{timestamp_str} | "
            f"{model_name} | "
            f"{input_tokens} | "
            f"{output_tokens} | "
            f"{total_tokens} | "
            f"{elapsed_time:.2f} | "
            f"{currency_symbol}{estimated_cost:.5f}\n"
        )
        try:
            with self._lock:
                with open(self.log_file_path, "a", encoding="utf-8") as f:
                    f.write(log_entry)
        except IOError as e:
            print(f"Error: Could not write to log file {self.log_file_path}: {e}")
        if show_warning and total_tokens > self.token_threshold:
            warning_message = (
                f"⚠️ WARNING: Token usage ({total_tokens}) for model '{model_name}' "
                f"exceeded threshold ({self.token_threshold}). "
                f"Timestamp: {timestamp_str}"
            )
            print(warning_message)
        return log_entry


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

    def inference(self, prompt: str, project_name: str) -> str:
        self.update_global_token_usage(prompt, project_name)
        model_enum, model_name = self.model_enum(self.model_id or "")
        print(f"Model: {self.model_id}, Enum: {model_enum}")
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
        paid_apis: set[str] = {"OPENAI", "CLAUDE", "GOOGLE", "MISTRAL", "GROQ"}
        try:
            import concurrent.futures
            import time
            start_time: float = time.time()
            model = model_mapping[model_enum]
            # 新增：計算 input token
            if model_enum in paid_apis:
                input_tokens: int = len(TIKTOKEN_ENC.encode(prompt))
                print(f"[付費API] Input tokens: {input_tokens}")
            else:
                input_tokens = 0
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future: concurrent.futures.Future[str] = executor.submit(
                    model.inference, model_name or "", prompt  # 確保 model_name 不為 None
                )
                try:
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
                    # 新增：計算 output token
                    if model_enum in paid_apis:
                        output_tokens: int = len(TIKTOKEN_ENC.encode(response))
                        print(f"[付費API] Output tokens: {output_tokens}")
                        # Token 記帳模組記錄
                        elapsed: float = time.time() - start_time
                        self.token_accounting.log_usage(
                            model_name=model_name or "unknown",
                            input_tokens=input_tokens,
                            output_tokens=output_tokens,
                            elapsed_time=elapsed
                        )
                except concurrent.futures.TimeoutError:
                    logger.error(f"Inference failed. took too long. Model: {model_enum}, Model ID: {self.model_id}")
                    emit_agent("inference", {"type": "error", "message": "Inference took too long. Please try again."})
                    response = ""
                    sys.exit()
                except Exception as e:
                    logger.error(str(e))
                    response = ""
                    emit_agent("inference", {"type": "error", "message": str(e)})
                    sys.exit()
        except KeyError:
            raise ValueError(f"Model {model_enum} not supported")
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
