from setuptools import setup, find_packages

with open("README.md", encoding="utf-8") as f:
    long_description = f.read()

with open("requirements.txt", encoding="utf-8") as f:
    requirements = [
        line.strip()
        for line in f
        if line.strip() and not line.startswith("#")
    ]

setup(
    name="johnny-lab0",
    version="0.1.0",
    description="2026 Agentic Coding Framework Reference Library",
    long_description=long_description,
    long_description_content_type="text/markdown",
    author="Johnny",
    python_requires=">=3.11",
    packages=find_packages(exclude=["tests", "tests.*"]),
    install_requires=requirements,
    extras_require={
        "dev": [
            "pytest>=8.0",
            "pytest-cov>=5.0",
            "pytest-asyncio>=0.24",
            "ruff>=0.8.0",
            "pre-commit>=3.6",
        ],
        "security": [
            "bandit>=1.8",
            "safety>=3.0",
            "detect-secrets>=1.5",
        ],
    },
    entry_points={
        "console_scripts": [
            "johnny-lab0=johnny_lab0.cli:main",
        ],
    },
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Libraries :: Application Frameworks",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
)
