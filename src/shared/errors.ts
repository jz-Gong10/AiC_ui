import { ApiError } from './api';
const translations: Record<string, string> = {
  VERSION_CONFLICT: '这张照片已在其他窗口更新，列表正在刷新，请重试。',
  JOB_ALREADY_RUNNING: '当前工作区已有分析任务，请查看现有任务。',
  PROJECT_HAS_NO_ASSETS: '请先上传照片，再开始分析。',
  LLM_UNAVAILABLE: '智能解析服务暂时不可用。',
  UNAUTHORIZED: '登录已过期，请重新登录。',
};
export function errorText(error: unknown) {
  if (error instanceof ApiError) return `${translations[error.code] || error.message}${error.requestId ? `（请求 ID：${error.requestId}）` : ''}`;
  return error instanceof Error ? error.message : '操作失败，请稍后重试。';
}
