from setuptools import setup, find_packages


def read_requirements():
    with open("requirements.txt") as f:
        return [line.strip() for line in f if line.strip() and not line.startswith("#")]


setup(
    name="johnny-lab0",
    version="1.0.0",
    description="2026 Agentic Coding Framework - Multi-agent coordination, human oversight, and security-first architecture",
    packages=find_packages(),
    python_requires=">=3.11",
    install_requires=read_requirements(),
    extras_require={
        "dev": ["pytest>=7.4", "pytest-asyncio>=0.23"],
    },
)
