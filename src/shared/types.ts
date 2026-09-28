export type Decision = 'keep' | 'review' | 'reject';
export type Recommendation = Decision | null;
export interface Page<T> { items: T[]; page: number; pageSize: number; total: number }
export interface User { id: string; email: string; displayName: string | null; status: string; createdAt: string }
export interface AuthResult { user: User; tokenType: string; accessToken: string; expiresAt: string }
export interface ProjectSettings {
  keepPerGroup: number; strictness: string; contentMode: string;
  weights: Record<string, number>; constraints: Record<string, boolean>;
  privacy: { sendThumbnailsToProvider: boolean; stripGpsOnExport: boolean };
}
export interface Project {
  id: string; name: string; status: string; settings: ProjectSettings;
  assetCount: number; groupCount: number; createdAt: string; updatedAt: string;
}
export interface Asset {
  id: string; projectId: string; originalName: string; mimeType: string;
  sizeBytes: number; width: number; height: number; sha256: string;
  analysisStatus: string; decision: Decision; recommendation: Recommendation;
  groupId: string | null; thumbnailUrl: string; originalUrl: string;
  exif: Record<string, unknown>; quality: Record<string, unknown>;
  version: number; createdAt: string; updatedAt: string;
  rank?: number | null; recommendScore?: number | null; membershipReason?: string | null;
}
export interface PhotoGroup {
  id: string; projectId: string; groupNo: number; groupType: string;
  hasFace: boolean; assetCount: number; confidence: number | null;
  averageSimilarity: number | null; maxDistance: number | null;
  timeRange: { from: string | null; to: string | null };
  reasons: string[]; recommendedAssetIds: string[];
}
export interface UploadBatch {
  batchId: string;
  accepted: Array<Pick<Asset, 'id' | 'originalName'>>;
  duplicates: Array<{ originalName: string; existingAssetId: string }>;
  failed: Array<{ originalName: string; code: string; message: string }>;
}
export interface Job {
  id: string; type: string; status: string; progress: number; currentStage: string;
  processedCount: number; totalCount: number; errorCount: number;
  errorMessage: string | null; createdAt: string; finishedAt: string | null;
  errors: Array<{ assetId: string; code: string; message: string; stage: string }>;
}
export interface Summary {
  projectId: string; status: string; assetCount: number; analyzedCount: number;
  groupCount: number; activeJobId: string | null;
  decisionCounts: Record<Decision, number>;
  recommendationCounts: Record<Decision, number>;
  warnings: string[];
}
export interface ExportTask {
  id: string; projectId: string; status: string; selection: string;
  progress: number; processedCount: number; totalCount: number;
  errorMessage: string | null; downloadUrl: string | null;
}
