<p align="center">
  <img src="docs/logo.png" alt="GitHub Docs Extractor"/>
<p>

<!-- omit in toc -->
# GitHub Docs Extractor

- [Why?](#why)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [Options](#options)
  - [Examples](#examples)
- [Avoiding API Rate Limits](#avoiding-api-rate-limits)
- [Best Practices for AI RAG](#best-practices-for-ai-rag)
    - [1. Prefer Multiple, Small Files over a Single Large File](#1-prefer-multiple-small-files-over-a-single-large-file)
    - [2. Filenames are Important Metadata](#2-filenames-are-important-metadata)
    - [3. Clean and Standard Markdown](#3-clean-and-standard-markdown)

A powerful and simple CLI tool to download `.md` and `.mdx` documentation files from any public **or private** GitHub repository. It prepares the files for optimal use in AI and Retrieval-Augmented Generation (RAG) systems by flattening the directory structure into descriptive filenames.

<p align="center">
  <a href="https://www.npmjs.com/package/github-docs-extractor">
    <img src="https://img.shields.io/npm/v/github-docs-extractor.svg?style=flat&color=CC3534" alt="NPM Version">
  </a>
  <a href="https://www.npmjs.com/package/github-docs-extractor">
    <img src="https://img.shields.io/npm/dm/github-docs-extractor.svg?style=flat&color=30A8E6" alt="NPM Monthly Downloads">
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT">
  </a>
</p>

## Why?

When using AI models like Claude or building RAG systems with frameworks like LlamaIndex or LangChain, providing well-structured, context-rich documents is crucial. A collection of small, descriptively named files is far more effective than a single massive document. This tool automates the process of fetching and preparing these files.

---

## Features

- **Targeted Extraction**: Pull docs from one or more specific folders in a repository.
- **Smart Filenaming**: Converts the original folder structure `docs/getting-started/installation.md` into a flat, descriptive filename like `prefix-docs-getting-started-installation.md`.
- **AI-Ready**: The output is perfect for direct ingestion into AI projects like Claude, Perplexity, or custom RAG pipelines.
- **ZIP Archiving**: Optionally create a single `.zip` file for easy uploading to AI platforms.
- **User-Friendly CLI**: Interactive spinners and colored output for a great user experience.
- **Alias Support**: Use the shorter `gde` command for convenience.
- **Works with Private Repositories**: The tool seamlessly works with private repositories. To access them, you need to provide a GitHub Personal Access Token. See [Avoiding API Rate Limits](#avoiding-api-rate-limits).

---

## Installation

You can install the tool globally via npm to use it anywhere:

```bash
npm install -g github-docs-extractor
```

Alternatively, you can run it directly without installation using `npx`:

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

| Option                | Alias | Description                                                                   | Default    |
| --------------------- | ----- | ----------------------------------------------------------------------------- | ---------- |
| `--repo <url>`        | `-r`  | **Required.** The full URL of the GitHub repository.                           |            |
| `--paths <paths...>`  | `-p`  | One or more space-separated paths to the documentation folders in the repo.     | `docs`     |
| `--out <dir>`         | `-o`  | The destination directory for the downloaded files.                           | `./output` |
| `--prefix <prefix>`   |       | An optional prefix to add to every downloaded filename.                       |            |
| `--zip`               |       | If set, creates a zip archive of the output folder.                           | `false`    |
| `--version`              | `-V`  | Display the version menu.                                                        |            |
| `--help`              | `-h`  | Display the help menu.                                                        |            |

### Examples

**1. Basic Usage (extracting the default `docs` folder)**

```bash
gde --repo "https://github.com/vuejs/docs"
```

This will download all markdown files from the `docs/` folder of the Vue.js documentation repository into a local `./output` directory.

**2. Specifying a custom path and output directory**

```bash
gde -r "https://github.com/facebook/react" -p "packages/react-dom/docs" -o "./react-dom-docs"
```

This extracts only the docs related to `react-dom` and saves them in `./react-dom-docs`.

**3. Using a prefix and multiple paths**

```bash
gde \
  --repo "https://github.com/vercel/next.js" \
  --paths docs examples/with-mdx \
  --prefix "nextjs" \
  --out "./nextjs-docs"
```

This will:

- Fetch files from both `docs/` and `examples/with-mdx/`.
- Save them in `./nextjs-docs`.
- Prefix every filename with `nextjs-` (e.g., `nextjs-docs-01-getting-started.mdx`).

**4. Creating a ZIP archive**

```bash
gde \
  --repo "https://github.com/mdn/content" \
  --paths "files/en-us/web/javascript" \
  --prefix "mdn-js" \
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
    - For accessing **public repos**, no special scopes/permissions are needed.
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

## Best Practices for AI RAG

The design of this tool is guided by these principles for preparing documents for Retrieval-Augmented Generation (RAG) systems:

#### 1. Prefer Multiple, Small Files over a Single Large File

RAG systems work by finding the most relevant "chunks" of text to answer a query. When you provide many small, topically-focused files, you make it easier for the system to find the exact document it needs. This reduces noise and improves the accuracy of the context provided to the AI model.

#### 2. Filenames are Important Metadata

A file named `api-reference-hooks-use-state.md` provides strong, immediate context. The RAG system can infer from the name alone that this document is highly relevant for a question about the `useState` hook. This tool's flattening strategy (`folder/file.md` -> `folder-file.md`) is designed to preserve this valuable contextual information.

#### 3. Clean and Standard Markdown

Ensure the source documentation uses clean, standard Markdown. Complex or non-standard syntax can be misinterpreted by document loaders and chunking algorithms. This tool fetches the raw content, preserving the original structure for maximum compatibility.

By using `github-docs-extractor`, you are already applying these best practices automatically, significantly improving the quality of your source material for any AI application.
