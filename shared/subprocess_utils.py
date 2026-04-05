"""Unified subprocess execution utilities for consistent tool integration."""

import asyncio
import logging
import subprocess
import json
from typing import List, Dict, Optional, Callable, Any

logger = logging.getLogger(__name__)


class SubprocessRunner:
    """Unified subprocess runner with error handling and JSON parsing."""

    DEFAULT_TIMEOUT = 15
    COMMON_TOOL_TIMEOUTS = {
        "black": 10,
        "eslint": 15,
        "flake8": 12,
        "mypy": 20,
        "pytest": 30,
        "npm": 20,
        "pip": 25,
        "radon": 15,
    }

    @staticmethod
    async def run_command(
        cmd: List[str],
        timeout: Optional[int] = None,
        tool_name: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Run a command and return captured output.

        Args:
            cmd: Command to execute
            timeout: Timeout in seconds
            tool_name: Name of tool (for timeout lookup)

        Returns:
            Dict with stdout, stderr, returncode
        """
        # Determine timeout
        if timeout is None:
            if tool_name and tool_name in SubprocessRunner.COMMON_TOOL_TIMEOUTS:
                timeout = SubprocessRunner.COMMON_TOOL_TIMEOUTS[tool_name]
            else:
                timeout = SubprocessRunner.DEFAULT_TIMEOUT

        try:
            loop = asyncio.get_running_loop()
            result = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    lambda: subprocess.run(
                        cmd,
                        capture_output=True,
                        timeout=timeout,
                        text=True,
                    ),
                ),
                timeout=timeout + 5,  # Add buffer for asyncio timeout
            )

            return {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "returncode": result.returncode,
                "success": result.returncode == 0,
            }

        except asyncio.TimeoutError:
            return {
                "stdout": "",
                "stderr": f"Timeout after {timeout}s",
                "returncode": -1,
                "success": False,
                "error": "timeout",
            }

        except FileNotFoundError:
            return {
                "stdout": "",
                "stderr": f"Command not found: {cmd[0]}",
                "returncode": -1,
                "success": False,
                "error": "not_found",
            }

        except OSError as e:
            logger.warning("OS error running command %s: %s", cmd[0], e)
            return {
                "stdout": "",
                "stderr": str(e),
                "returncode": -1,
                "success": False,
                "error": "os_error",
            }

        except Exception as e:
            logger.exception("Unexpected error running command %s", cmd[0])
            return {
                "stdout": "",
                "stderr": str(e),
                "returncode": -1,
                "success": False,
                "error": "exception",
            }

    @staticmethod
    async def run_with_json_output(
        cmd: List[str],
        tool_name: Optional[str] = None,
        timeout: Optional[int] = None,
        parse_fn: Optional[Callable] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Run command and parse JSON output.

        Args:
            cmd: Command to execute
            tool_name: Name of tool for timeout lookup
            timeout: Custom timeout
            parse_fn: Optional custom parser function

        Returns:
            Parsed output or None if parsing failed
        """
        result = await SubprocessRunner.run_command(cmd, timeout, tool_name)

        if not result or not result.get("success"):
            return None

        stdout = result.get("stdout", "")
        if not stdout:
            return None

        try:
            if parse_fn:
                # Use custom parser
                return parse_fn(stdout)
            else:
                # Try default JSON parsing
                return json.loads(stdout)

        except json.JSONDecodeError:
            return None

        except Exception:
            return None

    @staticmethod
    async def run_with_text_output(
        cmd: List[str],
        tool_name: Optional[str] = None,
        timeout: Optional[int] = None,
        parse_fn: Optional[Callable] = None,
    ) -> Optional[str]:
        """
        Run command and return text output (optionally parsed).

        Args:
            cmd: Command to execute
            tool_name: Name of tool for timeout lookup
            timeout: Custom timeout
            parse_fn: Optional parser function

        Returns:
            Parsed or raw output string
        """
        result = await SubprocessRunner.run_command(cmd, timeout, tool_name)

        if not result or not result.get("success"):
            return None

        stdout = result.get("stdout", "").strip()

        if not stdout:
            return None

        if parse_fn:
            try:
                return parse_fn(stdout)
            except Exception:
                return stdout
        else:
            return stdout


class ToolIntegration:
    """Common tool integration patterns."""

    @staticmethod
    async def run_python_formatter(file_path: str, tool: str = "black") -> Optional[Dict]:
        """
        Run Python formatter (black, autopep8, etc).

        Args:
            file_path: Path to Python file
            tool: Formatter tool name

        Returns:
            Formatting result
        """
        if tool == "black":
            result = await SubprocessRunner.run_command(
                ["black", "--check", "--diff", file_path],
                tool_name="black",
            )
            return {
                "tool": "black",
                "file": file_path,
                "changed": result and result.get("returncode") != 0 if result else False,
                "diff": result.get("stdout", "") if result else "",
            }

    @staticmethod
    async def run_linter(file_path: str, tool: str = "flake8") -> Optional[List[Dict]]:
        """
        Run linter and parse issues.

        Args:
            file_path: Path to file
            tool: Linter tool name

        Returns:
            List of issues
        """
        if tool == "flake8":
            result = await SubprocessRunner.run_with_text_output(
                ["flake8", file_path, "--format=json"],
                tool_name="flake8",
            )
            if result:
                try:
                    return json.loads(result)
                except json.JSONDecodeError:
                    return None
            return None

        elif tool == "eslint":
            result = await SubprocessRunner.run_with_json_output(
                ["eslint", file_path, "--format=json"],
                tool_name="eslint",
            )
            return result

    @staticmethod
    async def run_type_checker(file_path: str, tool: str = "mypy") -> Optional[Dict]:
        """
        Run type checker.

        Args:
            file_path: Path to file
            tool: Type checker tool name

        Returns:
            Type check result
        """
        if tool == "mypy":
            result = await SubprocessRunner.run_with_text_output(
                ["mypy", file_path, "--json"],
                tool_name="mypy",
            )
            if result:
                try:
                    return json.loads(result)
                except json.JSONDecodeError:
                    return None
            return None

    @staticmethod
    async def run_dependency_audit(tool: str = "pip") -> Optional[Dict]:
        """
        Run dependency audit.

        Args:
            tool: Audit tool (pip or npm)

        Returns:
            Audit results
        """
        if tool == "pip":
            result = await SubprocessRunner.run_with_json_output(
                ["pip", "audit", "--format", "json"],
                tool_name="pip",
            )
            return result

        elif tool == "npm":
            result = await SubprocessRunner.run_with_json_output(
                ["npm", "audit", "--json"],
                tool_name="npm",
            )
            return result
