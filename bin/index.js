#!/usr/bin/env node

import path from 'node:path';

import { Octokit } from '@octokit/rest';
import archiver from 'archiver';
import chalk from 'chalk';
import { Command } from 'commander';
import fs from 'fs-extra';
import ora from 'ora';

import packageJson from '../package.json' with { type: 'json' };

/* eslint-disable n/no-unpublished-import */
import ascii from './ascii.js';
import utilities from './utilities.js';
/* eslint-enable n/no-unpublished-import */

// Initialize GitHub API client (Octokit).
// It automatically uses the GITHUB_TOKEN environment variable if set,
// which is perfect for accessing private repositories or
// increasing API rate limits.
const octokit = new Octokit();

/**
 * Creates a zip archive from a source directory.
 * @param {string} sourceDirectory - The directory to zip.
 * @param {string} outPath - The full path for the output zip file.
 * @returns {Promise<void>} A promise that resolves when the archive is created.
 */
async function createZipArchive(sourceDirectory, outPath) {
  const output = fs.createWriteStream(outPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on('close', () => resolve());
    archive.on('error', (error) => reject(error));
    archive.pipe(output);
    archive.directory(sourceDirectory, false);
    archive.finalize();
  });
}

/**
 * Extract and download files.
 * @param {Object} options - The options parsed by commander.
 * @returns {Promise<void>} A promise that resolves when the files are extracted, downloaded and archived.
 * @throws {Error}
 */
async function extract(options) {
  /* eslint-disable-next-line security-node/detect-crlf */
  console.log(chalk.yellow.bold('🚀 Starting GitHub Docs Extractor...'));

  // 1. Parse and validate the repository URL.
  const repoInfo = parseRepoUrl(options.repo);
  const { owner, repo } = repoInfo;
  const documentPaths = Array.isArray(options.paths) ? options.paths : [options.paths];
  const spinner = ora(`Fetching file list from ${chalk.green(`${owner}/${repo}`)}...`).start();
  const allFilesToDownload = [];

  try {
    // 2. Fetch file lists from all specified paths.
    for (const documentPath of documentPaths) {
      spinner.text = `Fetching files from ${chalk.green(`${owner}/${repo}/${documentPath}`)}...`;
      const filesInPath = await fetchAllFiles(owner, repo, documentPath);
      allFilesToDownload.push(...filesInPath);
    }

    if (allFilesToDownload.length === 0) {
      spinner.warn(chalk.yellow('No .md or .mdx files found in any of the specified paths.'));
      return;
    }
    spinner.succeed(chalk.green(`Found ${allFilesToDownload.length} files to download.`));

    // 3. Prepare the output directory.
    await fs.emptyDir(options.out); // fs-extra ensures the directory is empty. It will be created if it doesn't exist.

    /* eslint-disable-next-line security-node/detect-crlf */
    console.log(chalk.blueBright(`Output directory cleaned. Files will be saved to: ${path.resolve(options.out)}`));

    // 4. Download each file.
    const downloadSpinner = ora('Downloading files...').start();
    for (const file of allFilesToDownload) {
      downloadSpinner.text = `Downloading ${chalk.cyan(file.path)}`;
      const { data: fileContent } = await octokit.repos.getContent({ owner, path: file.path, repo });
      const content = Buffer.from(fileContent.content, 'base64').toString('utf8');
      const flattenedName = file.path.replaceAll(/[/\\]/g, '-');
      const newFilename = `${options.prefix ? `${options.prefix}-` : ''}${flattenedName}`;
      const outputPath = path.join(options.out, newFilename);

      await fs.writeFile(outputPath, content);
    }
    downloadSpinner.succeed(chalk.green('All files downloaded successfully.'));

    // 5. Optionally create a zip archive.
    if (options.zip) {
      const zipSpinner = ora('Creating zip archive...').start();
      const zipFileName = `${path.basename(options.out)}.zip`;
      const zipFilePath = path.join(path.dirname(path.resolve(options.out)), zipFileName);
      await createZipArchive(options.out, zipFilePath);
      zipSpinner.succeed(chalk.green(`Zip archive created at: ${zipFilePath}`));
    }

    /* eslint-disable-next-line security-node/detect-crlf */
    console.log(chalk.yellow.bold('\n✨ Operation completed!'));

    ascii.displaySuccessMessage();
  }
  catch (error) {
    spinner.fail(chalk.red.bold('An error occurred:'));
    console.error(chalk.red(error.message));
    if (error.status === 403) {
      console.error(chalk.yellow.bold('\n🙀 API Rate Limit Exceeded'));
      /* eslint-disable @stylistic/max-len */
      console.error(chalk.yellow('You have hit the GitHub API rate limit for unauthenticated requests (60 requests/hour).'));
      console.error(chalk.yellow('To fix this, create a Personal Access Token (PAT) and set it as an environment variable:'));
      console.error(chalk.cyan('  export GITHUB_TOKEN="your_token_here"'));
      console.error(chalk.yellow('This will increase your limit to 5,000 requests/hour and is recommended for all uses.'));
      /* eslint-enable @stylistic/max-len */
    }

    throw error;
  }
}

/**
 * Recursively fetches all .md and .mdx files from a given directory path in the repo.
 * @param {string} owner - The repository owner.
 * @param {string} repo - The repository name.
 * @param {string} directoryPath - The directory path within the repo to scan.
 * @returns {Promise<Array<object>>} A list of file objects returned by the GitHub API.
 * @throws {Error}
 */
async function fetchAllFiles(owner, repo, directoryPath) {
  try {
    const { data: contents } = await octokit.repos.getContent({ owner, path: directoryPath, repo });
    const files = [];

    for (const item of contents) {
      if (item.type === 'dir') {
        const subFiles = await fetchAllFiles(owner, repo, item.path);
        files.push(...subFiles);
      }
      else if (item.type === 'file' && (item.name.endsWith('.md') || item.name.endsWith('.mdx'))) {
        files.push(item);
      }
    }
    return files;
  }
  catch (error) {
    if (error.status === 404) {
      /* eslint-disable-next-line @stylistic/max-len */
      console.warn(chalk.yellow(`\n  Warning: Path "${directoryPath}" not found in repository ${owner}/${repo}. Skipping.`));
      return [];
    }
    throw error;
  }
}

/**
 * Create the CLI and parse arguments.
 * @param {string[]} argv - An array of command-line arguments.
 * @returns {Object} An object containing the options parsed by Commander.
 * @throws {Error}
 */
function launchCLI(argv) {
  try {
    const program = new Command();

    ascii.displayWelcomeBanner();

    program
      .name(`gde (${packageJson.name})`)
      .description(chalk.cyan.bold(`  ${packageJson.description}`))
      .requiredOption('-r, --repo <url>', `GitHub repository URL (e.g., https://github.com/facebook/react) (${chalk.bold('required')})`)
      .option('-o, --out <dir>', 'Destination directory for downloaded files', './output')
      .option('-p, --paths <paths...>', 'One or more space-separated paths to documentation folders', 'docs')
      .option('--prefix <prefix>', 'Prefix to add to each downloaded filename', '')
      .option('--zip', 'Create a zip archive of the output directory', false)
      .version(`v${packageJson.version}`);

    if (argv?.length <= 2) {
      program.help();
    }

    program.parse(argv);

    return program.opts();
  }
  catch (error) {
    console.error(chalk.red(`An error occurred while launching the CLI tool: ${error.message}`));
    throw error;
  }
}

/**
 * Validates and parses a GitHub repository URL to extract its owner and name.
 * @param {string} url - The full GitHub repository URL.
 * @returns {{owner: string, repo: string}|null} An object with owner and repo.
 * @throws {Error} If the URL is invalid.
 */
function parseRepoUrl(url) {
  // HTTPS URL: https://github.com/owner/repo.git or https://github.com/owner/repo
  let match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)(?:\.git)?$/i);

  // SSH URL: git@github.com:owner/repo.git
  if (!match) {
    match = url.match(/^git@github\.com:([^/]+)\/([^/]+)(?:\.git)?$/i);
  }

  if (!match || !match[1] || !match[2]) {
    const errorMessage = 'Invalid GitHub repository URL. Expected format: https://github.com/owner/repo or git@github.com:owner/repo.git';
    console.error(chalk.red.bold(errorMessage));

    throw new Error(errorMessage);
  }

  return { owner: match[1], repo: match[2].replace(/\.git$/i, '') };
}

/**
 * Main function, orchestrates the entire application flow.
 * @param {string[]} argv - The command-line arguments to run the program with.
 */
async function run(argv) {
  /* eslint-disable-next-line security-node/detect-unhandled-async-errors */
  try {
    const options = launchCLI(argv);
    await extract(options);
    /* eslint-disable-next-line n/no-process-exit */
    process.exit(0);
  }
  catch {
    /* eslint-disable-next-line n/no-process-exit */
    process.exit(1);
  }
}

// Start the program.
if (utilities.isMainModule(import.meta.url)) {
  /* eslint-disable-next-line unicorn/prefer-top-level-await */
  run(process.argv);
}

// Export functions for testing purposes.
export default {
  createZipArchive,
  extract,
  fetchAllFiles,
  launchCLI,
  parseRepoUrl,
  run,
};
