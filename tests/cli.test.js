import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';

import main from '../bin/index.js';
import ascii from '../bin/ascii.js';

// MOCKS

const { mockGetContent } = vi.hoisted(() => ({
  mockGetContent: vi.fn(),
}));
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    repos: { getContent: mockGetContent },
  })),
}));

const { mockEmptyDir, mockWriteFile, mockCreateWriteStream } = vi.hoisted(() => ({
  mockEmptyDir: vi.fn(),
  mockWriteFile: vi.fn(),
  mockCreateWriteStream: vi.fn().mockReturnValue({
    on: vi.fn((event, callback) => {
      if (event === 'close') callback();
    }),
  }),
}));
vi.mock('fs-extra', () => ({
  default: {
    emptyDir: mockEmptyDir,
    writeFile: mockWriteFile,
    createWriteStream: mockCreateWriteStream,
  },
}));

vi.mock('ora', () => {
  const mockOra = {
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    text: '',
  };
  return { default: vi.fn(() => mockOra) };
});

const { mockArchiveInstance } = vi.hoisted(() => ({
  mockArchiveInstance: {
    pipe: vi.fn(),
    directory: vi.fn(),
    finalize: vi.fn(),
    on: vi.fn(),
  },
}));
vi.mock('archiver', () => ({ default: vi.fn(() => mockArchiveInstance) }));

vi.mock('../bin/ascii.js', () => ({
  default: {
    displayWelcomeBanner: vi.fn(),
    displaySuccessMessage: vi.fn(),
  },
}));

const {
  extract,
  fetchAllFiles,
  launchCLI,
  parseRepoUrl,
  run,
} = main;

// GLOBAL HOOKS

beforeEach(() => {
  vi.clearAllMocks();
});

// UNIT TEST

describe('parseRepoUrl()', () => {
  it('should correctly parse a standard HTTPS URL', () => {
    const url = 'https://github.com/facebook/react';
    expect(parseRepoUrl(url)).toEqual({ owner: 'facebook', repo: 'react' });
  });

  it('should correctly parse a URL with the .git suffix', () => {
    const url = 'https://github.com/vitest-dev/vitest.git';
    expect(parseRepoUrl(url)).toEqual({ owner: 'vitest-dev', repo: 'vitest' });
  });

  it('should throw an error for an invalid URL', () => {
    const url = 'https://notgithub.com/owner/repo';
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => parseRepoUrl(url)).toThrow('Invalid GitHub repository URL');
    consoleErrorSpy.mockRestore();
  });
});

// UNIT TEST

describe('fetchAllFiles()', () => {
  const owner = 'test-owner';
  const repo = 'test-repo';

  it('should recursively fetch all .md and .mdx files', async () => {
    const mockResponses = {
      docs: [
        { type: 'file', name: 'guide.md', path: 'docs/guide.md' },
        { type: 'file', name: 'index.js', path: 'docs/index.js' },
        { type: 'dir', name: 'api', path: 'docs/api' },
      ],
      'docs/api': [{ type: 'file', name: 'getting-started.mdx', path: 'docs/api/getting-started.mdx' }],
    };
    mockGetContent.mockImplementation(({ path }) => Promise.resolve({ data: mockResponses[path] }));

    const files = await fetchAllFiles(owner, repo, 'docs');

    expect(files).toHaveLength(2);
    expect(files.map((f) => f.path)).toEqual(['docs/guide.md', 'docs/api/getting-started.mdx']);
    expect(mockGetContent).toHaveBeenCalledTimes(2);
  });

  it('should return an empty array and warn if a path is not found (404)', async () => {
    const error = new Error('Not Found');
    error.status = 404;
    mockGetContent.mockRejectedValue(error);
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const files = await fetchAllFiles(owner, repo, 'non-existent-path');

    expect(files).toEqual([]);
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Warning: Path "non-existent-path" not found'));
    consoleWarnSpy.mockRestore();
  });

  it('should re-throw errors that are not 404s', async () => {
    const error = new Error('API limit exceeded');
    error.status = 500;
    mockGetContent.mockRejectedValue(error);
    await expect(fetchAllFiles(owner, repo, 'any-path')).rejects.toThrow('API limit exceeded');
  });
});

// INTEGRATION TEST

describe('extract()', () => {
  const options = {
    repo: 'https://github.com/test-owner/test-repo',
    paths: ['docs'],
    out: './test-output',
    prefix: 'ai',
    zip: false,
  };

  const mockDocsFiles = [
    { type: 'file', path: 'docs/guide.md', name: 'guide.md' },
    { type: 'file', path: 'docs/api/getting-started.mdx', name: 'getting-started.mdx' },
  ];
  const mockGuidesFiles = [
    { type: 'file', path: 'guides/installation.md', name: 'installation.md' },
  ];
  const allMockFiles = [...mockDocsFiles, ...mockGuidesFiles];

  beforeEach(() => {
    mockGetContent.mockImplementation(({ path: requestedPath }) => {
      if (requestedPath === 'docs') {
        return Promise.resolve({ data: mockDocsFiles });
      }
      if (requestedPath === 'guides') {
        return Promise.resolve({ data: mockGuidesFiles });
      }

      const isFileRequest = allMockFiles.some(file => file.path === requestedPath);
      if (isFileRequest) {
        const content = `Content for ${requestedPath}`;
        return Promise.resolve({
          data: { content: Buffer.from(content).toString('base64') },
        });
      }

      return Promise.reject(new Error(`Unexpected call to getContent with path: ${requestedPath}`));
    });
  });

  it('should download and save files with correct flattened names', async () => {
    await extract(options);

    expect(mockEmptyDir).toHaveBeenCalledWith(options.out);
    expect(mockGetContent).toHaveBeenCalledTimes(1 + mockDocsFiles.length);
    expect(mockWriteFile).toHaveBeenCalledTimes(2);

    const firstExpectedPath = path.join(options.out, 'ai-docs-guide.md');
    const secondExpectedPath = path.join(options.out, 'ai-docs-api-getting-started.mdx');

    expect(mockWriteFile).toHaveBeenCalledWith(firstExpectedPath, 'Content for docs/guide.md');
    expect(mockWriteFile).toHaveBeenCalledWith(secondExpectedPath, 'Content for docs/api/getting-started.mdx');
  });

  it('should handle multiple paths and download all files', async () => {
    const multiPathOptions = { ...options, paths: ['docs', 'guides'] };
    await extract(multiPathOptions);

    expect(mockEmptyDir).toHaveBeenCalledOnce();

    expect(mockWriteFile).toHaveBeenCalledTimes(allMockFiles.length);

    const docsFilePath = path.join(options.out, 'ai-docs-guide.md');
    const guidesFilePath = path.join(options.out, 'ai-guides-installation.md');

    expect(mockWriteFile).toHaveBeenCalledWith(docsFilePath, 'Content for docs/guide.md');
    expect(mockWriteFile).toHaveBeenCalledWith(guidesFilePath, 'Content for guides/installation.md');
  });

  it('should not add a prefix if none is provided', async () => {
    const noPrefixOptions = { ...options, prefix: '' };
    await extract(noPrefixOptions);

    const expectedPath = path.join(noPrefixOptions.out, 'docs-guide.md');
    expect(mockWriteFile).toHaveBeenCalledWith(expectedPath, 'Content for docs/guide.md');
  });

  it('should trigger archiving logic if the --zip option is true', async () => {
    const zipOptions = { ...options, zip: true };
    await extract(zipOptions);

    expect(mockCreateWriteStream).toHaveBeenCalledOnce();
    expect(mockArchiveInstance.directory).toHaveBeenCalledWith(zipOptions.out, false);
    expect(mockArchiveInstance.finalize).toHaveBeenCalledOnce();
  });

  it('should gracefully handle API rate limit errors', async () => {
    const error = new Error('Rate limit exceeded');
    error.status = 403;
    mockGetContent.mockRejectedValueOnce(error);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(extract(options)).rejects.toThrow('Rate limit exceeded');

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('API Rate Limit Exceeded'));
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('export GITHUB_TOKEN'));

    consoleErrorSpy.mockRestore();
  });
});

// UNIT TEST

describe('launchCLI()', () => {
  it('should correctly parse all provided arguments', () => {
    const argv = ['node', 'gde', '--repo', 'https://github.com/test/repo', '--out', './custom-output', '--paths', 'docs', 'guides', '--prefix', 'test', '--zip'];
    const options = launchCLI(argv);

    expect(options.repo).toBe('https://github.com/test/repo');
    expect(options.out).toBe('./custom-output');
    expect(options.paths).toEqual(['docs', 'guides']);
    expect(options.prefix).toBe('test');
    expect(options.zip).toBe(true);
  });

  it('should apply default values for optional arguments', () => {
    const argv = ['node', 'gde', '--repo', 'https://github.com/test/repo'];
    const options = launchCLI(argv);

    expect(options.out).toBe('./output');
    expect(options.paths).toBe('docs');
    expect(options.prefix).toBe('');
    expect(options.zip).toBe(false);
  });

  it('should display the welcome banner', () => {
    const argv = ['node', 'gde', '--repo', 'https://github.com/test/repo'];
    launchCLI(argv);
    expect(ascii.displayWelcomeBanner).toHaveBeenCalled();
  });
});

// INTEGRATION TEST

describe('run()', () => {
  let exitSpy;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  it('should exit with code 0 on success', async () => {
    const mockFileList = [{ path: 'docs/file.md', name: 'file.md' }];
    mockGetContent.mockImplementation(({ path: requestedPath }) => {
      if (requestedPath === 'docs') return Promise.resolve({ data: mockFileList });
      return Promise.resolve({ data: { content: Buffer.from('content').toString('base64') } });
    });

    const argv = ['node', 'gde', '--repo', 'https://github.com/test/repo'];
    await run(argv);

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should exit with code 1 if extraction fails', async () => {
    const testError = new Error('API Error');
    mockGetContent.mockRejectedValue(testError);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const argv = ['node', 'gde', '--repo', 'https://github.com/test/repo'];

    await run(argv);

    expect(exitSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
  });
});
