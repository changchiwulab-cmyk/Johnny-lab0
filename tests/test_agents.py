"""Tests for agent modules."""

from unittest.mock import MagicMock, patch

from agents.security_agent import SecurityAgent, SecurityReport


class TestSecurityAgent:
    """SecurityAgent works without external API calls."""

    def test_clean_code_passes(self):
        agent = SecurityAgent()
        report = agent.run("x = 1 + 2\nprint(x)")
        assert report.passed
        assert len(report.findings) == 0

    def test_detects_eval(self):
        agent = SecurityAgent()
        report = agent.run("result = eval(user_input)")
        assert not report.passed
        assert any("eval" in f.description for f in report.findings)

    def test_detects_hardcoded_secret(self):
        agent = SecurityAgent()
        report = agent.run("password = 'super_secret_123'")
        assert not report.passed
        assert any("Credentials" in f.description for f in report.findings)

    def test_detects_shell_injection(self):
        agent = SecurityAgent()
        report = agent.run("subprocess.call(cmd, shell=True)")
        assert not report.passed
        assert any("Command Injection" in f.description for f in report.findings)

    def test_report_str_passed(self):
        report = SecurityReport(passed=True)
        assert "PASSED" in str(report)

    def test_report_str_failed(self):
        agent = SecurityAgent()
        report = agent.run("eval(x)")
        assert "FAILED" in str(report)


class TestImplementationAgent:
    """ImplementationAgent instantiation and mocked run."""

    def test_init_with_key(self):
        from agents.implementation_agent import ImplementationAgent

        agent = ImplementationAgent(api_key="test-key")
        assert agent.api_key == "test-key"

    @patch("agents.implementation_agent.anthropic.Anthropic")
    def test_run_returns_text(self, mock_anthropic_cls):
        from agents.implementation_agent import ImplementationAgent

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value.content = [
            MagicMock(text="def hello(): pass")
        ]

        agent = ImplementationAgent(api_key="test-key")
        result = agent.run("write a hello function")
        assert "def hello" in result


class TestTestingAgent:
    """TestingAgent instantiation and mocked run."""

    def test_init_with_key(self):
        from agents.testing_agent import TestingAgent

        agent = TestingAgent(api_key="test-key")
        assert agent.api_key == "test-key"

    @patch("agents.testing_agent.anthropic.Anthropic")
    def test_run_returns_test_code(self, mock_anthropic_cls):
        from agents.testing_agent import TestingAgent

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value.content = [
            MagicMock(text="def test_example(): assert True")
        ]

        agent = TestingAgent(api_key="test-key")
        result = agent.run("def add(a, b): return a + b")
        assert "test_" in result


class TestOrchestratorAgent:
    """OrchestratorAgent decomposition and mocked workflow."""

    @patch("agents.testing_agent.anthropic.Anthropic")
    @patch("agents.implementation_agent.anthropic.Anthropic")
    def test_decompose_task(self, mock_impl_cls, mock_test_cls):
        from agents.orchestrator import OrchestratorAgent

        agent = OrchestratorAgent(api_key="test-key")
        subtasks = agent.decompose_task("build a calculator")
        assert len(subtasks) == 3
        assert subtasks[0].agent_type == "implementation"

    @patch("agents.testing_agent.anthropic.Anthropic")
    @patch("agents.implementation_agent.anthropic.Anthropic")
    def test_run_returns_all_sections(self, mock_impl_cls, mock_test_cls):
        from agents.orchestrator import OrchestratorAgent

        mock_impl_client = MagicMock()
        mock_impl_cls.return_value = mock_impl_client
        mock_impl_client.messages.create.return_value.content = [
            MagicMock(text="def calc(): pass")
        ]

        mock_test_client = MagicMock()
        mock_test_cls.return_value = mock_test_client
        mock_test_client.messages.create.return_value.content = [
            MagicMock(text="def test_calc(): assert True")
        ]

        agent = OrchestratorAgent(api_key="test-key")
        result = agent.run("build a calculator")
        assert "code" in result
        assert "security_review" in result
        assert "tests" in result
