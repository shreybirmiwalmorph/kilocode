import { afterEach, expect, test } from "bun:test"
import { Effect } from "effect"
import fs from "fs/promises"
import path from "path"
import { Agent } from "../../src/agent/agent"
import { Permission } from "../../src/permission"
import { WithInstance } from "../../src/project/with-instance"
import { disposeAllInstances, provideInstance, tmpdir } from "../fixture/fixture"

function load<A>(dir: string, fn: (svc: Agent.Interface) => Effect.Effect<A>) {
  return Effect.runPromise(provideInstance(dir)(Agent.Service.use(fn)).pipe(Effect.provide(Agent.defaultLayer)))
}

afterEach(async () => {
  await disposeAllInstances()
})

test("ask agent honors user MCP allow over generated ask rule", async () => {
  await using tmp = await tmpdir({
    config: {
      mcp: {
        context7: { type: "local", command: ["context7"] },
      },
      permission: {
        "context7_query-docs": { "*": "allow" },
      },
    },
  })

  await WithInstance.provide({
    directory: tmp.path,
    fn: async () => {
      const ask = await load(tmp.path, (svc) => svc.get("ask"))
      expect(ask).toBeDefined()
      expect(Permission.evaluate("context7_query-docs", "*", ask!.permission).action).toBe("allow")
    },
  })
})

test("plan agent honors user bash allow over read-only deny default", async () => {
  await using tmp = await tmpdir({
    config: {
      permission: {
        bash: { "cargo search *": "allow" },
      },
    },
  })

  await WithInstance.provide({
    directory: tmp.path,
    fn: async () => {
      const plan = await load(tmp.path, (svc) => svc.get("plan"))
      expect(plan).toBeDefined()
      expect(Permission.evaluate("bash", "cargo search serde", plan!.permission).action).toBe("allow")
    },
  })
})

test("plan agent still hard-denies non-plan edits after user edit allow", async () => {
  await using tmp = await tmpdir({
    config: {
      permission: {
        edit: { "src/output.log": "allow" },
      },
    },
  })

  await WithInstance.provide({
    directory: tmp.path,
    fn: async () => {
      const plan = await load(tmp.path, (svc) => svc.get("plan"))
      expect(plan).toBeDefined()
      expect(Permission.evaluate("edit", "src/output.log", plan!.permission).action).toBe("deny")
      expect(Permission.evaluate("edit", ".kilo/plans/fix.md", plan!.permission).action).toBe("allow")
      expect(Permission.evaluate("edit", ".plans/fix.md", plan!.permission).action).toBe("allow")
    },
  })
})

test("plan agent allows plan files after global edit deny", async () => {
  await using tmp = await tmpdir({
    config: {
      permission: {
        edit: "deny",
      },
    },
  })

  await WithInstance.provide({
    directory: tmp.path,
    fn: async () => {
      const plan = await load(tmp.path, (svc) => svc.get("plan"))
      expect(plan).toBeDefined()
      expect(Permission.evaluate("edit", ".kilo/plans/fix.md", plan!.permission).action).toBe("allow")
      expect(Permission.evaluate("edit", ".plans/fix.md", plan!.permission).action).toBe("allow")
      expect(Permission.evaluate("edit", "src/index.ts", plan!.permission).action).toBe("deny")
    },
  })
})

test("custom architect allows plan files despite marketplace edit deny", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      const root = path.join(dir, ".kilo", "agents")
      await fs.mkdir(root, { recursive: true })
      await Bun.write(
        path.join(root, "architect.md"),
        `---
mode: primary
description: Architect
permission:
  read: allow
  edit: deny
  bash: deny
  question: allow
  plan_exit: allow
---

Architect prompt
`,
      )
    },
  })

  await WithInstance.provide({
    directory: tmp.path,
    fn: async () => {
      const agent = await load(tmp.path, (svc) => svc.get("architect"))
      expect(agent).toBeDefined()
      expect(Permission.evaluate("edit", ".kilo/plans/fix.md", agent!.permission).action).toBe("allow")
      expect(Permission.evaluate("edit", ".plans/fix.md", agent!.permission).action).toBe("allow")
      expect(Permission.evaluate("edit", ".opencode/plans/fix.md", agent!.permission).action).toBe("allow")
      expect(Permission.evaluate("edit", "src/index.ts", agent!.permission).action).toBe("deny")
    },
  })
})

test("custom architect remains plan-file-only after user edit allow", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      const root = path.join(dir, ".kilo", "agents")
      await fs.mkdir(root, { recursive: true })
      await Bun.write(
        path.join(root, "architect.md"),
        `---
mode: primary
description: Architect
permission:
  read: allow
  edit: allow
  bash: allow
  question: allow
  plan_exit: allow
---

Architect prompt
`,
      )
    },
  })

  await WithInstance.provide({
    directory: tmp.path,
    fn: async () => {
      const agent = await load(tmp.path, (svc) => svc.get("architect"))
      expect(agent).toBeDefined()
      expect(Permission.evaluate("edit", ".kilo/plans/fix.md", agent!.permission).action).toBe("allow")
      expect(Permission.evaluate("edit", "src/index.ts", agent!.permission).action).toBe("deny")
    },
  })
})

test("custom options architect gets plan-file permissions", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      const root = path.join(dir, ".kilo", "agents")
      await fs.mkdir(root, { recursive: true })
      await Bun.write(
        path.join(root, "reviewer.md"),
        `---
id: architect
mode: primary
description: Reviewer
permission:
  read: allow
  edit: deny
  bash: deny
  question: allow
---

Reviewer prompt
`,
      )
    },
  })

  await WithInstance.provide({
    directory: tmp.path,
    fn: async () => {
      const agent = await load(tmp.path, (svc) => svc.get("reviewer"))
      expect(agent).toBeDefined()
      expect(Permission.evaluate("edit", ".kilo/plans/fix.md", agent!.permission).action).toBe("allow")
      expect(Permission.evaluate("edit", "src/index.ts", agent!.permission).action).toBe("deny")
      expect(Permission.evaluate("plan_exit", "*", agent!.permission).action).toBe("allow")
    },
  })
})

test("custom architect plan_exit deny is preserved", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      const root = path.join(dir, ".kilo", "agents")
      await fs.mkdir(root, { recursive: true })
      await Bun.write(
        path.join(root, "architect.md"),
        `---
mode: primary
description: Architect
permission:
  read: allow
  edit: deny
  bash: deny
  question: allow
  plan_exit: deny
---

Architect prompt
`,
      )
    },
  })

  await WithInstance.provide({
    directory: tmp.path,
    fn: async () => {
      const agent = await load(tmp.path, (svc) => svc.get("architect"))
      expect(agent).toBeDefined()
      expect(Permission.evaluate("edit", ".kilo/plans/fix.md", agent!.permission).action).toBe("allow")
      expect(Permission.evaluate("plan_exit", "*", agent!.permission).action).toBe("deny")
    },
  })
})
