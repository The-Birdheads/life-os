import { registerPlugin } from "@capacitor/core";

export interface WidgetDataPlugin {
  writeWidgetData(options: { data: string }): Promise<void>;
  readPendingCompletions(): Promise<{ ids: string[] }>;
  clearPendingCompletions(): Promise<void>;
}

const WidgetData = registerPlugin<WidgetDataPlugin>("WidgetData", {
  web: () => ({
    async writeWidgetData() {},
    async readPendingCompletions() { return { ids: [] }; },
    async clearPendingCompletions() {},
  }),
});

export { WidgetData };
