"""Tests for orchestrator and task decomposition."""

import pytest
import networkx as nx
from task_decomposer import TaskDecomposer, TaskType


class TestTaskDecomposer:
    """Test task decomposition functionality."""

    def setup_method(self):
        """Initialize decomposer for each test."""
        self.decomposer = TaskDecomposer()

    def test_simple_task_decomposition(self):
        """Test basic task decomposition."""
        task = "Write a Python function"
        dag = self.decomposer.decompose(task)

        assert isinstance(dag, nx.DiGraph)
        assert len(dag.nodes()) > 0
        assert "impl" in dag.nodes()

    def test_complex_task_decomposition(self):
        """Test decomposition of complex task."""
        task = "Write a function to parse JSON files, validate them, test thoroughly, and document"
        dag = self.decomposer.decompose(task)

        assert len(dag.nodes()) >= 3
        # Should include implementation, testing, and security at minimum
        task_types = [dag.nodes[node].get("type") for node in dag.nodes()]
        assert TaskType.IMPLEMENTATION in task_types

    def test_dependency_extraction(self):
        """Test that dependencies are correctly extracted."""
        task = "Write code for data processing"
        dag = self.decomposer.decompose(task)

        # Implementation should not depend on anything
        impl_predecessors = list(dag.predecessors("impl"))
        assert len(impl_predecessors) == 0

        # Testing should depend on implementation
        if "test" in dag.nodes():
            test_predecessors = list(dag.predecessors("test"))
            assert "impl" in test_predecessors

    def test_execution_order(self):
        """Test that execution order respects dependencies."""
        task = "Write and test a function"
        dag = self.decomposer.decompose(task)

        layers = self.decomposer.get_execution_order(dag)
        assert len(layers) > 0

        # First layer should contain implementation
        assert "impl" in layers[0]

        # Later layers should contain dependent tasks
        task_to_layer = {}
        for i, layer in enumerate(layers):
            for task_id in layer:
                task_to_layer[task_id] = i

        # Verify dependencies are respected
        for task_id in dag.nodes():
            for predecessor in dag.predecessors(task_id):
                assert task_to_layer[predecessor] < task_to_layer[task_id]

    def test_no_circular_dependencies(self):
        """Test that decomposer doesn't create circular dependencies."""
        task = "Build a complete feature"
        dag = self.decomposer.decompose(task)

        # Should not raise error
        layers = self.decomposer.get_execution_order(dag)
        assert layers is not None

    def test_intent_extraction(self):
        """Test intent extraction from various task descriptions."""
        test_cases = [
            ("write a function", TaskType.IMPLEMENTATION),
            ("test the code", TaskType.TESTING),
            ("document the API", TaskType.DOCUMENTATION),
            ("scan for vulnerabilities", TaskType.SECURITY),
        ]

        for task, expected_type in test_cases:
            intent = self.decomposer._extract_intent(task)
            assert intent == expected_type


class TestOrchestratorIntegration:
    """Integration tests for orchestrator."""

    @pytest.mark.asyncio
    async def test_orchestrator_initialization(self):
        """Test that orchestrator initializes correctly."""
        from orchestrator import OrchestratorAgent

        orchestrator = OrchestratorAgent()
        assert orchestrator is not None
        assert len(orchestrator.agents) == 4
        assert "code_agent" in orchestrator.agents
        assert "test_agent" in orchestrator.agents
        assert "doc_agent" in orchestrator.agents
        assert "security_agent" in orchestrator.agents

    def test_task_decomposition_in_orchestrator(self):
        """Test task decomposition through orchestrator."""
        from orchestrator import OrchestratorAgent

        orchestrator = OrchestratorAgent()
        task = "Create a utility function"
        dag = orchestrator.decompose_task(task)

        assert isinstance(dag, nx.DiGraph)
        assert len(dag.nodes()) > 0

    def test_execution_scheduling(self):
        """Test execution scheduling."""
        from orchestrator import OrchestratorAgent

        orchestrator = OrchestratorAgent()
        task = "Build feature with tests"
        dag = orchestrator.decompose_task(task)
        layers = orchestrator.schedule_agents(dag)

        assert isinstance(layers, list)
        assert len(layers) > 0
        # First layer should be non-empty
        assert len(layers[0]) > 0

    def test_result_synthesis(self):
        """Test result synthesis."""
        from orchestrator import OrchestratorAgent

        orchestrator = OrchestratorAgent()

        # Mock results
        results = {
            "impl": "def hello(): pass",
            "test": "def test_hello(): pass",
            "doc": "Hello function documentation",
            "security": "No vulnerabilities found",
        }

        synthesis = orchestrator.synthesize_results(results)

        assert "code" in synthesis
        assert "tests" in synthesis
        assert "documentation" in synthesis
        assert "security_report" in synthesis
        assert "execution_summary" in synthesis
        assert synthesis["execution_summary"]["tasks_completed"] == 4


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
