#!/usr/bin/env python3
"""Example: Multi-agent workflow for building a feature.

Demonstrates the OrchestratorAgent coordinating implementation,
security review, and test generation for a single task.

Requirements:
    export ANTHROPIC_API_KEY=your-key-here
    pip install -r requirements.txt
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents import OrchestratorAgent


def main():
    task = "Create a Python function that validates email addresses using regex"

    print(f"Task: {task}")
    print("=" * 60)

    orchestrator = OrchestratorAgent()

    print("\nStep 1: Decomposing task...")
    subtasks = orchestrator.decompose_task(task)
    for st in subtasks:
        deps = f" (depends on: {', '.join(st.dependencies)})" if st.dependencies else ""
        print(f"  - [{st.agent_type}] {st.name}{deps}")

    print("\nStep 2: Running multi-agent workflow...")
    result = orchestrator.run(task)

    print("\n--- Generated Code ---")
    print(result["code"][:500])

    print("\n--- Security Review ---")
    print(result["security_review"][:500])

    print("\n--- Generated Tests ---")
    print(result["tests"][:500])

    print("\nWorkflow complete.")


if __name__ == "__main__":
    main()
