/** The most workspace data, in megabytes, that this app saves in the browser. */
export const STORAGE_LIMIT_MB = 100;

export type Workspace = {
  note: string;
  folderName?: string;
  files?: Record<string, string>;
};
