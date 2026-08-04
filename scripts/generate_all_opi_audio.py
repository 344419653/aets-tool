#!/usr/bin/env python3
"""
OPI 1-16 音频批量生成脚本
适配项目结构: src/assets/audio/part5_opi/
"""

import json
import os
import subprocess
import sys

# 配置
VOICE = "en-US-GuyNeural"
RATE = "-15%"

# 路径配置（相对于scripts/目录）
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_CONFIG = os.path.join(SCRIPT_DIR, "all_opi_text_config.json")
OUTPUT_BASE = os.path.join(SCRIPT_DIR, "..", "src", "assets", "audio", "part5_opi")

def generate(text, output_path):
    """生成单个音频"""
    cmd = [
        sys.executable, "-m", "edge_tts",
        "--voice", VOICE,
        "--rate", RATE,
        "--text", text,
        "--write-media", output_path
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        return True
    except Exception as e:
        print(f"    错误: {e}")
        return False

def main():
    print("=" * 50)
    print("OPI 1-16 音频批量生成")
    print("=" * 50)
    print(f"音色: {VOICE}")
    print(f"语速: {RATE}")
    print(f"输出: {os.path.abspath(OUTPUT_BASE)}")
    print("=" * 50)

    # 读取配置
    if not os.path.exists(JSON_CONFIG):
        print(f"错误: 找不到配置文件 {JSON_CONFIG}")
        return 1

    with open(JSON_CONFIG, 'r', encoding='utf-8') as f:
        config = json.load(f)

    total_q = 0
    success_q = 0

    for opi_num_str, questions in sorted(config.items(), key=lambda x: int(x[0])):
        opi_num = int(opi_num_str)
        opi_dir = os.path.join(OUTPUT_BASE, f"OPI_{opi_num:02d}")
        os.makedirs(opi_dir, exist_ok=True)

        print(f"\n【OPI {opi_num}】共 {len(questions)} 题")
        print("-" * 40)

        for q in questions:
            output_path = os.path.join(opi_dir, q["filename"])

            # 跳过已存在
            if os.path.exists(output_path):
                print(f"  ⏭  {q['filename']} (已存在)")
                success_q += 1
                total_q += 1
                continue

            print(f"  🔊 {q['filename']} ...", end=" ", flush=True)
            if generate(q["text"], output_path):
                print("✓")
                success_q += 1
            else:
                print("✗")
            total_q += 1

    print("\n" + "=" * 50)
    print(f"完成: {success_q}/{total_q} 题")
    print(f"音频目录: {os.path.abspath(OUTPUT_BASE)}")
    print("=" * 50)
    return 0 if success_q == total_q else 1

if __name__ == "__main__":
    sys.exit(main())
