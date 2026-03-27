"""Task decomposition engine for multi-agent orchestration.

Breaks down complex tasks into subtasks with dependencies,
returning a structured DAG for parallel execution.
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import List, Dict, Set, Optional
import networkx as nx


class TaskType(Enum):
    """Types of tasks agents can handle."""
    IMPLEMENTATION = "implementation"
    TESTING = "testing"
    DOCUMENTATION = "documentation"
    SECURITY = "security"


@dataclass
class SubTask:
    """Represents a single subtask in the decomposition."""
    id: str
    type: TaskType
    description: str
    dependencies: Set[str] = field(default_factory=set)
    agent_type: str = ""

    def __hash__(self):
        return hash(self.id)


class TaskDecomposer:
    """Intelligently decomposes complex tasks into subtasks."""

    def __init__(self):
        self.task_patterns = {
            "write code": [
                TaskType.IMPLEMENTATION,
                TaskType.TESTING,
                TaskType.DOCUMENTATION,
                TaskType.SECURITY,
            ],
            "implement feature": [
                TaskType.IMPLEMENTATION,
                TaskType.TESTING,
                TaskType.DOCUMENTATION,
            ],
            "fix bug": [
                TaskType.IMPLEMENTATION,
                TaskType.TESTING,
                TaskType.SECURITY,
            ],
            "refactor": [
                TaskType.IMPLEMENTATION,
                TaskType.TESTING,
            ],
        }

    def decompose(self, task: str) -> nx.DiGraph:
        """
        Decompose a task into subtasks with dependencies.

        Args:
            task: High-level task description

        Returns:
            networkx.DiGraph with nodes=subtasks, edges=dependencies
        """
        # Extract task intent
        intent = self._extract_intent(task)

        # Generate subtasks based on intent
        subtasks = self._generate_subtasks(task, intent)

        # Build dependency graph
        dag = self._build_dag(subtasks)

        return dag

    def _extract_intent(self, task: str) -> TaskType:
        """Extract primary intent from task description."""
        task_lower = task.lower()

        # Check for implementation tasks
        if any(keyword in task_lower for keyword in ["write", "implement", "create", "add", "build"]):
            return TaskType.IMPLEMENTATION

        # Check for testing tasks
        if any(keyword in task_lower for keyword in ["test", "verify", "check", "validate"]):
            return TaskType.TESTING

        # Check for documentation tasks
        if any(keyword in task_lower for keyword in ["document", "comment", "explain", "describe"]):
            return TaskType.DOCUMENTATION

        # Check for security tasks
        if any(keyword in task_lower for keyword in ["secure", "protect", "audit", "scan", "vulnerability"]):
            return TaskType.SECURITY

        # Default to implementation
        return TaskType.IMPLEMENTATION

    def _generate_subtasks(self, task: str, primary_intent: TaskType) -> List[SubTask]:
        """Generate subtasks based on task description."""
        subtasks = []

        # Always include implementation if it's not security-only
        if primary_intent != TaskType.SECURITY:
            subtasks.append(
                SubTask(
                    id="impl",
                    type=TaskType.IMPLEMENTATION,
                    description=f"Implement: {task}",
                    dependencies=set(),
                    agent_type="code_agent",
                )
            )

        # Add testing (depends on implementation)
        if "test" in task.lower() or "verify" in task.lower():
            subtasks.append(
                SubTask(
                    id="test",
                    type=TaskType.TESTING,
                    description=f"Test: {task}",
                    dependencies={"impl"} if subtasks else set(),
                    agent_type="test_agent",
                )
            )
        else:
            # Auto-add testing for code tasks
            if primary_intent == TaskType.IMPLEMENTATION:
                subtasks.append(
                    SubTask(
                        id="test",
                        type=TaskType.TESTING,
                        description=f"Generate tests for: {task}",
                        dependencies={"impl"},
                        agent_type="test_agent",
                    )
                )

        # Add documentation (skip only if task is purely documentation)
        if primary_intent != TaskType.DOCUMENTATION:
            subtasks.append(
                SubTask(
                    id="doc",
                    type=TaskType.DOCUMENTATION,
                    description=f"Document: {task}",
                    dependencies={"impl"},
                    agent_type="doc_agent",
                )
            )

        # Add security scanning
        if "test" in [s.id for s in subtasks]:  # If we're testing, also scan security
            subtasks.append(
                SubTask(
                    id="security",
                    type=TaskType.SECURITY,
                    description=f"Security scan: {task}",
                    dependencies={"impl"},
                    agent_type="security_agent",
                )
            )

        return subtasks

    def _build_dag(self, subtasks: List[SubTask]) -> nx.DiGraph:
        """Build DAG from subtasks and dependencies."""
        dag = nx.DiGraph()

        # Add nodes
        for subtask in subtasks:
            dag.add_node(
                subtask.id,
                type=subtask.type,
                description=subtask.description,
                agent_type=subtask.agent_type,
            )

        # Add edges (dependencies)
        for subtask in subtasks:
            for dep in subtask.dependencies:
                if dep in [s.id for s in subtasks]:
                    dag.add_edge(dep, subtask.id)

        return dag

    def get_execution_order(self, dag: nx.DiGraph) -> List[Set[str]]:
        """
        Get optimal execution order (layers of parallelizable tasks).

        Args:
            dag: Task dependency graph

        Returns:
            List of task sets that can execute in parallel
        """
        layers = []
        remaining = set(dag.nodes())

        while remaining:
            # Find nodes with no dependencies in remaining
            current_layer = set()
            for node in remaining:
                if all(dep not in remaining for dep in dag.predecessors(node)):
                    current_layer.add(node)

            if not current_layer:
                # Circular dependency detected
                raise ValueError("Circular dependency detected in task DAG")

            layers.append(current_layer)
            remaining -= current_layer

        return layers
