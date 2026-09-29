import type { Asset, Decision, ExportTask, Job, Page, PhotoGroup, Project, ProjectSettings, Summary, UploadBatch } from '../shared/types';
import type { ApiSource } from '../shared/api';

// This module is loaded only by the Vite development build. All data lives in memory.
const now = () => new Date().toISOString();
const settings = (): ProjectSettings => ({
  keepPerGroup: 2, strictness: 'standard', contentMode: 'auto',
  weights: { sharpness: 0.3, eyesOpen: 0.25, expression: 0.15, exposure: 0.15, composition: 0.1, motion: 0.05 },
  constraints: { avoidSevereBlur: true, avoidSevereOverexposure: true, allowMildMotionBlur: true, preferFrontFacing: false },
  privacy: { sendThumbnailsToProvider: false, stripGpsOnExport: true },
});
const projects: Project[] = [
  { id: 'demo-coast', name: '海边日落 · 演示工作区', status: 'ready', settings: settings(), assetCount: 0, groupCount: 0, createdAt: now(), updatedAt: now() },
  { id: 'demo-portrait', name: '周末人像 · 演示工作区', status: 'ready', settings: settings(), assetCount: 0, groupCount: 0, createdAt: now(), updatedAt: now() },
];
const assets: Asset[] = [];
const uploadedImages = new Map<string, Blob>();
const jobs = new Map<string, Job>();

function page<T>(items: T[], number = 1, size = 50): Page<T> {
  return { items: items.slice((number - 1) * size, number * size), page: number, pageSize: size, total: items.length };
}
function requiredProject(id: string) {
  const project = projects.find(item => item.id === id);
  if (!project) throw new Error('演示工作区不存在。');
  return project;
}
function requiredAsset(id: string) {
  const asset = assets.find(item => item.id === id);
  if (!asset) throw new Error('演示照片不存在。');
  return asset;
}
function projectAssets(id: string) { return assets.filter(item => item.projectId === id); }
function projectGroups(id: string): PhotoGroup[] {
  const ids = [...new Set(projectAssets(id).map(item => item.groupId).filter((value): value is string => !!value))];
  return ids.map((groupId, index) => {
    const members = assets.filter(item => item.groupId === groupId);
    return {
      id: groupId, projectId: id, groupNo: index + 1,
      groupType: groupId.includes('portrait') ? 'portrait' : 'landscape',
      hasFace: groupId.includes('portrait'), assetCount: members.length,
      confidence: 0.91, averageSimilarity: 0.88, maxDistance: null,
      timeRange: { from: null, to: null }, reasons: ['本地演示分组'],
      recommendedAssetIds: members.filter(item => item.recommendation === 'keep').map(item => item.id),
    };
  });
}
function currentProject(id: string): Project {
  const project = requiredProject(id);
  return { ...project, assetCount: projectAssets(id).length, groupCount: projectGroups(id).length };
}
function seed(projectId: string, kind: 'coast' | 'portrait', count: number) {
  for (let index = 0; index < count; index++) {
    const id = `demo-${kind}-${index + 1}`;
    assets.push({
      id, projectId, originalName: `${kind === 'coast' ? '海边日落' : '周末人像'}_${String(index + 1).padStart(2, '0')}.jpg`,
      mimeType: 'image/jpeg', sizeBytes: 2_400_000, width: 2400, height: 1600,
      sha256: id, analysisStatus: 'succeeded', decision: 'review',
      recommendation: index === 0 ? 'keep' : index === 2 ? 'reject' : 'review',
      groupId: `demo-group-${kind}`, thumbnailUrl: `/api/v1/assets/${id}/thumbnail`,
      originalUrl: `/api/v1/assets/${id}/original`, exif: {}, quality: { score: 0.93 - index * 0.09 },
      version: 1, createdAt: now(), updatedAt: now(), rank: index + 1, recommendScore: 0.93 - index * 0.09,
    });
  }
}
seed('demo-coast', 'coast', 4);
seed('demo-portrait', 'portrait', 3);

function illustration(asset: Asset): Blob {
  const variant = Number(asset.id.match(/(\d+)$/)?.[1] || 1);
  const portrait = asset.id.includes('portrait');
  const hue = portrait ? 8 + variant * 8 : 185 + variant * 7;
  const subject = portrait
    ? `<circle cx="600" cy="290" r="95" fill="#3b3943"/><path d="M350 800 Q380 410 600 410 Q820 410 850 800" fill="#3b3943"/>`
    : `<path d="M0 560 Q250 380 470 540 Q680 350 1200 560 L1200 800 L0 800Z" fill="#294857" opacity=".85"/><path d="M0 620 Q370 530 730 630 Q990 560 1200 610 L1200 800 L0 800Z" fill="#406f78"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="hsl(${hue} 48% 70%)"/><stop offset="1" stop-color="hsl(${hue + 35} 53% 84%)"/></linearGradient></defs><rect width="1200" height="800" fill="url(#sky)"/><circle cx="${portrait ? 250 : 900}" cy="185" r="95" fill="#fff1cc" opacity=".86"/>${subject}<text x="44" y="745" font-family="sans-serif" font-size="30" fill="white">LOCAL DEMO ${variant}</text></svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

export const demoApi = {
  login: async () => { throw new Error('本地演示无需登录。'); },
  register: async () => { throw new Error('本地演示无需注册。'); },
  me: async () => ({ id: 'local-demo-user', email: 'demo@localhost', displayName: '本地演示用户', status: 'active', createdAt: now() }),
  logout: async () => ({ success: true }),
  projects: async (number = 1) => page(projects.map(item => currentProject(item.id)), number),
  project: async (id: string) => currentProject(id),
  createProject: async (name: string) => {
    const project: Project = { id: `local-${crypto.randomUUID()}`, name, status: 'ready', settings: settings(), assetCount: 0, groupCount: 0, createdAt: now(), updatedAt: now() };
    projects.unshift(project); return project;
  },
  patchSettings: async (id: string, changes: Partial<ProjectSettings>) => {
    const project = requiredProject(id);
    project.settings = { ...project.settings, ...changes };
    project.updatedAt = now(); return currentProject(id);
  },
  parseInstruction: async (id: string, text: string) => {
    const current = requiredProject(id).settings;
    return { text, strategy: { keepPerGroup: current.keepPerGroup, strictness: current.strictness, contentMode: current.contentMode, weights: current.weights, constraints: current.constraints }, confidence: 0, unsupportedTerms: [], explanation: '本地演示不会解析自然语言，请在筛选设置中调整参数。', fallbackUsed: true, provider: null, model: null };
  },
  deleteProject: async (id: string) => {
    const index = projects.findIndex(item => item.id === id);
    if (index < 0) throw new Error('演示工作区不存在。');
    projects.splice(index, 1);
    for (let i = assets.length - 1; i >= 0; i--) if (assets[i].projectId === id) assets.splice(i, 1);
    return { success: true };
  },
  assets: async (id: string, number: number, filter?: string) => {
    requiredProject(id);
    const source = projectAssets(id).filter(item => filter === 'recommended' ? item.recommendation === 'keep' : filter === 'keep' || filter === 'review' || filter === 'reject' ? item.decision === filter : true);
    return page(source, number);
  },
  groups: async (id: string, number = 1) => page(projectGroups(id), number, 100),
  groupAssets: async (id: string, number = 1) => page(assets.filter(item => item.groupId === id), number, 100),
  asset: async (id: string) => requiredAsset(id),
  decision: async (asset: Asset, decision: Decision) => {
    const current = requiredAsset(asset.id);
    current.decision = decision; current.version++; current.updatedAt = now();
    return { ...current };
  },
  upload: async (id: string, files: File[], onProgress: (value: number) => void, signal?: AbortSignal): Promise<UploadBatch> => {
    requiredProject(id);
    if (signal?.aborted) throw new Error('演示上传已取消。');
    const accepted = files.map(file => {
      const assetId = `local-${crypto.randomUUID()}`;
      uploadedImages.set(assetId, file);
      assets.push({
        id: assetId, projectId: id, originalName: file.name, mimeType: file.type, sizeBytes: file.size,
        width: 0, height: 0, sha256: assetId, analysisStatus: 'pending', decision: 'review', recommendation: null,
        groupId: null, thumbnailUrl: `/api/v1/assets/${assetId}/thumbnail`, originalUrl: `/api/v1/assets/${assetId}/original`,
        exif: {}, quality: {}, version: 1, createdAt: now(), updatedAt: now(),
      });
      return { id: assetId, originalName: file.name };
    });
    onProgress(100);
    return { batchId: `local-${crypto.randomUUID()}`, accepted, duplicates: [], failed: [] };
  },
  analyze: async (id: string): Promise<Job> => {
    requiredProject(id);
    const items = projectAssets(id);
    const job: Job = { id: `local-${crypto.randomUUID()}`, type: 'analysis', status: 'succeeded', progress: 100, currentStage: '本地演示', processedCount: items.length, totalCount: items.length, errorCount: 0, errorMessage: null, createdAt: now(), finishedAt: now(), errors: [] };
    jobs.set(job.id, job);
    return job;
  },
  job: async (id: string) => { const job = jobs.get(id); if (!job) throw new Error('演示任务不存在。'); return job; },
  cancelJob: async () => { throw new Error('演示任务已即时完成。'); },
  retryJob: async () => { throw new Error('演示任务已即时完成。'); },
  summary: async (id: string): Promise<Summary> => {
    requiredProject(id);
    const items = projectAssets(id);
    const count = (key: 'decision' | 'recommendation', value: Decision) => items.filter(item => item[key] === value).length;
    return { projectId: id, status: 'ready', assetCount: items.length, analyzedCount: items.filter(item => item.analysisStatus === 'succeeded').length, groupCount: projectGroups(id).length, activeJobId: null,
      decisionCounts: { keep: count('decision', 'keep'), review: count('decision', 'review'), reject: count('decision', 'reject') },
      recommendationCounts: { keep: count('recommendation', 'keep'), review: count('recommendation', 'review'), reject: count('recommendation', 'reject') },
      warnings: ['当前为本地演示数据，没有运行 AI 分析。'] };
  },
  createExport: async (): Promise<ExportTask> => { throw new Error('本地演示不生成真实导出文件。'); },
  exportTask: async (): Promise<ExportTask> => { throw new Error('本地演示没有导出任务。'); },
  image: async (url: string) => {
    const id = url.match(/\/assets\/([^/]+)\/(?:thumbnail|original)$/)?.[1];
    if (!id) throw new Error('演示图片地址无效。');
    return uploadedImages.get(id) || illustration(requiredAsset(id));
  },
  download: async (): Promise<Blob> => { throw new Error('本地演示没有导出文件。'); },
} satisfies ApiSource;
