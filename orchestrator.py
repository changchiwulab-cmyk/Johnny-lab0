"""Main orchestrator for multi-agent task execution."""

import asyncio
import networkx as nx
from typing import Dict, List, Set
from task_decomposer import TaskDecomposer
from agents.code_agent import CodeAgent
from agents.test_agent import TestAgent
from agents.doc_agent import DocAgent
from agents.security_agent import SecurityAgent


class OrchestratorAgent:
    """Orchestrates multiple specialized agents for complex task execution."""

    def __init__(self):
        """Initialize orchestrator with all available agents."""
        self.decomposer = TaskDecomposer()
        self.agents = {
            "code_agent": CodeAgent(),
            "test_agent": TestAgent(),
            "doc_agent": DocAgent(),
            "security_agent": SecurityAgent(),
        }
        self.execution_history = []

    def decompose_task(self, task: str) -> nx.DiGraph:
        """
        Decompose a complex task into subtasks with dependencies.

        Args:
            task: High-level task description

        Returns:
            DAG representing task decomposition
        """
        dag = self.decomposer.decompose(task)
        return dag

    def schedule_agents(self, dag: nx.DiGraph) -> List[Set[str]]:
        """
        Schedule agent execution based on task dependencies.

        Args:
            dag: Task dependency graph

        Returns:
            List of execution layers (sets of tasks that can run in parallel)
        """
        execution_layers = self.decomposer.get_execution_order(dag)
        return execution_layers

    async def execute_parallel(
        self, task: str, dag: nx.DiGraph, execution_layers: List[Set[str]]
    ) -> Dict[str, str]:
        """
        Execute agents in parallel, respecting task dependencies.

        Args:
            task: Original task description
            dag: Task dependency graph
            execution_layers: Layers of parallelizable tasks

        Returns:
            Dictionary mapping task IDs to their outputs
        """
        results = {}

        for layer in execution_layers:
            print(f"\n📌 Executing layer: {layer}")

            # Create tasks for parallel execution
            tasks = []
            for task_id in layer:
                task_desc = dag.nodes[task_id].get("description", task_id)
                agent_type = dag.nodes[task_id].get("agent_type", "code_agent")

                # Get dependencies' outputs for context
                deps_context = "\n".join(
                    f"[{dep_id}]:\n{results.get(dep_id, '')}"
                    for dep_id in dag.predecessors(task_id)
                    if dep_id in results
                )

                full_task = f"{task_desc}\n\nContext from dependencies:\n{deps_context}" if deps_context else task_desc

                # Schedule agent execution
                tasks.append(self._execute_agent(task_id, agent_type, full_task))

            # Wait for all tasks in this layer to complete
            layer_results = await asyncio.gather(*tasks)

            # Store results
            for task_id, output in layer_results:
                results[task_id] = output
                self.execution_history.append(
                    {"task_id": task_id, "status": "completed", "output": output}
                )

        return results

    async def _execute_agent(self, task_id: str, agent_type: str, task_desc: str):
        """
        Execute a single agent asynchronously.

        Args:
            task_id: Task identifier
            agent_type: Type of agent to use
            task_desc: Task description

        Returns:
            Tuple of (task_id, output)
        """
        try:
            agent = self.agents.get(agent_type)
            if not agent:
                return task_id, f"Error: Unknown agent type {agent_type}"

            # Run agent in a thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            output = await loop.run_in_executor(
                None, agent.execute, task_desc
            )
            return task_id, output

        except Exception as e:
            error_msg = f"Error executing {agent_type}: {str(e)}"
            self.execution_history.append(
                {"task_id": task_id, "status": "failed", "error": str(e)}
            )
            return task_id, error_msg

    def synthesize_results(self, results: Dict[str, str]) -> Dict:
        """
        Synthesize results from all agents into a comprehensive output.

        Args:
            results: Dictionary mapping task IDs to outputs

        Returns:
            Synthesized final output
        """
        synthesis = {
            "code": results.get("impl", ""),
            "tests": results.get("test", ""),
            "documentation": results.get("doc", ""),
            "security_report": results.get("security", ""),
            "execution_summary": {
                "tasks_completed": len(results),
                "total_agents_used": len(
                    set(
                        task_id
                        for task_id in results.keys()
                        if task_id in ["impl", "test", "doc", "security"]
                    )
                ),
            },
        }
        return synthesis

    async def execute(self, task: str) -> Dict:
        """
        Execute the full orchestration pipeline.

        Args:
            task: High-level task description

        Returns:
            Synthesized results from all agents
        """
        print(f"\n🚀 Starting orchestration for: {task}\n")

        # Step 1: Decompose task
        print("📊 Decomposing task...")
        dag = self.decompose_task(task)
        print(f"   Generated {len(dag.nodes())} subtasks")

        # Step 2: Schedule execution
        print("\n📅 Scheduling execution...")
        execution_layers = self.schedule_agents(dag)
        print(f"   Created {len(execution_layers)} execution layers")

        # Step 3: Execute parallel
        print("\n⚙️ Executing agents in parallel...")
        results = await self.execute_parallel(task, dag, execution_layers)

        # Step 4: Synthesize results
        print("\n🔗 Synthesizing results...")
        final_output = self.synthesize_results(results)

        print("\n✅ Orchestration completed!\n")
        return final_output


async def main():
    """Example usage of the orchestrator."""
    orchestrator = OrchestratorAgent()

    task = """
    Write a Python function that:
    1. Takes a list of dictionaries as input
    2. Filters items where the 'price' field is less than 100
    3. Sorts the filtered items by 'name' in ascending order
    4. Returns the sorted list

    The function should handle edge cases and validate inputs.
    """

    try:
        result = await orchestrator.execute(task)

        # Display results
        print("=" * 80)
        print("GENERATED CODE:")
        print("=" * 80)
        print(result["code"])

        print("\n" + "=" * 80)
        print("GENERATED TESTS:")
        print("=" * 80)
        print(result["tests"])

        print("\n" + "=" * 80)
        print("DOCUMENTATION:")
        print("=" * 80)
        print(result["documentation"])

        print("\n" + "=" * 80)
        print("SECURITY REPORT:")
        print("=" * 80)
        print(result["security_report"])

    except Exception as e:
        print(f"Orchestration failed: {str(e)}")


if __name__ == "__main__":
    asyncio.run(main())
