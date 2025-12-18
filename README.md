<p align="center">
  <img src="docs/logo.png" width="200" height="200" alt="GitHub Docs Extractor"/>
<p>

<!-- omit in toc -->
# GitHub Docs Extractor

- [Why?](#why)
- [Features](#features)
- [Output Structure \& Naming Rules](#output-structure--naming-rules)
  - [1. One-level directory structure](#1-one-level-directory-structure)
  - [2. Filenames encode the full relative path](#2-filenames-encode-the-full-relative-path)
  - [3. Output directory names are included in filenames](#3-output-directory-names-are-included-in-filenames)
  - [4. Duplicate segments are avoided](#4-duplicate-segments-are-avoided)
- [Installation](#installation)
- [Usage](#usage)
  - [Options](#options)
  - [Examples](#examples)
- [Avoiding API Rate Limits](#avoiding-api-rate-limits)
- [Best Practices for Claude \& AI Projects](#best-practices-for-claude--ai-projects)
- [License](#license)

A powerful and simple CLI tool to download `.md` and `.mdx` documentation files from any public **or private** GitHub repository. It prepares the files for optimal use in **Claude Projects**, AI assistants, and Retrieval-Augmented Generation (RAG) systems by extracting documentation into a clean, predictable, and AI-friendly structure.

<div align="center">

  [![NPM Version](https://img.shields.io/npm/v/github-docs-extractor.svg?style=flat&color=CC3534)](https://www.npmjs.com/package/github-docs-extractor)
  &nbsp;[![NPM Monthly Downloads](https://img.shields.io/npm/dm/github-docs-extractor.svg?style=flat&color=30A8E6)](https://www.npmjs.com/package/github-docs-extractor)
  &nbsp;[![CI Status](https://github.com/adrienv1520/github-docs-extractor/actions/workflows/ci-release.yml/badge.svg)](https://github.com/adrienv1520/github-docs-extractor/actions/workflows/ci-release.yml)
  &nbsp;[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  &nbsp;[![GitHub Stars](https://img.shields.io/github/stars/adrienv1520/github-docs-extractor?style=social)](https://github.com/adrienv1520/github-docs-extractor)

</div>

---

## Why?

When using AI models like **Claude** or building RAG systems, the **structure and naming of your documents matter as much as the content itself**. Flattening folder structures while preserving semantic context in filenames
is critical for high-quality document retrieval.

Claude performs best when:

- Documents are **logically grouped**
- Files are **small, focused, and descriptively named**
- Folder depth is **shallow and intentional**

`github-docs-extractor` automates the extraction of GitHub documentation so it can be uploaded directly into a Claude Project or AI knowledge base with minimal manual cleanup.

---

## Features

- **Targeted Extraction**: Pull docs from one or more specific folders in a repository.
- **Claude-Ready Output**: Produces a structure aligned with Claude Project best practices.
- **Smart Filenaming**: Generates descriptive, human-readable filenames.
- **Deterministic Filenaming**: Filenames always encode the original documentation path to preserve context.
- **Category-Friendly**: Designed to work naturally with one-level subfolder organization.
- **ZIP Archiving**: Optionally create a single `.zip` file for easy upload to AI platforms.
- **User-Friendly CLI**: Interactive spinners and colored output.
- **Alias Support**: Use the shorter `gde` command.
- **Works with Private Repositories**: Supports GitHub Personal Access Tokens (PAT). See [Avoiding API Rate Limits](#avoiding-api-rate-limits).

---

## Output Structure & Naming Rules

This tool intentionally flattens documentation structures to make them
optimal for AI ingestion (Claude Projects, RAG systems, etc.).

The output always follows **deterministic and predictable rules** designed to
preserve semantic context while avoiding deep folder hierarchies.

---

### 1. One-level directory structure

All extracted files are written into a **single output directory level**.

The name of this directory is derived from the documentation path provided
using the `--paths` option.

| `--paths` value | Output directory |
|-----------------|------------------|
| `docs` | `output/` |
| `packages/react/docs` | `output/react-docs/` |
| `examples/with-mdx` | `output/examples-with-mdx/` |
| `docs/code` | `output/code/` |

Documentation container names such as `docs`, `doc`, and `documentation`
are treated as neutral and are ignored when computing the output directory name.

---

### 2. Filenames encode the full relative path

To preserve context after flattening, **filenames always encode the full
relative path under the documentation root**.

This ensures that no semantic information is lost, even when multiple files
share the same base name.

**Example input structure:**

```text
docs/
└── code/
    ├── api.md
    └── api/
        └── api.md
```

**Extracted output**:

```text
output/code/
├── code-api.md
└── code-api-api.md
```

Each folder name under the documentation path becomes part of the filename,
joined using hyphens (`-`).

---

### 3. Output directory names are included in filenames

When an output directory exists, its name is always included as the first
segment of the filename.

Example:

```shell
--paths docs/code
```

`docs/code/get-started.md` will be saved at `output/code/code-get-started.md`

This guarantees that filenames remain self-descriptive and retain their
categorical context even when uploaded into flat or semi-flat systems.

---

### 4. Duplicate segments are avoided

If a filename already starts with the expected prefix, it will not be duplicated.

This prevents redundant or unreadable filenames while keeping the naming
rules fully deterministic.

---

## Installation

Install globally via `npm`:

```bash
npm install -g github-docs-extractor
```

Or run directly using `npx`:

```bash
npx github-docs-extractor --repo <url> ...
```

---

## Usage

The command is straightforward. You must provide a repository URL. Other options are available to customize the extraction.

```bash
gde --repo <repository_url> [options]
```

_You can also use the full name `github-docs-extractor`._

### Options

| Option | Alias | Description | Default |
| ------ | ----- | ----------- | ------- |
| `--repo <url>` | `-r` | **Required.** The full URL of the GitHub repository. |  |
| `--paths <paths...>` | `-p` | One or more space-separated paths to the documentation folders in the repo. | `docs` |
| `--out <dir>` | `-o` | The destination directory for the downloaded files. | `./output` |
| `--zip` |  | If set, creates a zip archive of the output folder. | `false` |
| `--version` | `-V` | Display the version menu. |  |
| `--help` | `-h` | Display the help menu. |  |

### Examples

**1. Basic Usage (extracting the default `docs` folder)**

```bash
gde --repo "https://github.com/adrienv1520/claude-master"
```

This will download all markdown files from the `docs/` folder of the Claude Master documentation repository into a local `./output` directory with only one subfolder level.

**2. Specifying a custom path and output directory**

```bash
gde -r "https://github.com/facebook/react" -p "packages/react-dom/docs" -o "./react-dom-docs"
```

This extracts only the docs related to `react-dom` and saves them in `./react-dom-docs` with only one subfolder level if there was any.

**3. Using a multiple paths**

```bash
gde \
  --repo "https://github.com/vercel/next.js" \
  --paths docs examples/with-mdx \
  --out "./nextjs-docs"
```

This will:

- Fetch files from both `docs/` and `examples/with-mdx/`.
- Save them in `./nextjs-docs` with only one subfolder level if there was any.

**4. Creating a ZIP archive**

```bash
gde \
  --repo "https://github.com/mdn/content" \
  --paths "files/en-us/web/javascript" \
  --out "./mdn-javascript" \
  --zip
```

This command downloads the entire MDN JavaScript documentation, saves it to `./mdn-javascript`, and then creates a `mdn-javascript.zip` file in the same parent directory, ready for upload.

---

## Avoiding API Rate Limits

The GitHub API has different rate limits for requests:

- **Unauthenticated**: ~60 requests per hour (from your IP address).
- **Authenticated**: ~5,000 requests per hour (using a Personal Access Token).

This tool can make many requests for large repositories. To avoid hitting the lower limit, it is **highly recommended to use a Personal Access Token (PAT) for all uses**, including on public repositories. Using a PAT is also **required** to access private repositories.

**How to Use a Personal Access Token**:

1. **[Create a new Personal Access Token](https://github.com/settings/tokens/new)** on GitHub (the "classic" version is fine).
    - For accessing **public repos**, grant the `repo/public_repo` scope.
    - For accessing **private repos**, grant the `repo` scope.

2. **Set it as an environment variable** named `GITHUB_TOKEN` before running the command. The CLI will automatically detect and use it.

  ```bash
  # For macOS / Linux
  export GITHUB_TOKEN="your_personal_access_token_here"

  # For Windows (Command Prompt)
  set GITHUB_TOKEN="your_personal_access_token_here"

  # For Windows (PowerShell)
  $env:GITHUB_TOKEN="your_personal_access_token_here"
  ```

---

## Best Practices for Claude & AI Projects

This repository is aligned with Claude's own recommendations you can find here: [Claude Master](https://github.com/adrienv1520/claude-master?tab=readme-ov-file#best-practices-for-claude-project-knowledge-bases).

---

By using `github-docs-extractor`, you are aligning your documentation with Claude’s native strengths, resulting in better search, better context selection, and better answers.

## License

[MIT](LICENSE.md).
