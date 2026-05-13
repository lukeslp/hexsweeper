/**
 * File Purpose: Serialize async dressing commits so stale LLM responses cannot overwrite newer floor state.
 * Primary Functions: DressingGenerationGate — begin, isCurrent, invalidate.
 * Inputs/Outputs: Caller obtains a generation id at async start; after await, commits only if isCurrent(id).
 */

export class DressingGenerationGate {
  private gen = 0;

  /** Start a new dressing operation; invalidates any in-flight operation ids. */
  begin(): number {
    return ++this.gen;
  }

  isCurrent(id: number): boolean {
    return id === this.gen;
  }

  /** Call on run boundaries (continue / restart) to drop all in-flight dressing. */
  invalidate(): void {
    this.gen++;
  }
}
