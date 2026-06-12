import { describe, expect, test } from "bun:test"
import { KiloSessionPrompt } from "../../src/kilocode/session/prompt"
import { Permission } from "../../src/permission"

describe("plan permissions", () => {
  test("session edit wildcard deny does not override plan file allows", () => {
    const agent = {
      name: "plan",
      options: {},
      permission: Permission.fromConfig({
        edit: {
          "*": "deny",
          ".kilo/plans/*.md": "allow",
          ".plans/*.md": "allow",
        },
      }),
    }
    const session = {
      permission: Permission.fromConfig({
        edit: "deny",
      }),
    }

    const rules = Permission.merge(agent.permission, KiloSessionPrompt.guardPermissions({ agent, session }))

    expect(Permission.evaluate("edit", ".kilo/plans/fix.md", rules).action).toBe("allow")
    expect(Permission.evaluate("edit", ".plans/fix.md", rules).action).toBe("allow")
    expect(Permission.evaluate("edit", "src/index.ts", rules).action).toBe("deny")
  })

  test("specific session edit denies still override plan file allows", () => {
    const agent = {
      name: "architect",
      options: {},
      permission: Permission.fromConfig({
        edit: {
          "*": "deny",
          ".kilo/plans/*.md": "allow",
        },
      }),
    }
    const session = {
      permission: Permission.fromConfig({
        edit: {
          ".kilo/plans/blocked.md": "deny",
        },
      }),
    }

    const rules = Permission.merge(agent.permission, KiloSessionPrompt.guardPermissions({ agent, session }))

    expect(Permission.evaluate("edit", ".kilo/plans/allowed.md", rules).action).toBe("allow")
    expect(Permission.evaluate("edit", ".kilo/plans/blocked.md", rules).action).toBe("deny")
  })

  test("ask agent preserves session edit wildcard deny", () => {
    const agent = {
      name: "ask",
      options: {},
      permission: Permission.fromConfig({
        edit: "allow",
      }),
    }
    const session = {
      permission: Permission.fromConfig({
        edit: "deny",
      }),
    }

    const rules = Permission.merge(agent.permission, KiloSessionPrompt.guardPermissions({ agent, session }))

    expect(Permission.evaluate("edit", "src/index.ts", rules).action).toBe("deny")
  })
})
