export interface PlatformAdapter {
  readPreference(key: string): string | null;
  writePreference(key: string, value: string): void;
  download(blob: Blob, filename: string): void;
}

export const platform: PlatformAdapter = {
  readPreference(key) { try { return localStorage.getItem(key); } catch { return null; } },
  writePreference(key, value) { try { localStorage.setItem(key, value); } catch { /* private mode */ } },
  download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
};
