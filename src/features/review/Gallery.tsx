import { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Columns2, Expand, Grid2X2, ImagePlus, ScanEye, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAppearance } from '../../appearance/AppearanceProvider';
import { api } from '../../shared/api';
import { errorText } from '../../shared/errors';
import type { Asset, Decision, PhotoGroup } from '../../shared/types';
import { useImage, warmThumbnails } from '../../shared/useImage';
import { transitionView } from '../../shared/viewTransition';
import sheet from './Gallery.module.css';

type Filter = 'all' | 'recommended' | 'keep' | 'review' | 'reject';
const filters: Array<[Filter, string]> = [['all', '全部'], ['recommended', 'AI 推荐'], ['keep', '已保留'], ['review', '待确认'], ['reject', '已舍弃']];
const decisionNames: Record<Decision, string> = { keep: '已保留', review: '待确认', reject: '已舍弃' };
function score(asset: Asset) {
  const value = asset.quality?.score;
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) : null;
}
function AssetImage({ asset, original = false }: { asset: Asset; original?: boolean }) {
  const url = useImage(original ? asset.originalUrl : asset.thumbnailUrl);
  return url ? <img src={url} alt={asset.originalName} loading="lazy" /> : <span className="image-placeholder"><ImagePlus size={30} /><small>正在加载照片</small></span>;
}
function DecisionButtons({ asset, onDecision, pending }: { asset: Asset; onDecision: (asset: Asset, decision: Decision) => void; pending: boolean }) {
  return <div className="decision-buttons" role="group" aria-label={`${asset.originalName} 人工筛选`}>
    <button className={asset.decision === 'keep' ? 'chosen keep' : ''} disabled={pending} onClick={() => onDecision(asset, 'keep')} title="人工保留"><Check size={15} /> 保留</button>
    <button className={asset.decision === 'review' ? 'chosen review' : ''} disabled={pending} onClick={() => onDecision(asset, 'review')} title="恢复待确认"><ScanEye size={15} /> 待确认</button>
    <button className={asset.decision === 'reject' ? 'chosen reject' : ''} disabled={pending} onClick={() => onDecision(asset, 'reject')} title="人工舍弃"><X size={15} /> 舍弃</button>
  </div>;
}
function PhotoCard({ asset, selected, onSelect, onDecision, pending }: { asset: Asset; selected: boolean; onSelect: () => void; onDecision: (asset: Asset, decision: Decision) => void; pending: boolean }) {
  const quality = score(asset);
  return <article className={`photo-card ${selected ? 'selected' : ''}`}><button className="photo-image" onClick={onSelect} aria-label={`查看 ${asset.originalName}`}><AssetImage asset={asset} /><span className="image-open"><Expand size={16} /></span></button><div className="photo-info"><div><strong title={asset.originalName}>{asset.originalName}</strong><span className={`decision-tag ${asset.decision}`}>{decisionNames[asset.decision]}</span></div><p>{asset.width} × {asset.height}{quality !== null ? ` · 质量分 ${quality}` : ''}</p><div className="photo-suggestion">{asset.recommendation === null ? '暂无 AI 建议' : asset.recommendation === 'keep' ? '✧ AI 推荐保留' : asset.recommendation === 'reject' ? '✧ AI 建议舍弃' : '✧ AI 建议复核'}</div><DecisionButtons asset={asset} pending={pending} onDecision={onDecision} /></div></article>;
}
function Stack({ assets, group, expanded, onToggle, selectedId, onSelect, onDecision, pendingId }: { assets: Asset[]; group?: PhotoGroup; expanded: boolean; onToggle: () => void; selectedId: string | null; onSelect: (asset: Asset) => void; onDecision: (asset: Asset, decision: Decision) => void; pendingId: string | null }) {
  const members = useQuery({ queryKey: ['group-assets', group?.id], queryFn: () => api.groupAssets(group!.id), enabled: expanded && !!group?.id });
  const source = members.data?.items || assets;
  const ordered = [...source].sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999) || Number(!!group?.recommendedAssetIds.includes(b.id)) - Number(!!group?.recommendedAssetIds.includes(a.id)) || (score(b) ?? -1) - (score(a) ?? -1) || Number(b.recommendation === 'keep') - Number(a.recommendation === 'keep'));
  const best = ordered[0];
  return <div className={`stack ${expanded ? 'expanded' : ''}`}><button className="stack-cover" onClick={onToggle} aria-expanded={expanded} aria-label={`${group?.assetCount || assets.length} 张相似照片，${expanded ? '收起' : '展开'}`}><span className="stack-sheet back-two" /><span className="stack-sheet back-one" /><span className="stack-front"><AssetImage asset={best} /></span><span className="stack-badge">{group?.assetCount || assets.length} 张相似照片</span><span className="stack-caption"><strong>{best.originalName}</strong><small>{best.rank != null ? `AI 排名第 ${best.rank} · ` : score(best) !== null ? `质量分 ${score(best)} · ` : ''}{group?.averageSimilarity != null ? `相似度 ${Math.round(group.averageSimilarity * 100)}% · ` : ''}点击{expanded ? '收起' : '展开'}</small></span><ChevronDown className="stack-chevron" size={17} /></button><div className="stack-reveal" inert={!expanded} aria-hidden={!expanded}><div className="stack-reveal-inner">{members.isError && <p className={sheet.stackNote}>组内接口暂不可用，以下展示当前页素材。</p>}{members.data && members.data.total > members.data.items.length && <p className={sheet.stackNote}>当前显示组内前 {members.data.items.length} 张，共 {members.data.total} 张。</p>}<div className="stack-members">{ordered.map(asset => <PhotoCard key={asset.id} asset={asset} selected={selectedId === asset.id} onSelect={() => onSelect(asset)} onDecision={onDecision} pending={pendingId === asset.id} />)}</div></div></div></div>;
}
export function Gallery({ projectId, groupCount, onUpload, onNotice }: { projectId: string; groupCount: number; onUpload: () => void; onNotice: (value: string) => void }) {
  const queryClient = useQueryClient(); const appearance = useAppearance(); const [search, setSearch] = useSearchParams();
  const filter = (filters.find(([key]) => key === search.get('filter'))?.[0] || 'all') as Filter;
  const page = Math.max(1, Number(search.get('page') || 1) || 1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [stacked, setStacked] = useState(true);
  const [viewer, setViewer] = useState<Asset | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingView, setPendingView] = useState<string | null>(null);
  const viewRequest = useRef(0);
  useEffect(() => () => { viewRequest.current++; }, []);
  const query = useQuery({ queryKey: ['assets', projectId, page, filter], queryFn: () => api.assets(projectId, page, filter) });
  const groupQuery = useQuery({ queryKey: ['groups', projectId], queryFn: () => api.groups(projectId), enabled: groupCount > 0 });
  const assets = useMemo(() => query.data?.items || [], [query.data]);
  const selected = assets.find(asset => asset.id === selectedId) || assets[0];
  const companion = assets.find(asset => asset.id === compareId && asset.id !== selected?.id) || assets.find(asset => asset.id !== selected?.id);
  const groups = useMemo(() => {
    const result = new Map<string, Asset[]>();
    for (const asset of assets) { const key = asset.groupId || `single:${asset.id}`; result.set(key, [...(result.get(key) || []), asset]); }
    return [...result.entries()];
  }, [assets]);
  const groupMetadata = useMemo(() => new Map((groupQuery.data?.items || []).map(group => [group.id, group])), [groupQuery.data]);
  const stackCount = groups.filter(([key, members]) => members.length > 1 || (groupMetadata.get(key)?.assetCount || 0) > 1).length;
  const categories = useMemo(() => {
    const result = new Map<string, Array<[string, Asset[]]>>();
    for (const entry of groups) {
      const category = groupMetadata.get(entry[0])?.groupType || (entry[0].startsWith('single:') ? '待分组' : '相似照片');
      result.set(category, [...(result.get(category) || []), entry]);
    }
    return [...result.entries()];
  }, [groups, groupMetadata]);
  const decision = useMutation({ mutationFn: ({ asset, value }: { asset: Asset; value: Decision }) => api.decision(asset, value), onSuccess: updated => { setViewer(current => current?.id === updated.id ? updated : current); void queryClient.invalidateQueries({ queryKey: ['assets', projectId] }); void queryClient.invalidateQueries({ queryKey: ['group-assets', updated.groupId] }); void queryClient.invalidateQueries({ queryKey: ['summary', projectId] }); }, onError: error => { onNotice(errorText(error)); void queryClient.invalidateQueries({ queryKey: ['assets', projectId] }); } });
  function updateDecision(asset: Asset, value: Decision) { setPendingId(asset.id); decision.mutate({ asset, value }, { onSettled: () => setPendingId(null) }); }
  async function changeFilter(value: Filter) {
    if (value === filter) { ++viewRequest.current; setPendingView(null); return; }
    const request = ++viewRequest.current;
    setPendingView(value);
    try {
      const nextPage = await queryClient.ensureQueryData({ queryKey: ['assets', projectId, 1, value], queryFn: () => api.assets(projectId, 1, value) });
      await warmThumbnails(nextPage.items.map(asset => asset.thumbnailUrl));
      if (request !== viewRequest.current) return;
      transitionView('gallery', () => {
        setSearch(current => { const next = new URLSearchParams(current); if (value === 'all') next.delete('filter'); else next.set('filter', value); next.delete('page'); return next; });
        setExpanded({});
        setPendingView(null);
      });
    } catch (error) { if (request === viewRequest.current) { setPendingView(null); onNotice(errorText(error)); } }
  }
  async function changePage(value: number) {
    const request = ++viewRequest.current;
    setPendingView(`page:${value}`);
    try {
      const nextPage = await queryClient.ensureQueryData({ queryKey: ['assets', projectId, value, filter], queryFn: () => api.assets(projectId, value, filter) });
      await warmThumbnails(nextPage.items.map(asset => asset.thumbnailUrl));
      if (request !== viewRequest.current) return;
      transitionView('gallery', () => {
        setSearch(current => { const next = new URLSearchParams(current); next.set('page', String(value)); return next; });
        setSelectedId(null); setCompareId(null); setExpanded({}); setPendingView(null);
      });
    } catch (error) { if (request === viewRequest.current) { setPendingView(null); onNotice(errorText(error)); } }
  }
  const card = (asset: Asset) => <PhotoCard key={asset.id} asset={asset} selected={selected?.id === asset.id} onSelect={() => { setSelectedId(asset.id); setViewer(asset); }} onDecision={updateDecision} pending={pendingId === asset.id} />;
  return <div className="gallery"><div className="gallery-toolbar"><div className="filters" role="group" aria-label="照片筛选">{filters.map(([key, label]) => <button key={key} aria-pressed={filter === key} data-pending={pendingView === key} onClick={() => void changeFilter(key)}>{label}</button>)}</div><div className="gallery-layouts" role="group" aria-label="照片布局"><button title="总览筛选" aria-label="总览筛选" aria-pressed={appearance.layout === 'overview'} onClick={() => appearance.setLayout('overview')}><Grid2X2 size={17} /></button><button title="单图专注" aria-label="单图专注" aria-pressed={appearance.layout === 'focus'} onClick={() => appearance.setLayout('focus')}><ScanEye size={17} /></button><button title="双图对比" aria-label="双图对比" aria-pressed={appearance.layout === 'compare'} onClick={() => appearance.setLayout('compare')}><Columns2 size={17} /></button></div></div>
    <div className="gallery-stage" aria-busy={!!pendingView}>{query.isPending ? <div className="gallery-empty">正在读取素材…</div> : query.isError ? <div className="gallery-empty"><p>{errorText(query.error)}</p><button className="button" onClick={() => query.refetch()}>重试</button></div> : !assets.length ? <div className="gallery-empty"><span><ImagePlus size={32} /></span><h3>{filter === 'all' ? '工作区还没有照片' : '当前筛选下没有照片'}</h3><p>{filter === 'all' ? '上传一批 JPEG、PNG 或 WebP 照片开始选片。' : '试试其他筛选条件。'}</p>{filter === 'all' && <button className="button primary" onClick={onUpload}><ImagePlus size={16} /> 选择素材</button>}</div> : <div className="gallery-content">
      {appearance.layout === 'overview' && <><div className="gallery-subhead"><div><strong>照片总览</strong><span>本页 {assets.length} 张 · {stackCount} 叠相似照片</span></div>{stackCount > 0 && <button className="button small" onClick={() => transitionView('gallery', () => setStacked(current => !current))}>{stacked ? '平铺照片' : '按相似度堆叠'}</button>}</div>{stacked ? categories.map(([category, entries]) => <section className={sheet.category} key={category}><h3 className={sheet.categoryTitle}>{category === 'portrait' ? '人像' : category === 'landscape' ? '风光' : category === 'event' ? '活动' : category}</h3><div className="photo-grid">{entries.map(([key, members]) => members.length > 1 || (groupMetadata.get(key)?.assetCount || 0) > 1 ? <Stack key={key} assets={members} group={groupMetadata.get(key)} expanded={!!expanded[key]} onToggle={() => setExpanded(current => ({ ...current, [key]: !current[key] }))} selectedId={selectedId} onSelect={asset => { setSelectedId(asset.id); setViewer(asset); }} onDecision={updateDecision} pendingId={pendingId} /> : card(members[0]))}</div></section>) : <div className="photo-grid">{assets.map(card)}</div>}</>}
      {appearance.layout === 'focus' && selected && <div className="focus-layout"><div className="focus-image" onClick={() => setViewer(selected)} role="button" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter') setViewer(selected); }}><AssetImage key={selected.id} asset={selected} /><span>点击查看原图</span></div><div className="focus-details"><span className="eyebrow">SINGLE REVIEW</span><h3>{selected.originalName}</h3><p>{selected.width} × {selected.height} · {selected.analysisStatus}</p><p>{score(selected) !== null ? `质量分 ${score(selected)}` : '暂无质量评分'}</p><p>{selected.recommendation ? `AI 建议：${decisionNames[selected.recommendation]}` : '暂无 AI 建议'}</p><DecisionButtons asset={selected} onDecision={updateDecision} pending={pendingId === selected.id} /></div><div className="filmstrip">{assets.map(asset => <button key={asset.id} aria-label={`查看 ${asset.originalName}`} aria-pressed={selected.id === asset.id} onClick={() => setSelectedId(asset.id)}><AssetImage asset={asset} /></button>)}</div></div>}
      {appearance.layout === 'compare' && selected && <div className="compare-layout"><div className="compare-pair">{[selected, companion].map((asset, index) => asset ? <div key={asset.id} className="compare-slot"><div className="compare-top"><span>{index ? 'B' : 'A'} · {asset.originalName}</span><button onClick={() => setViewer(asset)} aria-label="查看原图"><Expand size={16} /></button></div><div className="compare-image"><AssetImage asset={asset} /></div><DecisionButtons asset={asset} onDecision={updateDecision} pending={pendingId === asset.id} /></div> : <div key="empty" className="compare-slot empty">至少需要两张照片进行对比</div>)}</div><div className="filmstrip">{assets.map(asset => <button key={asset.id} aria-label={`选入对比 ${asset.originalName}`} title="点击设为 B 图" aria-pressed={asset.id === companion?.id} onClick={() => setCompareId(asset.id)}><AssetImage asset={asset} /></button>)}</div></div>}
    </div>}</div>
    {!!query.data?.total && <div className="gallery-footer"><span>第 {page} 页 · 共 {query.data.total} 张{filter !== 'all' ? '符合筛选' : ''}</span><div><button className="button small" disabled={page <= 1 || !!pendingView} onClick={() => void changePage(page - 1)}><ChevronLeft size={15} /> 上一页</button><button className="button small" disabled={page * query.data.pageSize >= query.data.total || !!pendingView} onClick={() => void changePage(page + 1)}>下一页 <ChevronRight size={15} /></button></div></div>}
    <Dialog.Root open={!!viewer} onOpenChange={open => { if (!open) setViewer(null); }}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="viewer-content"><Dialog.Title>{viewer?.originalName}</Dialog.Title><Dialog.Close asChild><button className="viewer-close" aria-label="关闭原图"><X size={20} /></button></Dialog.Close>{viewer && <><div className="viewer-image"><AssetImage asset={viewer} original /></div><div className="viewer-footer"><span>{viewer.width} × {viewer.height} · {viewer.decision === 'review' ? '待确认' : decisionNames[viewer.decision]}</span><DecisionButtons asset={viewer} onDecision={updateDecision} pending={pendingId === viewer.id} /></div></>}</Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
}
