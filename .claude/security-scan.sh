#!/bin/bash
# 安全掃描腳本：偵測硬編碼的密鑰、密碼等敏感資訊
# 由 PostToolUse 鉤子呼叫，透過 stdin 接收 JSON 輸入

file=$(jq -r '.tool_input.file_path // .tool_response.filePath')

# 僅掃描 .js / .ts 檔案
if [[ ! "$file" =~ \.(js|ts)$ ]] || [ ! -f "$file" ]; then
  exit 0
fi

# 掃描敏感模式
issues=$(grep -nE '(password|api_?key|secret)\s*=\s*["'"'"'][^"'"'"']+["'"'"']' "$file" 2>/dev/null)

if [ -n "$issues" ]; then
  echo "$issues"
  echo "⚠️ 潛在安全問題: $file"
else
  echo "✅ 安全檢查通過: $file"
fi
