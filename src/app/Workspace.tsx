import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Check, ChevronRight, CircleHelp, Download, FolderOpen, ImagePlus, LoaderCircle, LogOut, Menu, Moon, Palette, Plus, Send, Settings2, Sparkles, Sun, Trash2, Upload, X } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { colors, styles, useAppearance } from '../appearance/AppearanceProvider';
import { api } from '../shared/api';
import { isDemoSession } from '../shared/demoMode';
import { errorText } from '../shared/errors';
import { clearImageCache, warmThumbnails } from '../shared/useImage';
import { platform } from '../platform/platform';
import type { ExportTask, ParsedInstruction, Project, ProjectSettings } from '../shared/types';
import { Gallery } from '../features/review/Gallery';
import { BrandLogo } from '../shared/BrandLogo';
import { transitionView } from '../shared/viewTransition';

const terminal = new Set(['succeeded', 'partialFailed', 'failed', 'cancelled']);
const MAX_FILE = 20 * 1024 * 1024;
const fileTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
function chunkFiles(files: File[]) {
  const batches: File[][] = []; let current: File[] = []; let bytes = 0;
  for (const file of files) {
    if (current.length === 10 || bytes + file.size > 100 * 1024 * 1024) { batches.push(current); current = []; bytes = 0; }
    current.push(file); bytes += file.size;
  }
  if (current.length) batches.push(current);
  return batches;
}
function AppearanceDialog() {
  const appearance = useAppearance();
  return <Dialog.Root><Dialog.Trigger asChild><button className="button ghost"><Palette size={17} /><span>外观</span></button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-content appearance-dialog"><div className="dialog-head"><div><Dialog.Title>个性化外观</Dialog.Title><Dialog.Description>主题色、组件风格与工作布局可以独立搭配。</Dialog.Description></div><Dialog.Close asChild><button className="icon-button" aria-label="关闭"><X size={19} /></button></Dialog.Close></div>
    <div className="appearance-section"><h3>显示模式</h3><div className="segmented"><button aria-pressed={appearance.mode === 'light'} onClick={() => appearance.setMode('light')}><Sun size={16} /> 浅色</button><button aria-pressed={appearance.mode === 'dark'} onClick={() => appearance.setMode('dark')}><Moon size={16} /> 深色</button></div></div>
    <div className="appearance-section"><h3>主题色 · {colors[appearance.color][0]}</h3><div className="color-grid">{colors.map(([name, hue], index) => <button key={name} title={name} aria-label={name} aria-pressed={appearance.color === index} style={{ '--swatch': `hsl(${hue} 55% 53%)` } as React.CSSProperties} onClick={() => appearance.setColor(index)} />)}</div></div>
    <div className="appearance-section"><h3>组件风格</h3><select value={appearance.style} onChange={event => appearance.setStyle(event.target.value)}>{styles.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
    <div className="appearance-section"><h3>照片布局</h3><div className="segmented"><button aria-pressed={appearance.layout === 'overview'} onClick={() => appearance.setLayout('overview')}>总览</button><button aria-pressed={appearance.layout === 'focus'} onClick={() => appearance.setLayout('focus')}>单图</button><button aria-pressed={appearance.layout === 'compare'} onClick={() => appearance.setLayout('compare')}>双图</button></div></div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
function ProfileDialog({ projectCount }: { projectCount: number }) {
  const auth = useAuth(); const navigate = useNavigate();
  return <Dialog.Root><Dialog.Trigger asChild><button className="profile-entry"><span className="avatar">{(auth.user?.displayName || auth.user?.email || 'U').slice(0, 1).toUpperCase()}</span><span><strong>{auth.user?.displayName || 'CullPilot 用户'}</strong><small>{auth.user?.email}</small></span><ChevronRight size={16} /></button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-content profile-dialog"><div className="dialog-head"><div><Dialog.Title>用户信息</Dialog.Title><Dialog.Description>你的 CullPilot 账户</Dialog.Description></div><Dialog.Close asChild><button className="icon-button" aria-label="关闭"><X size={19} /></button></Dialog.Close></div><div className="profile-large"><span className="avatar">{(auth.user?.displayName || auth.user?.email || 'U').slice(0, 1).toUpperCase()}</span><div><strong>{auth.user?.displayName || 'CullPilot 用户'}</strong><p>{auth.user?.email}</p></div></div><div className="profile-meta"><span>工作区数量</span><strong>{projectCount}</strong></div><button className="button ghost full" onClick={async () => { try { await auth.signOut(); } catch { /* local session cleared */ } clearImageCache(); navigate('/login', { replace: true }); }}><LogOut size={16} /> 退出登录</button></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
function ProjectSettings({ project, onSaved }: { project: Project; onSaved: () => void }) {
  const [count, setCount] = useState(project.settings?.keepPerGroup ?? 2);
  const [strictness, setStrictness] = useState(project.settings?.strictness ?? 'standard');
  const [mode, setMode] = useState(project.settings?.contentMode ?? 'auto');
  const [weights, setWeights] = useState(project.settings?.weights || {});
  const [constraints, setConstraints] = useState(project.settings?.constraints || {});
  const [privacy, setPrivacy] = useState(project.settings?.privacy || { sendThumbnailsToProvider: false, stripGpsOnExport: true });
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { setCount(project.settings.keepPerGroup); setStrictness(project.settings.strictness); setMode(project.settings.contentMode); setWeights(project.settings.weights); setConstraints(project.settings.constraints); setPrivacy(project.settings.privacy); }, [project]);
  async function save() {
    setBusy(true); setError('');
    try { await api.patchSettings(project.id, { keepPerGroup: count, strictness, contentMode: mode, weights, constraints, privacy }); onSaved(); }
    catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  const weightLabels: Record<string, string> = { sharpness: '清晰度', eyesOpen: '睁眼', expression: '表情', exposure: '曝光', composition: '构图', motion: '动态' };
  const constraintLabels: Record<string, string> = { avoidSevereBlur: '排除严重模糊', avoidSevereOverexposure: '排除严重过曝', allowMildMotionBlur: '允许轻微动态模糊', preferFrontFacing: '优先正面人物' };
  return <Dialog.Root><Dialog.Trigger asChild><button className="button ghost"><Settings2 size={16} /> 筛选设置</button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-content settings-dialog"><div className="dialog-head"><div><Dialog.Title>工作区筛选设置</Dialog.Title><Dialog.Description>保存后可重新分析以更新 AI 推荐。</Dialog.Description></div><Dialog.Close asChild><button className="icon-button" aria-label="关闭"><X size={19} /></button></Dialog.Close></div>
    <label className="field">每组保留数量<input type="number" min={1} max={10} value={count} onChange={event => setCount(Number(event.target.value))} /></label>
    <label className="field">筛选强度<select value={strictness} onChange={event => setStrictness(event.target.value)}><option value="loose">宽松</option><option value="standard">标准</option><option value="strict">严格</option></select></label>
    <label className="field">内容模式<select value={mode} onChange={event => setMode(event.target.value)}><option value="auto">自动</option><option value="portrait">人像</option><option value="landscape">风光</option><option value="mixed">混合</option></select></label>
    <fieldset className="settings-group"><legend>评分权重</legend><p className="muted">保存时服务端会自动归一化。</p>{Object.entries(weightLabels).map(([key, label]) => <label className="field" key={key}>{label}<input type="number" min={0} max={1} step={0.01} value={weights[key] ?? 0} onChange={event => setWeights(current => ({ ...current, [key]: Number(event.target.value) }))} /></label>)}</fieldset>
    <fieldset className="settings-group"><legend>筛选约束</legend>{Object.entries(constraintLabels).map(([key, label]) => <label className="check-field" key={key}><input type="checkbox" checked={!!constraints[key]} onChange={event => setConstraints(current => ({ ...current, [key]: event.target.checked }))} />{label}</label>)}</fieldset>
    <fieldset className="settings-group"><legend>隐私与导出</legend><label className="check-field"><input type="checkbox" checked={privacy.sendThumbnailsToProvider} onChange={event => setPrivacy(current => ({ ...current, sendThumbnailsToProvider: event.target.checked }))} />允许向 AI 服务提供缩略图</label><label className="check-field"><input type="checkbox" checked={privacy.stripGpsOnExport} onChange={event => setPrivacy(current => ({ ...current, stripGpsOnExport: event.target.checked }))} />导出时移除 GPS 信息</label></fieldset>
    {error && <p className="error-note" role="alert">{error}</p>}<button className="button primary full" disabled={busy || count < 1 || count > 10 || Object.values(weights).some(value => !Number.isFinite(value) || value < 0 || value > 1) || Object.values(weights).every(value => value === 0)} onClick={save}>{busy ? '保存中…' : '保存设置'}</button>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
function JobStatus({ jobId, projectId, onJobId }: { jobId: string; projectId: string; onJobId: (id: string | null) => void }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['job', jobId], queryFn: () => api.job(jobId), refetchInterval: data => data.state.data && terminal.has(data.state.data.status) ? false : document.hidden ? 10_000 : 2_000 });
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const status = query.data?.status;
  useEffect(() => { if (status && terminal.has(status)) { void queryClient.invalidateQueries({ queryKey: ['assets', projectId] }); void queryClient.invalidateQueries({ queryKey: ['summary', projectId] }); void queryClient.invalidateQueries({ queryKey: ['projects'] }); } }, [status, projectId, queryClient]);
  const job = query.data;
  async function action(kind: 'cancel' | 'retry') { setBusy(true); setError(''); try { const updated = kind === 'cancel' ? await api.cancelJob(jobId) : await api.retryJob(jobId); if (kind === 'retry') onJobId(updated.id); else await query.refetch(); } catch (reason) { setError(errorText(reason)); await query.refetch(); } finally { setBusy(false); } }
  return <section className="job-banner"><div className="job-top"><span className="job-icon"><LoaderCircle size={18} className={job && !terminal.has(job.status) ? 'spin' : ''} /></span><div><strong>照片分析 · {job ? ({ queued: '排队中', running: '进行中', succeeded: '已完成', partialFailed: '部分失败', failed: '失败', cancelled: '已取消' }[job.status] || job.status) : '加载中'}</strong><p>{job ? `已处理 ${job.processedCount} / ${job.totalCount} 张 · 当前阶段 ${job.currentStage || '等待中'}` : query.isError ? errorText(query.error) : '正在获取任务状态'}</p></div><button className="icon-button" aria-label="收起任务状态" onClick={() => onJobId(null)}><X size={16} /></button></div><div className="progress"><span style={{ width: `${job?.progress || 0}%` }} /></div>{job && <div className="job-bottom"><span>{job.progress}%{job.errorCount ? ` · ${job.errorCount} 张失败` : ''}</span><div>{(job.status === 'queued' || job.status === 'running') && <button className="button small" disabled={busy} onClick={() => action('cancel')}>取消任务</button>}{(job.status === 'failed' || job.status === 'partialFailed' || job.status === 'cancelled') && <button className="button small" disabled={busy} onClick={() => action('retry')}>重试失败项</button>}</div></div>}{job?.errorMessage && <p className="error-note">{job.errorMessage}</p>}{!!job?.errors?.length && <details className="job-errors"><summary>查看失败照片（{job.errors.length}）</summary>{job.errors.map((item, index) => <p key={`${item.assetId}-${index}`}>{item.assetId} · {item.stage} · {item.message || item.code}</p>)}</details>}{error && <p className="error-note">{error}</p>}</section>;
}
function ExportPanel({ project, open, onClose }: { project: Project; open: boolean; onClose: () => void }) {
  const [selection, setSelection] = useState<'keep' | 'keepAndReview'>('keep');
  const [copyImages, setCopyImages] = useState(true);
  const [stripGps, setStripGps] = useState(project.settings.privacy.stripGpsOnExport);
  const [includeManifest, setIncludeManifest] = useState(true);
  const [task, setTask] = useState<ExportTask | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (!task) setStripGps(project.settings.privacy.stripGpsOnExport); }, [project.settings.privacy.stripGpsOnExport, task]);
  const query = useQuery({ queryKey: ['export', task?.id], queryFn: () => api.exportTask(task!.id), enabled: !!task, refetchInterval: data => data.state.data && (data.state.data.status === 'succeeded' || data.state.data.status === 'failed') ? false : 2_000 });
  const current = query.data || task;
  async function create() { setBusy(true); setError(''); try { setTask(await api.createExport(project.id, selection, { copyImages, stripGps, includeManifest })); } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); } }
  async function download() { if (!current?.downloadUrl) return; setBusy(true); setError(''); try { const blob = await api.download(current.downloadUrl); platform.download(blob, `cullpilot-export-${current.id}.zip`); } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); } }
  return <Dialog.Root open={open} onOpenChange={value => { if (!value) onClose(); }}><Dialog.Portal><Dialog.Overlay className="drawer-backdrop" /><Dialog.Content className="drawer" aria-describedby={undefined}><div className="drawer-head"><div><span className="eyebrow">交付结果</span><Dialog.Title>导出精选照片</Dialog.Title></div><Dialog.Close asChild><button className="icon-button" aria-label="关闭导出面板"><X /></button></Dialog.Close></div><p className="muted">服务端将生成 ZIP 文件，可包含原图和 CSV 清单。导出任务完成后下载。</p><label className="field">导出范围<select value={selection} onChange={event => setSelection(event.target.value as typeof selection)} disabled={!!task}><option value="keep">仅保留</option><option value="keepAndReview">保留与待确认</option></select></label><label className="check-field"><input type="checkbox" checked={copyImages} disabled={!!task} onChange={event => setCopyImages(event.target.checked)} />包含原图</label><label className="check-field"><input type="checkbox" checked={includeManifest} disabled={!!task} onChange={event => setIncludeManifest(event.target.checked)} />包含 CSV 清单</label><label className="check-field"><input type="checkbox" checked={stripGps} disabled={!!task || !copyImages} onChange={event => setStripGps(event.target.checked)} />移除照片 GPS 与 EXIF 信息</label><div className="info-box"><CircleHelp size={17} /><span>AI 建议与人工决定分开保存，导出时以服务端最终判定为准。</span></div>{error && <p className="error-note" role="alert">{error}</p>}{current && <div className="export-state"><strong>{current.status === 'succeeded' ? '导出已完成' : current.status === 'failed' ? '导出失败' : '正在生成导出文件'}</strong><div className="progress"><span style={{ width: `${current.progress}%` }} /></div><p>{current.processedCount} / {current.totalCount} 张 · {current.progress}%</p>{current.errorMessage && <p className="error-note">{current.errorMessage}</p>}</div>}<div className="drawer-actions">{!task ? <button className="button primary full" disabled={busy || (!copyImages && !includeManifest)} onClick={create}>{busy ? '提交中…' : '创建导出任务'}</button> : current?.status === 'succeeded' ? <button className="button primary full" disabled={busy} onClick={download}><Download size={17} /> 下载 ZIP</button> : current?.status === 'failed' ? <button className="button primary full" onClick={() => setTask(null)}>重新创建</button> : null}</div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}

export function Workspace() {
  const demo = isDemoSession();
  const appearance = useAppearance(); const navigate = useNavigate(); const { projectId } = useParams(); const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false); const [newOpen, setNewOpen] = useState(false); const [newName, setNewName] = useState(''); const [newError, setNewError] = useState('');
  const [notice, setNotice] = useState(''); const [uploadProgress, setUploadProgress] = useState<number | null>(null); const [exportOpen, setExportOpen] = useState(false);
  const [chat, setChat] = useState<Record<string, Array<{ role: 'user' | 'ai'; text: string }>>>({}); const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [previews, setPreviews] = useState<Record<string, ParsedInstruction | null>>({});
  const [busyChat, setBusyChat] = useState(false); const [busyApply, setBusyApply] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null); const [busyAnalysis, setBusyAnalysis] = useState(false); const [uploading, setUploading] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null); const switchRequest = useRef(0);
  useEffect(() => () => { switchRequest.current++; }, []);
  const fileRef = useRef<HTMLInputElement>(null); const uploadTarget = useRef<string | null>(null); const abort = useRef<AbortController | null>(null);
  const list = useInfiniteQuery({ queryKey: ['projects'], initialPageParam: 1, queryFn: ({ pageParam }) => api.projects(pageParam), getNextPageParam: page => page.page * page.pageSize < page.total ? page.page + 1 : undefined });
  const projectQuery = useQuery({ queryKey: ['project', projectId], queryFn: () => api.project(projectId!), enabled: !!projectId });
  const summary = useQuery({ queryKey: ['summary', projectId], queryFn: () => api.summary(projectId!), enabled: !!projectId, refetchInterval: 15_000 });
  const projects = useMemo(() => list.data?.pages.flatMap(page => page.items) || [], [list.data]); const project = projectQuery.data;
  const totalProjects = list.data?.pages[0]?.total ?? projects.length;
  useEffect(() => { if (!projectId && projects.length) navigate(`/projects/${projects[0].id}/review`, { replace: true }); }, [projectId, projects, navigate]);
  useEffect(() => { setJobId(null); }, [projectId]);
  useEffect(() => { if (summary.data?.activeJobId) setJobId(summary.data.activeJobId); }, [summary.data?.activeJobId]);
  const create = useMutation({ mutationFn: (name: string) => api.createProject(name), onSuccess: result => { void queryClient.invalidateQueries({ queryKey: ['projects'] }); setNewOpen(false); setNewName(''); navigate(`/projects/${result.id}/review`); } });
  async function switchProject(id: string) {
    if (id === projectId) { ++switchRequest.current; setSwitchingTo(null); setSidebarOpen(false); return; }
    const request = ++switchRequest.current;
    setSwitchingTo(id);
    try {
      const [, nextSummary, nextAssets] = await Promise.all([
        queryClient.ensureQueryData({ queryKey: ['project', id], queryFn: () => api.project(id) }),
        queryClient.ensureQueryData({ queryKey: ['summary', id], queryFn: () => api.summary(id) }),
        queryClient.ensureQueryData({ queryKey: ['assets', id, 1, 'all'], queryFn: () => api.assets(id, 1, 'all') }),
      ]);
      if (nextSummary.groupCount > 0) void queryClient.prefetchQuery({ queryKey: ['groups', id], queryFn: () => api.groups(id) });
      await warmThumbnails(nextAssets.items.map(asset => asset.thumbnailUrl));
      if (request !== switchRequest.current) return;
      transitionView('workspace', () => {
        navigate(`/projects/${id}/review`);
        setSidebarOpen(false);
        setSwitchingTo(null);
      });
    } catch (error) { if (request === switchRequest.current) { setSwitchingTo(null); setNotice(errorText(error)); } }
  }
  function submitNew(event: FormEvent) { event.preventDefault(); if (!newName.trim()) { setNewError('请输入工作区名称。'); return; } setNewError(''); create.mutate(newName.trim(), { onError: reason => setNewError(errorText(reason)) }); }
  function openImport() { if (!projectId || uploading) return; uploadTarget.current = projectId; if (fileRef.current) { fileRef.current.value = ''; fileRef.current.click(); } }
  async function uploadFiles(input: FileList | File[], targetId: string) {
    if (uploading) return;
    const files = Array.from(input); const valid = files.filter(file => fileTypes.has(file.type) && file.size > 0 && file.size <= MAX_FILE);
    if (!valid.length) { setNotice('请选择非空的 JPEG、PNG 或 WebP 图片，单张不超过 20 MB。'); return; }
    if (valid.length < files.length) setNotice(`有 ${files.length - valid.length} 个文件不符合格式或大小要求，已跳过。`);
    setUploading(true); abort.current = new AbortController(); let accepted = 0, duplicates = 0, failed = 0;
    try {
      for (const batch of chunkFiles(valid)) {
        const result = await api.upload(targetId, batch, setUploadProgress, abort.current.signal);
        accepted += result.accepted.length; duplicates += result.duplicates.length; failed += result.failed.length;
        setUploadProgress(null);
      }
      setNotice(`上传完成：新增 ${accepted} 张，重复 ${duplicates} 张，失败 ${failed} 张。`);
    } catch (reason) { setNotice(`${errorText(reason)}。已接收的批次可能仍保留在服务端。`); }
    finally { setUploading(false); setUploadProgress(null); abort.current = null; void queryClient.invalidateQueries({ queryKey: ['assets', targetId] }); void queryClient.invalidateQueries({ queryKey: ['summary', targetId] }); void queryClient.invalidateQueries({ queryKey: ['project', targetId] }); void queryClient.invalidateQueries({ queryKey: ['projects'] }); }
  }
  async function startAnalysis() {
    if (!projectId) return; setBusyAnalysis(true); setNotice('');
    try { const job = await api.analyze(projectId, crypto.randomUUID()); setJobId(job.id); setNotice(demo ? '本地演示任务已完成；没有运行真实 AI 分析。' : '分析任务已启动。'); }
    catch (reason) { setNotice(errorText(reason)); void summary.refetch(); }
    finally { setBusyAnalysis(false); }
  }
  async function deleteCurrent() {
    if (!project || !window.confirm(demo ? `确定删除演示工作区“${project.name}”？` : `确定删除“${project.name}”？服务端会清理这个工作区的照片和导出文件。`)) return;
    try { await api.deleteProject(project.id); clearImageCache(); await queryClient.invalidateQueries({ queryKey: ['projects'] }); navigate('/projects'); setNotice('工作区已进入删除流程。'); }
    catch (reason) { setNotice(errorText(reason)); }
  }
  async function sendChat(event: FormEvent) {
    event.preventDefault(); if (!projectId || busyChat) return;
    const id = projectId; const text = (drafts[id] || '').trim(); if (!text) return;
    setBusyChat(true); setPreviews(current => ({ ...current, [id]: null }));
    setChat(current => ({ ...current, [id]: [...(current[id] || []), { role: 'user', text }] }));
    setDrafts(current => ({ ...current, [id]: '' }));
    try {
      const parsed = await api.parseInstruction(id, text);
      setPreviews(current => ({ ...current, [id]: parsed }));
      setChat(current => ({ ...current, [id]: [...(current[id] || []), { role: 'ai', text: parsed.explanation || '已生成筛选策略，请查看下方预览。' }] }));
    } catch (reason) {
      setChat(current => ({ ...current, [id]: [...(current[id] || []), { role: 'ai', text: `解析失败：${errorText(reason)}。仍可在筛选设置中手动调整。` }] }));
    } finally { setBusyChat(false); }
  }
  async function applyPreview(analyze: boolean) {
    if (!projectId || !previews[projectId] || busyApply) return;
    const id = projectId; const strategy = previews[id]!.strategy;
    const patch: Partial<ProjectSettings> = { keepPerGroup: strategy.keepPerGroup, strictness: strategy.strictness, contentMode: strategy.contentMode, weights: strategy.weights, constraints: strategy.constraints };
    setBusyApply(true);
    try {
      await api.patchSettings(id, patch);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['project', id] }), queryClient.invalidateQueries({ queryKey: ['projects'] })]);
      setPreviews(current => ({ ...current, [id]: null }));
      if (analyze) { const job = await api.analyze(id, crypto.randomUUID()); setJobId(job.id); setNotice('筛选策略已保存，分析任务已启动。'); }
      else setNotice('筛选策略已保存。需要更新推荐时，请点击“开始分析”。');
    } catch (reason) { setNotice(errorText(reason)); }
    finally { setBusyApply(false); }
  }
  const messages = projectId ? chat[projectId] || [] : [];
  const preview = projectId ? previews[projectId] : null;
  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}><div className="brand"><BrandLogo className="sidebar-logo" /><button className="icon-button mobile-only" onClick={() => setSidebarOpen(false)} aria-label="关闭工作区列表"><X size={18} /></button></div><button className="button new-workspace" onClick={() => setNewOpen(true)}><Plus size={17} /> 新建工作区</button><div className="side-caption">我的工作区 <span>{totalProjects}</span></div>
      <nav className="workspace-list" aria-label="工作区列表">{list.isPending && <p className="sidebar-hint">正在加载…</p>}{list.isError && <p className="sidebar-hint">{errorText(list.error)} <button onClick={() => list.refetch()}>重试</button></p>}{projects.map(item => <button className={`workspace-link ${item.id === projectId ? 'active' : ''}`} data-pending={switchingTo === item.id} aria-busy={switchingTo === item.id} key={item.id} onClick={() => void switchProject(item.id)}><span className="workspace-icon"><FolderOpen size={17} /></span><span><strong>{item.name}</strong><small>{item.assetCount} 张素材</small></span>{item.id === projectId && <span className="active-dot" />}</button>)}{list.hasNextPage && <button className="button small full" disabled={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>{list.isFetchingNextPage ? '加载中…' : '加载更多工作区'}</button>}</nav>
      <div className="sidebar-foot"><ProfileDialog projectCount={totalProjects} /><div className="sidebar-trust"><Check size={15} /> {demo ? '本地演示，不连接后端' : '照片由你的工作区管理'}</div></div>
    </aside>
    <button className="mobile-shade" data-open={sidebarOpen} inert={!sidebarOpen} aria-hidden={!sidebarOpen} onClick={() => setSidebarOpen(false)} aria-label="关闭工作区列表" />
    <main className="workspace-main"><header className="topbar"><div className="top-title"><button className="icon-button mobile-only" onClick={() => setSidebarOpen(true)} aria-label="打开工作区列表"><Menu size={20} /></button><div><span className="breadcrumb">工作区 / 智能选片</span><h1>{project?.name || (list.isPending ? '载入工作区…' : '选择一个工作区')}</h1></div></div><div className="top-actions"><span className="live-pill"><span /> {demo ? '本地演示' : '已连接工作台'}</span><button className="button ghost theme-button" aria-label={`切换${appearance.mode === 'light' ? '深色' : '浅色'}模式`} onClick={() => appearance.setMode(appearance.mode === 'light' ? 'dark' : 'light')}>{appearance.mode === 'light' ? <Moon size={17} /> : <Sun size={17} />}<span>{appearance.mode === 'light' ? '深色' : '浅色'}</span></button><AppearanceDialog /></div></header>
      {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="关闭提示" onClick={() => setNotice('')}><X size={16} /></button></div>}
      {!projectId ? <div className="welcome-empty"><span className="empty-symbol"><ImagePlus size={36} /></span><span className="eyebrow">开始你的第一次选片</span><h2>每一组照片，都有值得留下的瞬间。</h2><p>创建一个工作区，为本次拍摄集中管理素材、复核和导出。</p><button className="button primary" onClick={() => setNewOpen(true)}><Plus size={17} /> 新建工作区</button></div> : projectQuery.isError ? <div className="welcome-empty"><h2>无法打开工作区</h2><p>{errorText(projectQuery.error)}</p><button className="button" onClick={() => projectQuery.refetch()}>重试</button></div> : <div className="workbench"><section className="chat-panel"><div className="panel-heading"><span className="orb"><Sparkles size={22} /></span><div><h2>选片助手</h2><p>描述你想留下怎样的照片</p></div></div><div className="chat-log"><div className="chat-bubble assistant"><span className="tiny-label">CULLPILOT ASSISTANT</span><p>欢迎来到「{project?.name || '工作区'}」。告诉我筛选要求，确认解析出的策略后再应用到工作区。</p></div>{messages.map((message, index) => <div className={`chat-bubble ${message.role === 'user' ? 'user' : 'assistant'}`} key={index}>{message.role === 'ai' && <span className="tiny-label">CULLPILOT ASSISTANT</span>}<p>{message.text}</p></div>)}{busyChat && <p className="muted" role="status">正在解析筛选要求…</p>}{preview && <div className="strategy-preview"><strong>策略预览</strong><p>每组保留 {preview.strategy.keepPerGroup} 张 · {({ loose: '宽松', standard: '标准', strict: '严格' } as Record<string, string>)[preview.strategy.strictness] || preview.strategy.strictness} · {({ auto: '自动', portrait: '人像', landscape: '风光', mixed: '混合' } as Record<string, string>)[preview.strategy.contentMode] || preview.strategy.contentMode}</p>{Object.keys(preview.strategy.weights).length > 0 && <p>评分重点：{Object.entries(preview.strategy.weights).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([key]) => ({ sharpness: '清晰度', eyesOpen: '睁眼', expression: '表情', exposure: '曝光', composition: '构图', motion: '动态' } as Record<string, string>)[key] || key).join('、')}</p>}{preview.unsupportedTerms.length > 0 && <p className="error-note">暂不支持：{preview.unsupportedTerms.join('、')}</p>}{preview.fallbackUsed && <p className="muted">使用了默认策略，请检查后再应用。</p>}<div className="strategy-actions"><button className="button small" onClick={() => void applyPreview(false)} disabled={busyApply}>仅保存设置</button><button className="button primary small" onClick={() => void applyPreview(true)} disabled={busyApply || !project?.assetCount || !!summary.data?.activeJobId}>保存并分析</button></div></div>}</div><div className="chat-bottom"><div className="chat-hint"><CircleHelp size={15} /> 解析只生成预览；保存后重新分析才会更新推荐。</div><form className="composer" onSubmit={sendChat}><label htmlFor="chat-input">筛选要求</label><textarea id="chat-input" value={drafts[projectId] || ''} onChange={event => setDrafts(current => ({ ...current, [projectId]: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="例如：每组留下最清晰的一张…" maxLength={2000} /><div className="composer-row"><small>Enter 发送 · Shift+Enter 换行</small><button className="button primary send-button" type="submit" disabled={busyChat || !drafts[projectId]?.trim()} aria-label="解析筛选要求"><Send size={16} /></button></div></form></div></section>
        <section className="asset-panel"><div className="asset-panel-head"><div><span className="eyebrow">CURRENT WORKSPACE</span><h2>素材与筛选</h2><p>{project?.assetCount || 0} 张素材 · {demo ? '人工决定只在本页模拟' : '人工决定会保存到服务端'}</p></div><div className="head-actions"><button className="button ghost" onClick={openImport} disabled={uploading}><Upload size={16} /> {demo ? '添加演示素材' : '上传素材'}</button><button className="button primary" onClick={startAnalysis} disabled={busyAnalysis || !project?.assetCount || !!summary.data?.activeJobId}><Sparkles size={16} /> {demo ? '演示分析' : '开始分析'}</button></div></div>
          {summary.data && <div className="summary-strip"><span>已分析 {summary.data.analyzedCount} / {summary.data.assetCount}</span><span>分组 {summary.data.groupCount}</span><span>已保留 {summary.data.decisionCounts.keep}</span><span>待确认 {summary.data.decisionCounts.review}</span><span>已舍弃 {summary.data.decisionCounts.reject}</span>{summary.data.warnings.map((warning, index) => <span className="summary-warning" key={index}>{warning}</span>)}</div>}
          {uploading && <div className="upload-banner"><div><strong>正在上传到服务端</strong><span>{uploadProgress === 100 ? '服务器校验中…' : `${uploadProgress ?? 0}%`}</span></div><div className="progress"><span style={{ width: `${uploadProgress ?? 0}%` }} /></div><button className="button small" onClick={() => abort.current?.abort()}>停止后续上传</button></div>}
          {jobId && <JobStatus key={jobId} jobId={jobId} projectId={projectId} onJobId={setJobId} />}
          <div className="asset-utility"><div className="utility-copy"><strong><Sparkles size={17} /> AI 智能分组</strong><p>{summary.data?.groupCount ? `已有 ${summary.data.groupCount} 组照片，可展开逐张复核。` : '暂无分组结果。照片会先以素材网格展示。'}</p></div><div className="utility-actions">{project && <ProjectSettings project={project} onSaved={() => { void queryClient.invalidateQueries({ queryKey: ['project', projectId] }); setNotice('筛选设置已保存。点击“开始分析”以更新推荐。'); }} />}<button className="button ghost" onClick={() => setExportOpen(true)}><Download size={16} /> 导出</button><button className="icon-button danger" aria-label="删除工作区" title="删除工作区" onClick={deleteCurrent}><Trash2 size={16} /></button></div></div>
          <Gallery key={projectId} projectId={projectId} groupCount={summary.data?.groupCount || 0} onUpload={openImport} onNotice={setNotice} />
        </section></div>}
    </main>
    <input ref={fileRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => { if (event.target.files && uploadTarget.current) void uploadFiles(event.target.files, uploadTarget.current); }} />
    <Dialog.Root open={newOpen} onOpenChange={setNewOpen}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-content"><div className="dialog-head"><div><Dialog.Title>新建工作区</Dialog.Title><Dialog.Description>为一次拍摄创建独立的素材空间。</Dialog.Description></div><Dialog.Close asChild><button className="icon-button" aria-label="关闭"><X size={19} /></button></Dialog.Close></div><form onSubmit={submitNew}><label className="field">工作区名称<input autoFocus maxLength={100} value={newName} onChange={event => setNewName(event.target.value)} placeholder="例如：九月海边人像" /></label>{newError && <p className="error-note" role="alert">{newError}</p>}<button type="submit" className="button primary full" disabled={create.isPending}>创建工作区 <ArrowRight size={16} /></button></form></Dialog.Content></Dialog.Portal></Dialog.Root>
    {project && <ExportPanel key={project.id} project={project} open={exportOpen} onClose={() => setExportOpen(false)} />}
  </div>;
}
