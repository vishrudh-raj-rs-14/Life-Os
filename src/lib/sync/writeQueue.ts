"use client";

let tail: Promise<void> = Promise.resolve();

export function enqueueWrite(task: () => Promise<void>): Promise<void> {
  const run = tail.catch(() => {}).then(task);
  tail = run.catch(() => {});
  return run;
}

export function enqueueOptionalWrite(task: () => Promise<void>): void {
  void enqueueWrite(task).catch(() => {});
}

export async function waitForWrites(): Promise<void> {
  await tail.catch(() => {});
}

