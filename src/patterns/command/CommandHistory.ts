export interface Command { readonly scope?: string; execute(): void; undo(): void; dispose(): void; }
export class EditCommand implements Command {
  constructor(private readonly forward: ()=>void, private readonly backward: ()=>void, private readonly release: ()=>void = ()=>{}, readonly scope?: string) {}
  execute(): void { this.forward(); }
  undo(): void { this.backward(); }
  dispose(): void { this.release(); }
}
export class CommandHistory extends EventTarget {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  constructor(private readonly limit = 100) { super(); }
  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
  execute(command: Command): void {
    command.execute();
    for (const stale of this.redoStack) stale.dispose(); this.redoStack = [];
    this.undoStack.push(command); if (this.undoStack.length > this.limit) this.undoStack.shift()!.dispose(); this.notify();
  }
  undo(): void { const command = this.undoStack.at(-1); if (!command) return; command.undo(); this.undoStack.pop(); this.redoStack.push(command); this.notify(); }
  redo(): void { const command = this.redoStack.at(-1); if (!command) return; command.execute(); this.redoStack.pop(); this.undoStack.push(command); this.notify(); }
  discardScope(scope: string): void {
    const keep = (command: Command): boolean => { if (command.scope !== scope) return true; command.dispose(); return false; };
    this.undoStack = this.undoStack.filter(keep); this.redoStack = this.redoStack.filter(keep); this.notify();
  }
  clear(): void { for (const command of [...this.undoStack,...this.redoStack]) command.dispose(); this.undoStack = []; this.redoStack = []; this.notify(); }
  private notify(): void { this.dispatchEvent(new Event('change')); }
}
