// The slice of Node's built-in SQLite (node:sqlite, Node ≥ 22.13) that test/abuse.test.ts uses as a stand-in for D1.
// The api's tsconfig has only the Workers types, not @types/node.
declare module 'node:sqlite' {
  interface StatementSync {
    get(...params: unknown[]): unknown
    all(...params: unknown[]): unknown[]
    run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint }
  }
  export class DatabaseSync {
    constructor(path: string)
    exec(sql: string): void
    prepare(sql: string): StatementSync
  }
}
