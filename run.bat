@echo off
start cmd /k "cd /d D:\tools\devika && ollama run deepseek-r1:8b"
start cmd /k "cd /d D:\tools\devika && .venv\Scripts\activate && python devika.py"
start cmd /k "cd /d D:\tools\devika\ui && bun run dev"
start http://localhost:3000
