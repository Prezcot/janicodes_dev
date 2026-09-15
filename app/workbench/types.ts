export type Wallpaper = "grid" | "work" | "clean";

export type Settings = {
  name: string;
  wallpaper: Wallpaper;
  storageMb: number;
};

export const DEFAULT_SETTINGS: Settings = {
  name: "",
  wallpaper: "grid",
  storageMb: 25,
};

export type Workspace = {
  settings: Settings;
  note: string;
  folderName?: string;
  files?: Record<string, string>;
};
