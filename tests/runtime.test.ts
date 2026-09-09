import test from "node:test";
import assert from "node:assert/strict";
import { Runner } from "../electron/runtime.js";

test("external instances on unexpected ports stay observable without being adopted", async () => {
  const app: any = {
    id: "app",
    cwd: process.cwd(),
    port: 0,
    url: "http://localhost:3000/",
    name: "Example",
  };
  let listeners = [
    { pid: 111, port: 3000, cwd: process.cwd() },
    { pid: 222, port: 3001, cwd: process.cwd() },
    { pid: 333, port: 4000, cwd: "/unrelated" },
  ];
  const runner = new Runner(async () => listeners);
  let state = (await runner.refresh([app])).app;
  assert.equal(state.status, "Running Externally");
  assert.deepEqual(
    state.instances?.map((i) => i.port),
    [3000, 3001],
  );
  assert.equal(runner.children.size, 0);
  await runner.stop(app.id);
  assert.equal(state.status, "Running Externally");
  listeners = listeners.filter((l) => l.port !== 3000);
  state = (await runner.refresh([app])).app;
  assert.equal(state.url, "http://localhost:3001/");
  assert.equal(state.pid, 222);
  listeners = [];
  state = (await runner.refresh([app])).app;
  assert.equal(state.status, "Stopped");
  assert.equal(state.url, undefined);
  assert.deepEqual(state.instances, []);
});

test("multiple listeners do not inflate app counts or duplicate nested ownership", async () => {
  const apps: any = [
    { id: "parent", cwd: process.cwd(), port: 0 },
    { id: "nested", cwd: process.cwd() + "/electron", port: 0 },
  ];
  const runner = new Runner(async () => [
    { pid: 111, port: 3001, cwd: apps[1].cwd },
    { pid: 222, port: 3002, cwd: apps[1].cwd },
  ]);
  const states = await runner.refresh(apps);
  assert.equal(states.parent.status, "Stopped");
  assert.equal(states.nested.instances?.length, 2);
  assert.equal(
    Object.values(states).filter((s) => s.status === "Running Externally")
      .length,
    1,
  );
});
