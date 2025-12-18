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

const {
  mockEmptyDir,
  mockEnsureDir,
  mockWriteFile,
  mockCreateWriteStream,
} = vi.hoisted(() => ({
  mockEmptyDir: vi.fn(),
  mockEnsureDir: vi.fn(),
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
    ensureDir: mockEnsureDir,
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
  buildOutputLocation,
  computeOutputRoot,
  DEFAULT_DOCS_PATH,
  DEFAULT_OUTPUT_DIRECTORY_PATH,
  DEFAULT_TO_ZIP,
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

describe('buildOutputLocation()', () => {
  const outputDirectory = './output';

  it('flattens files under a simple docs path (no outputRoot)', () => {
    const result = buildOutputLocation(
      'docs/guide.md',
      'docs',
      undefined,
      outputDirectory,
    );

    expect(result).toEqual({
      directory: './output',
      filename: 'guide.md',
    });
  });

  it('preserves subfolders in filename when no outputRoot is present', () => {
    const result = buildOutputLocation(
      'docs/api/getting-started.md',
      'docs',
      undefined,
      outputDirectory,
    );

    expect(result).toEqual({
      directory: './output',
      filename: 'api-getting-started.md',
    });
  });

  it('includes outputRoot in both directory and filename', () => {
    const result = buildOutputLocation(
      'docs/code/api.md',
      'docs/code',
      'code',
      outputDirectory,
    );

    expect(result).toEqual({
      directory: path.join(outputDirectory, 'code'),
      filename: 'code-api.md',
    });
  });

  it('encodes the full relative path under documentPath into the filename', () => {
    const result = buildOutputLocation(
      'docs/code/api/api.md',
      'docs/code',
      'code',
      outputDirectory,
    );

    expect(result).toEqual({
      directory: path.join(outputDirectory, 'code'),
      filename: 'code-api-api.md',
    });
  });

  it('avoids duplicating outputRoot when already present in path parts', () => {
    const result = buildOutputLocation(
      'packages/react/docs/react-api/hooks.md',
      'packages/react/docs',
      'react-docs',
      outputDirectory,
    );

    expect(result).toEqual({
      directory: path.join(outputDirectory, 'react-docs'),
      filename: 'react-docs-react-api-hooks.md',
    });
  });

  it('handles deep non-doc paths correctly', () => {
    const result = buildOutputLocation(
      'examples/with-mdx/pages/intro.mdx',
      'examples/with-mdx',
      'examples-with-mdx',
      outputDirectory,
    );

    expect(result).toEqual({
      directory: path.join(outputDirectory, 'examples-with-mdx'),
      filename: 'examples-with-mdx-pages-intro.mdx',
    });
  });

  it('does not double-prefix filename if already flattened', () => {
    const result = buildOutputLocation(
      'docs/code/code-api.md',
      'docs/code',
      'code',
      outputDirectory,
    );

    expect(result).toEqual({
      directory: path.join(outputDirectory, 'code'),
      filename: 'code-api.md',
    });
  });

  it('handles Windows-style paths correctly', () => {
    const result = buildOutputLocation(
      'docs\\code\\api\\hooks.md',
      'docs/code',
      'code',
      outputDirectory,
    );

    expect(result).toEqual({
      directory: path.join(outputDirectory, 'code'),
      filename: 'code-api-hooks.md',
    });
  });
});

// UNIT TEST

describe('computeOutputRoot', () => {
  describe('single-segment paths', () => {
    it.each([
      ['docs', undefined],
      ['doc', undefined],
      ['documentation', undefined],
      ['help', 'help'],
      ['api', 'api'],
    ])('"%s" → %s', (input, expected) => {
      expect(computeOutputRoot(input)).toBe(expected);
    });
  });

  describe('paths starting with a documentation container', () => {
    it.each([
      ['docs/code', 'code'],
      ['docs/code/docs', 'code-docs'],
      ['docs/api/v1', 'api-v1'],
      ['documentation/reference', 'reference'],
    ])('"%s" → %s', (input, expected) => {
      expect(computeOutputRoot(input)).toBe(expected);
    });
  });

  describe('paths without a documentation container', () => {
    it.each([
      ['packages/react/docs', 'react-docs'],
      ['react/three/docs', 'three-docs'],
      ['react/three/docs/v1', 'docs-v1'],
      ['examples/with-mdx', 'examples-with-mdx'],
    ])('"%s" → %s', (input, expected) => {
      expect(computeOutputRoot(input)).toBe(expected);
    });
  });

  describe('edge cases and normalization', () => {
    it.each([
      ['docs/', undefined],
      ['/docs', undefined],
      ['/docs/', undefined],
      ['docs//code', 'code'],
      ['//packages/react/docs//', 'react-docs'],
    ])('"%s" → %s', (input, expected) => {
      expect(computeOutputRoot(input)).toBe(expected);
    });
  });
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
    vi.clearAllMocks();

    mockGetContent.mockImplementation(({ path: requestedPath }) => {
      if (requestedPath === 'docs') {
        return Promise.resolve({ data: mockDocsFiles });
      }

      if (requestedPath === 'guides') {
        return Promise.resolve({ data: mockGuidesFiles });
      }

      const isFileRequest = allMockFiles.some(
        (file) => file.path === requestedPath,
      );

      if (isFileRequest) {
        const content = `Content for ${requestedPath}`;
        return Promise.resolve({
          data: {
            content: Buffer.from(content).toString('base64'),
          },
        });
      }

      return Promise.reject(
        new Error(`Unexpected call to getContent with path: ${requestedPath}`),
      );
    });
  });

  it('downloads and writes all discovered files', async () => {
    await extract(options);

    expect(mockEmptyDir).toHaveBeenCalledOnce();
    expect(mockWriteFile).toHaveBeenCalledTimes(mockDocsFiles.length);

    mockWriteFile.mock.calls.forEach(([filePath]) => {
      expect(path.normalize(filePath)).toContain(
        path.normalize(options.out),
      );
    });
  });

  it('handles multiple documentation paths', async () => {
    const multiPathOptions = {
      ...options,
      paths: ['docs', 'guides'],
    };

    await extract(multiPathOptions);

    expect(mockEmptyDir).toHaveBeenCalledOnce();
    expect(mockWriteFile).toHaveBeenCalledTimes(allMockFiles.length);

    const directoriesUsed = mockWriteFile.mock.calls.map(
      ([filePath]) => path.dirname(filePath),
    );

    const uniqueDirs = new Set(directoriesUsed);
    expect(uniqueDirs.size).toBeGreaterThan(1);
  });

  it('creates a zip archive when --zip is enabled', async () => {
    const zipOptions = { ...options, zip: true };

    await extract(zipOptions);

    expect(mockCreateWriteStream).toHaveBeenCalledOnce();
    expect(mockArchiveInstance.directory).toHaveBeenCalledWith(
      zipOptions.out,
      false,
    );
    expect(mockArchiveInstance.finalize).toHaveBeenCalledOnce();
  });

  it('handles GitHub API rate limit errors gracefully', async () => {
    const error = new Error('Rate limit exceeded');
    error.status = 403;

    mockGetContent.mockRejectedValueOnce(error);

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await expect(extract(options)).rejects.toThrow('Rate limit exceeded');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('API Rate Limit Exceeded'),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('export GITHUB_TOKEN'),
    );

    consoleErrorSpy.mockRestore();
  });
});

// UNIT TEST

describe('launchCLI()', () => {
  it('should correctly parse all provided arguments', () => {
    const argv = ['node', 'gde', '--repo', 'https://github.com/test/repo', '--out', './custom-output', '--paths', 'docs', 'guides', '--zip'];
    const options = launchCLI(argv);

    expect(options.repo).toBe('https://github.com/test/repo');
    expect(options.out).toBe('./custom-output');
    expect(options.paths).toEqual(['docs', 'guides']);
    expect(options.zip).toBe(true);
  });

  it('should apply default values for optional arguments', () => {
    const argv = ['node', 'gde', '--repo', 'https://github.com/test/repo'];
    const options = launchCLI(argv);

    expect(options.out).toBe(DEFAULT_OUTPUT_DIRECTORY_PATH);
    expect(options.paths).toBe(DEFAULT_DOCS_PATH);
    expect(options.zip).toBe(DEFAULT_TO_ZIP);
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
