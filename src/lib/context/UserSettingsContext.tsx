import { createContext, useContext } from "react";
import type { SortRule } from "../sortTasks";

export type { SortRule };

export type UserSettings = {
  volumeUnit: string;   // '15' | '30' | '60' | 'none'
  sortRule: SortRule;   // 'manual' | 'priority' | 'volume_desc' | 'volume_asc'
  prioritizeDue: boolean; // 期限付きタスクを優先表示
};

export const UserSettingsContext = createContext<UserSettings>({
  volumeUnit: "30",
  sortRule: "manual",
  prioritizeDue: false,
});

export function useUserSettings() {
  return useContext(UserSettingsContext);
}
