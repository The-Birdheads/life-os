const fs = require('fs');
let code = fs.readFileSync('src/lib/db/sqliteRepository.ts', 'utf8');

const regexes = [
    /async createTask[\s\S]*?\n    \}/m,
    /async updateTask[\s\S]*?\n    \}/m,
    /async deleteTask[\s\S]*?\n    \}/m,
    /async createAction\([\s\S]*?\n    \}/m,
    /async updateAction[\s\S]*?\n    \}/m,
    /async deleteAction\([\s\S]*?\n    \}/m,
    /async upsertTaskEntry[\s\S]*?\n    \}/m,
    /async createActionEntry[\s\S]*?\n    \}/m,
    /async deleteActionEntry[\s\S]*?\n    \}/m,
    /async upsertDailyLog[\s\S]*?\n    \}/m,
];

for (const r of regexes) {
    code = code.replace(r, (match) => {
        return match.slice(0, match.length - 5) + '    await this.save();\n    }';
    });
}

code = code.replace('import { initSqlite } from "./initSqlite";', 'import { Capacitor } from "@capacitor/core";\nimport { initSqlite, DB_NAME, sqlite } from "./initSqlite";');

const getDbRepl = `    private async getDb() {
        const db = await initSqlite();
        if (!db) throw new Error("SQLite DB not initialized");
        return db;
    }

    private async save() {
        if (Capacitor.getPlatform() === "web") {
            await sqlite.saveToStore(DB_NAME);
        }
    }`;

code = code.replace(/    private async getDb\(\) \{[\s\S]*?    \}/, getDbRepl);

fs.writeFileSync('src/lib/db/sqliteRepository.ts', code);
console.log("Replaced successfully!");
