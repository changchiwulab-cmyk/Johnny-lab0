#!/bin/bash

# PDF 文本提取工具
# 功能：從 PDF 或 DOCX 文件提取文本
# 用途：用於法務合同審查工作流程

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 函數：顯示使用方法
usage() {
    echo -e "${BLUE}PDF 文本提取工具${NC}"
    echo "用法: $0 <input_file> [output_file]"
    echo ""
    echo "示例:"
    echo "  $0 contract.pdf contract_text.txt"
    echo "  $0 contract.docx"
    echo ""
    echo "支持格式: PDF, DOCX, TXT"
}

# 檢查參數
if [ $# -lt 1 ]; then
    echo -e "${RED}❌ 錯誤：缺少輸入文件${NC}"
    usage
    exit 1
fi

INPUT_FILE="$1"
OUTPUT_FILE="${2:-${INPUT_FILE%.*}_text.txt}"

# 驗證輸入文件存在
if [ ! -f "$INPUT_FILE" ]; then
    echo -e "${RED}❌ 錯誤：文件不存在: $INPUT_FILE${NC}"
    exit 1
fi

# 獲取文件擴展名
FILE_EXT="${INPUT_FILE##*.}"
FILE_EXT="${FILE_EXT,,}" # 轉換為小寫

echo -e "${BLUE}📄 開始提取文本...${NC}"
echo "輸入文件: $INPUT_FILE"
echo "輸出文件: $OUTPUT_FILE"
echo "文件類型: $FILE_EXT"

# 根據文件類型提取文本
case "$FILE_EXT" in
    pdf)
        echo -e "${YELLOW}⏳ 從 PDF 提取文本...${NC}"
        if command -v pdftotext &> /dev/null; then
            pdftotext "$INPUT_FILE" "$OUTPUT_FILE"
            echo -e "${GREEN}✅ PDF 文本提取成功${NC}"
        elif command -v pdftxt &> /dev/null; then
            pdftxt "$INPUT_FILE" > "$OUTPUT_FILE"
            echo -e "${GREEN}✅ PDF 文本提取成功${NC}"
        else
            # 如果沒有 pdftotext，嘗試使用 Python
            if command -v python3 &> /dev/null; then
                python3 << 'PYTHON_SCRIPT'
import sys
try:
    from PyPDF2 import PdfReader
    pdf_path = sys.argv[1]
    output_path = sys.argv[2]
    with open(pdf_path, 'rb') as f:
        reader = PdfReader(f)
        text = ''
        for page in reader.pages:
            text += page.extract_text() + '\n'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(text)
    print("✅ PDF 文本提取成功")
except ImportError:
    print("❌ 錯誤: 未安裝 PyPDF2")
    sys.exit(1)
PYTHON_SCRIPT
                python3 - "$INPUT_FILE" "$OUTPUT_FILE"
            else
                echo -e "${RED}❌ 錯誤：未找到 PDF 提取工具（需要 pdftotext、pdftxt 或 PyPDF2）${NC}"
                exit 1
            fi
        fi
        ;;

    docx)
        echo -e "${YELLOW}⏳ 從 DOCX 提取文本...${NC}"
        if command -v python3 &> /dev/null; then
            python3 << 'PYTHON_SCRIPT'
import sys
try:
    from docx import Document
    docx_path = sys.argv[1]
    output_path = sys.argv[2]
    doc = Document(docx_path)
    with open(output_path, 'w', encoding='utf-8') as f:
        for para in doc.paragraphs:
            f.write(para.text + '\n')
    print("✅ DOCX 文本提取成功")
except ImportError:
    print("❌ 錯誤: 未安裝 python-docx")
    sys.exit(1)
PYTHON_SCRIPT
            python3 - "$INPUT_FILE" "$OUTPUT_FILE"
        else
            echo -e "${RED}❌ 錯誤：需要 Python 3 和 python-docx 庫${NC}"
            exit 1
        fi
        ;;

    txt)
        echo -e "${YELLOW}⏳ 複製 TXT 文件...${NC}"
        cp "$INPUT_FILE" "$OUTPUT_FILE"
        echo -e "${GREEN}✅ TXT 文件複製成功${NC}"
        ;;

    *)
        echo -e "${RED}❌ 錯誤：不支持的文件格式: .$FILE_EXT${NC}"
        echo "支持的格式: pdf, docx, txt"
        exit 1
        ;;
esac

# 驗證輸出文件
if [ -f "$OUTPUT_FILE" ]; then
    FILE_SIZE=$(wc -c < "$OUTPUT_FILE")
    echo -e "${GREEN}✅ 輸出文件已生成${NC}"
    echo "文件大小: $FILE_SIZE 字節"
else
    echo -e "${RED}❌ 錯誤：未能生成輸出文件${NC}"
    exit 1
fi

echo -e "${BLUE}完成！${NC}"
