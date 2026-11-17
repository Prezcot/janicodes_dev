import { STORAGE_LIMIT_MB, type Workspace } from "./types";

const DATABASE_NAME = "jani-os-workbench";
const DATABASE_VERSION = 1;
const STORE_NAME = "state";
const WORKSPACE_KEY = "workspace";

function getIndexedDb(): IDBFactory {
  const indexedDb = (globalThis as typeof globalThis & { indexedDB?: IDBFactory }).indexedDB;
  if (!indexedDb) {
    throw new Error("JANI//OS needs IndexedDB to save this workspace, but this browser does not provide it.");
  }
  return indexedDb;
}

function openDatabase(): Promise<IDBDatabase> {
  let indexedDb: IDBFactory;
  try {
    indexedDb = getIndexedDb();
  } catch (error) {
    return Promise.reject(error);
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION);
    const fail = (message: string, cause?: unknown) => {
      if (settled) return;
      settled = true;
      reject(new Error(message, cause instanceof Error ? { cause } : undefined));
    };

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onblocked = () =>
      fail("JANI//OS could not open its workspace database because another tab is blocking the upgrade. Close other JANI//OS tabs and try again.");
    request.onerror = () => fail("JANI//OS could not open its workspace database.", request.error);
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      resolve(request.result);
    };
  });
}

function isWorkspace(value: unknown): value is Workspace {
  if (!value || typeof value !== "object") return false;
  const workspace = value as Partial<Workspace>;
  return (workspace.files === undefined || (workspace.files !== null && typeof workspace.files === "object" && !Array.isArray(workspace.files) && Object.entries(workspace.files).every(([name, content]) => name.length > 4 && name.length <= 80 && name.endsWith(".txt") && typeof content === "string"))) && typeof workspace.note === "string" && (workspace.folderName === undefined || (typeof workspace.folderName === "string" && workspace.folderName.trim().length > 0 && workspace.folderName.length <= 80));
}

function serializedWorkspace(workspace: Workspace): string {
  if (!isWorkspace(workspace)) throw new Error("JANI//OS could not save the workspace because its contents are invalid.");
  // Build a fresh object so no unrelated data is persisted.
  const payload = JSON.stringify({ note: workspace.note, folderName: workspace.folderName, files: workspace.files });
  const bytes = new TextEncoder().encode(payload).byteLength;
  const budget = STORAGE_LIMIT_MB * 1_000_000;
  if (bytes > budget) {
    throw new Error(`This workspace is ${bytes.toLocaleString()} bytes, which exceeds its ${STORAGE_LIMIT_MB} MB local storage limit.`);
  }
  return payload;
}

export async function loadWorkspace(): Promise<Workspace | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    let value: unknown;
    let settled = false;
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(STORE_NAME, "readonly");
    } catch (error) {
      database.close();
      reject(new Error("JANI//OS could not read the saved workspace.", error instanceof Error ? { cause: error } : undefined));
      return;
    }
    const finishError = (message: string, cause?: unknown) => {
      if (settled) return;
      settled = true;
      database.close();
      reject(new Error(message, cause instanceof Error ? { cause } : undefined));
    };
    transaction.onerror = () => finishError("JANI//OS could not read the saved workspace.", transaction.error);
    transaction.onabort = () => finishError("JANI//OS could not read the saved workspace because the transaction was aborted.", transaction.error);
    transaction.oncomplete = () => {
      if (settled) return;
      settled = true;
      database.close();
      if (typeof value !== "string") return resolve(null);
      try {
        const parsed: unknown = JSON.parse(value);
        resolve(isWorkspace(parsed) ? parsed : null);
      } catch {
        resolve(null);
      }
    };
    try {
      transaction.objectStore(STORE_NAME).get(WORKSPACE_KEY).onsuccess = (event) => {
        value = (event.target as IDBRequest).result;
      };
    } catch (error) {
      finishError("JANI//OS could not read the saved workspace.", error);
    }
  });
}

export async function saveWorkspace(workspace: Workspace): Promise<void> {
  const payload = serializedWorkspace(workspace);
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    let settled = false;
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(STORE_NAME, "readwrite");
    } catch (error) {
      database.close();
      reject(new Error("JANI//OS could not save the workspace.", error instanceof Error ? { cause: error } : undefined));
      return;
    }
    const finishError = (message: string, cause?: unknown) => {
      if (settled) return;
      settled = true;
      database.close();
      reject(new Error(message, cause instanceof Error ? { cause } : undefined));
    };
    transaction.onerror = () => finishError("JANI//OS could not save the workspace.", transaction.error);
    transaction.onabort = () => finishError("JANI//OS could not save the workspace because the transaction was aborted.", transaction.error);
    transaction.oncomplete = () => {
      if (settled) return;
      settled = true;
      database.close();
      resolve();
    };
    try {
      transaction.objectStore(STORE_NAME).put(payload, WORKSPACE_KEY);
    } catch (error) {
      finishError("JANI//OS could not save the workspace.", error);
    }
  });
}
