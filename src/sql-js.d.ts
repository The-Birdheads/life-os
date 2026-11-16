// sql.js(jeep-sqlite が使う SQLite)の型。テストで本物の SQLite を動かすのに使う分だけ
declare module "sql.js" {
    export interface Statement {
        bind(params?: unknown[]): boolean;
        step(): boolean;
        getAsObject(): Record<string, unknown>;
        free(): boolean;
    }
    export interface Database {
        exec(sql: string): { columns: string[]; values: unknown[][] }[];
        run(sql: string, params?: unknown[]): Database;
        prepare(sql: string): Statement;
        getRowsModified(): number;
        close(): void;
    }
    export interface SqlJsStatic {
        Database: new (data?: ArrayLike<number> | null) => Database;
    }
    export default function initSqlJs(config?: Record<string, unknown>): Promise<SqlJsStatic>;
}
