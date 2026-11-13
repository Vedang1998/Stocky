/**
 * Timeout contract for the CI jobs that run the database suites.
 *
 * The scale-envelope tests pin the `validate` job's timeout. The migration
 * suite, which they belong to, does not have to run in `validate`, so this
 * file pins the timeout of every job that runs under full CI and of the job
 * that runs the migration suite in particular.
 *
 * The workflow is read as text, like the scale-envelope tests do. A timeout
 * written as anything but a literal number is reported as missing.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const CI_WORKFLOW_PATH = path.join(REPO_ROOT, ".github/workflows/ci.yml");

const FULL_CI_JOB_TIMEOUT_MINUTES = 120;

interface WorkflowJob {
  id: string;
  /** The job's lines below its `<id>:` header, indentation kept. */
  body: string;
}

function workflowJobs(yaml: string): WorkflowJob[] {
  const lines = yaml.split("\n");
  const jobsLine = lines.findIndex((line) => /^jobs:\s*$/.test(line));
  if (jobsLine < 0) {
    throw new Error("workflow has no jobs:");
  }
  const jobs: WorkflowJob[] = [];
  for (const line of lines.slice(jobsLine + 1)) {
    if (/^\S/.test(line)) break; // next top-level key
    const header = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (header) {
      jobs.push({ id: header[1], body: "" });
    } else if (jobs.length > 0) {
      jobs[jobs.length - 1].body += `${line}\n`;
    }
  }
  return jobs;
}

function runsUnderFullCi(job: WorkflowJob): boolean {
  return /^ {4}if:.*needs\.classify\.outputs\.full_ci == 'true'/m.test(
    job.body,
  );
}

function timeoutMinutes(job: WorkflowJob): number {
  const timeout = job.body.match(/^ {4}timeout-minutes:\s*(\d+)\s*$/m);
  if (!timeout) {
    throw new Error(`job ${job.id} has no literal timeout-minutes`);
  }
  return Number(timeout[1]);
}

function fullCiJobTimeouts(yaml: string): Record<string, number> {
  return Object.fromEntries(
    workflowJobs(yaml)
      .filter(runsUnderFullCi)
      .map((job) => [job.id, timeoutMinutes(job)]),
  );
}

function runsMigrationSuite(job: WorkflowJob): boolean {
  return /^ +run: npm run test:migrations\s*$/m.test(job.body);
}

const FIXTURE = `
name: CI
jobs:
  classify:
    timeout-minutes: 10
  validate:
    if: \${{ needs.classify.outputs.full_ci == 'true' }}
    timeout-minutes: 120
    steps:
      - name: Unit tests
        run: npm test
      - name: One migration fixture
        run: npm run test:migrations -- some/file.test.ts
  migrations:
    if: \${{ needs.classify.outputs.full_ci == 'true' }}
    timeout-minutes: 120
    steps:
      - name: Migration and tenant-backfill tests
        run: npm run test:migrations
  gate:
    if: always()
    timeout-minutes: 5
`;

describe("CI full-CI job timeouts", () => {
  it(`keeps every full-CI job at ${FULL_CI_JOB_TIMEOUT_MINUTES} minutes`, () => {
    const timeouts = fullCiJobTimeouts(readFileSync(CI_WORKFLOW_PATH, "utf8"));

    expect(Object.keys(timeouts)).toContain("validate");
    for (const [job, minutes] of Object.entries(timeouts)) {
      expect({ job, minutes }).toEqual({
        job,
        minutes: FULL_CI_JOB_TIMEOUT_MINUTES,
      });
    }
  });

  it("runs the migration suite in exactly one job, under full CI, with that timeout", () => {
    const jobs = workflowJobs(readFileSync(CI_WORKFLOW_PATH, "utf8")).filter(
      runsMigrationSuite,
    );

    expect(jobs.map((job) => job.id)).toHaveLength(1);
    expect(runsUnderFullCi(jobs[0])).toBe(true);
    expect(timeoutMinutes(jobs[0])).toBe(FULL_CI_JOB_TIMEOUT_MINUTES);
  });

  it("reads each job's own timeout and leaves out jobs outside full CI", () => {
    expect(fullCiJobTimeouts(FIXTURE)).toEqual({
      validate: 120,
      migrations: 120,
    });
    expect(
      fullCiJobTimeouts(
        FIXTURE.replace(
          "timeout-minutes: 120\n    steps:\n      - name: Migration",
          "timeout-minutes: 45\n    steps:\n      - name: Migration",
        ),
      ),
    ).toEqual({ validate: 120, migrations: 45 });
  });

  it("finds the job that runs the whole migration suite, not a single fixture", () => {
    const jobs = workflowJobs(FIXTURE).filter(runsMigrationSuite);

    expect(jobs.map((job) => job.id)).toEqual(["migrations"]);
  });

  it("reports a full-CI job without a literal timeout", () => {
    const withoutTimeout = FIXTURE.replace(
      "    timeout-minutes: 120\n    steps:\n      - name: Migration",
      "    steps:\n      - name: Migration",
    );
    const aliased = FIXTURE.replace(
      "timeout-minutes: 120\n    steps:\n      - name: Migration",
      "timeout-minutes: *heavy_timeout\n    steps:\n      - name: Migration",
    );

    expect(() => fullCiJobTimeouts(withoutTimeout)).toThrow(
      "job migrations has no literal timeout-minutes",
    );
    expect(() => fullCiJobTimeouts(aliased)).toThrow(
      "job migrations has no literal timeout-minutes",
    );
  });
});
