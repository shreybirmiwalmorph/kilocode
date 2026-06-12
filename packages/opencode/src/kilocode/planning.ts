// kilocode_change - new file
export namespace Planning {
  export function mode(name: string) {
    return name.toLowerCase()
  }

  export function agent(input: { name: string; options?: Record<string, unknown> }) {
    const id = typeof input.options?.id === "string" ? mode(input.options.id) : undefined
    const name = mode(input.name)
    return id === "architect" || name === "plan" || name === "architect"
  }

  export function guarded(input: { name: string; options?: Record<string, unknown> }) {
    return mode(input.name) === "ask" || agent(input)
  }
}
