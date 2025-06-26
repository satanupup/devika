import os
import datetime
import threading
from typing import Dict, Optional, Union

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
    追蹤與記錄 API token 使用量與估算費用的模組
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
        currency = str(rates.get("currency", "USD"))
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
