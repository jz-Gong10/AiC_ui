import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import type { Asset, AuthResult, Decision, ExportTask, Job, Page, PhotoGroup, Project, ProjectSettings, Summary, UploadBatch, User } from './types';
import { isDemoSession } from './demoMode';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
export const http = axios.create({ baseURL, timeout: 30_000 });
let accessToken: string | null = null;
export function setAccessToken(value: string | null) { accessToken = value; }
http.interceptors.request.use(config => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

interface Envelope<T> { data: T; meta?: { requestId?: string } }
interface ErrorEnvelope { error?: { code?: string; message?: string; details?: unknown }; meta?: { requestId?: string } }
export class ApiError extends Error {
  constructor(public code: string, message: string, public status?: number, public details?: unknown, public requestId?: string) { super(message); }
}
function normalizeError(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const response = (error as AxiosError<ErrorEnvelope>).response;
    const payload = response?.data;
    if (payload?.error) throw new ApiError(payload.error.code || 'API_ERROR', payload.error.message || '请求失败', response?.status, payload.error.details, payload.meta?.requestId);
    throw new ApiError('NETWORK_ERROR', response ? `服务暂时不可用（${response.status}）` : '无法连接服务，请检查后端是否已启动', response?.status);
  }
  throw error;
}
async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  try { return (await http.get<Envelope<T>>(url, config)).data.data; } catch (error) { return normalizeError(error); }
}
async function post<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  try { return (await http.post<Envelope<T>>(url, body, config)).data.data; } catch (error) { return normalizeError(error); }
}
async function patch<T>(url: string, body: unknown): Promise<T> {
  try { return (await http.patch<Envelope<T>>(url, body)).data.data; } catch (error) { return normalizeError(error); }
}
const realApi = {
  login: (email: string, password: string) => post<AuthResult>('/auth/login', { email, password }),
  register: (email: string, password: string, displayName: string) => post<AuthResult>('/auth/register', { email, password, displayName }),
  me: () => get<User>('/auth/me'),
  logout: () => post<{ success: boolean }>('/auth/logout'),
  projects: (page = 1) => get<Page<Project>>('/projects', { params: { page, pageSize: 50, sort: 'createdAt:desc' } }),
  project: (id: string) => get<Project>(`/projects/${id}`),
  createProject: (name: string) => post<Project>('/projects', { name }),
  patchSettings: (id: string, settings: Partial<ProjectSettings>) => patch<Project>(`/projects/${id}/settings`, settings),
  deleteProject: async (id: string) => { try { return (await http.delete(`/projects/${id}`)).data; } catch (error) { return normalizeError(error); } },
  assets: (projectId: string, page: number, filter?: string) => get<Page<Asset>>(`/projects/${projectId}/assets`, { params: { page, pageSize: 50, sort: 'createdAt:asc', ...(filter === 'keep' || filter === 'review' || filter === 'reject' ? { decision: filter } : filter === 'recommended' ? { recommendation: 'keep' } : {}) } }),
  groups: (projectId: string) => get<Page<PhotoGroup>>(`/projects/${projectId}/groups`, { params: { page: 1, pageSize: 100 } }),
  groupAssets: (groupId: string, page = 1) => get<Page<Asset>>(`/groups/${groupId}/assets`, { params: { page, pageSize: 100 } }),
  asset: (id: string) => get<Asset>(`/assets/${id}`),
  decision: (asset: Asset, decision: Decision) => patch<Asset>(`/assets/${asset.id}/decision`, { decision, expectedVersion: asset.version }),
  upload: async (projectId: string, files: File[], onProgress: (percent: number) => void, signal?: AbortSignal) => {
    const form = new FormData();
    files.forEach(file => form.append('files', file));
    try { return (await http.post<Envelope<UploadBatch>>(`/projects/${projectId}/assets`, form, { timeout: 180_000, signal, onUploadProgress: event => { if (event.total) onProgress(Math.round(event.loaded / event.total * 100)); } })).data.data; }
    catch (error) { return normalizeError(error); }
  },
  analyze: (id: string, key: string) => post<Job>(`/projects/${id}/analyze`, { force: false, rebuildGroups: true }, { headers: { 'Idempotency-Key': key } }),
  job: (id: string) => get<Job>(`/jobs/${id}`),
  cancelJob: (id: string) => post<Job>(`/jobs/${id}/cancel`),
  retryJob: (id: string) => post<Job>(`/jobs/${id}/retry`),
  summary: (id: string) => get<Summary>(`/projects/${id}/summary`),
  createExport: (id: string, selection: 'keep' | 'keepAndReview') => post<ExportTask>(`/projects/${id}/export`, { selection, copyImages: true, stripGps: true, includeManifest: true, manifestFormat: 'csv' }),
  exportTask: (id: string) => get<ExportTask>(`/exports/${id}`),
  image: async (url: string) => { try { return (await http.get<Blob>(url.replace(/^\/api\/v1/, ''), { responseType: 'blob' })).data; } catch (error) { return normalizeError(error); } },
  download: async (url: string) => { try { return (await http.get<Blob>(url.replace(/^\/api\/v1/, ''), { responseType: 'blob', timeout: 180_000 })).data; } catch (error) { return normalizeError(error); } },
};

export const api: typeof realApi = new Proxy(realApi, {
  get(target, property, receiver) {
    const realMethod = Reflect.get(target, property, receiver);
    if (typeof realMethod !== 'function') return realMethod;
    return (...args: unknown[]) => {
      if (import.meta.env.DEV && isDemoSession()) {
        return import('../dev/demoApi').then(({ demoApi }) => {
          const demoMethod = Reflect.get(demoApi, property) as (...values: unknown[]) => unknown;
          return demoMethod(...args);
        });
      }
      return realMethod(...args);
    };
  },
});
