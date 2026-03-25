#!/bin/bash

# 自動化鉤子驗證腳本
# 用途: 驗證所有配置的自動化鉤子是否正常運行
# 使用: bash verify-hooks.sh

echo "🔍 開始驗證自動化鉤子系統..."
echo "================================"

# 色彩定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 計數器
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 測試函數
test_hook() {
  local test_name=$1
  local test_command=$2
  local expected_result=$3

  TOTAL_TESTS=$((TOTAL_TESTS + 1))

  echo -e "\n${BLUE}測試 #${TOTAL_TESTS}: ${test_name}${NC}"
  echo "命令: $test_command"

  # 執行命令並捕獲結果
  if eval "$test_command" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 通過${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    echo -e "${RED}❌ 失敗${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
}

# 1. 檢查配置文件
echo -e "\n${YELLOW}1️⃣  檢查鉤子配置文件${NC}"
if [ -f ".claude/settings.json" ]; then
  echo -e "${GREEN}✅ 配置文件存在: .claude/settings.json${NC}"

  # 驗證 PostToolUse 鉤子
  if grep -q "PostToolUse" .claude/settings.json; then
    echo -e "${GREEN}✅ PostToolUse 鉤子已配置${NC}"
  else
    echo -e "${RED}❌ PostToolUse 鉤子未配置${NC}"
  fi

  # 驗證 PreToolUse 鉤子
  if grep -q "PreToolUse" .claude/settings.json; then
    echo -e "${GREEN}✅ PreToolUse 鉤子已配置${NC}"
  else
    echo -e "${RED}❌ PreToolUse 鉤子未配置${NC}"
  fi
else
  echo -e "${RED}❌ 配置文件不存在${NC}"
fi

# 2. 檢查必要工具
echo -e "\n${YELLOW}2️⃣  檢查必要的命令行工具${NC}"

# 檢查 Prettier
test_hook "Prettier 是否可用" "which prettier > /dev/null" "found"

# 檢查 Node.js
test_hook "Node.js 是否可用" "which node > /dev/null" "found"

# 檢查 npm
test_hook "NPM 是否可用" "which npm > /dev/null" "found"

# 檢查 jq (用於 JSON 解析)
test_hook "jq 是否可用" "which jq > /dev/null" "found"

# 3. 測試格式化功能
echo -e "\n${YELLOW}3️⃣  測試代碼格式化${NC}"

# 創建測試文件
TEST_FILE="/tmp/test-format-$$.js"
echo "const x={a:1,b:2}" > "$TEST_FILE"

test_hook "Prettier 格式化 JavaScript" "npx prettier --write '$TEST_FILE'" "formatted"

# 清理測試文件
rm -f "$TEST_FILE"

# 4. 測試 JSON 格式化
echo -e "\n${YELLOW}4️⃣  測試 JSON 格式化${NC}"

TEST_JSON="/tmp/test-format-$$.json"
echo '{"name":"test","version":"1.0.0"}' > "$TEST_JSON"

test_hook "Prettier 格式化 JSON" "npx prettier --write '$TEST_JSON'" "formatted"

# 清理測試文件
rm -f "$TEST_JSON"

# 5. 測試 npm 命令
echo -e "\n${YELLOW}5️⃣  測試 NPM 集成${NC}"

if [ -f "package.json" ]; then
  test_hook "npm test 可執行" "npm test" "executed"
else
  echo -e "${YELLOW}⚠️  package.json 不存在，跳過 npm 測試${NC}"
fi

# 6. 驗證環境變量
echo -e "\n${YELLOW}6️⃣  驗證環境配置${NC}"

if grep -q "AGENTIC_MODE" .claude/settings.json; then
  echo -e "${GREEN}✅ AGENTIC_MODE 已配置${NC}"
fi

if grep -q "SECURITY_LEVEL" .claude/settings.json; then
  echo -e "${GREEN}✅ SECURITY_LEVEL 已配置${NC}"
fi

if grep -q "AUTO_REVIEW" .claude/settings.json; then
  echo -e "${GREEN}✅ AUTO_REVIEW 已配置${NC}"
fi

# 顯示測試總結
echo -e "\n${BLUE}================================${NC}"
echo -e "${BLUE}測試總結${NC}"
echo -e "${BLUE}================================${NC}"
echo -e "總測試數: ${TOTAL_TESTS}"
echo -e "${GREEN}通過: ${PASSED_TESTS}${NC}"
echo -e "${RED}失敗: ${FAILED_TESTS}${NC}"

if [ $FAILED_TESTS -eq 0 ] && [ $TOTAL_TESTS -gt 0 ]; then
  echo -e "\n${GREEN}✅ 所有測試通過！自動化鉤子系統運行正常${NC}"
  exit 0
else
  echo -e "\n${RED}❌ 某些測試失敗，請檢查配置${NC}"
  exit 1
fi
