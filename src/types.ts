export interface DbStatus {
  connected: boolean;
  database?: string;
  user?: string;
  version?: string;
  latencyMs?: number;
  tables?: string[];
  host?: string;
  error?: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: string;
}

export type SchemaInfo = Record<string, ColumnInfo[]>;

export interface Project {
  id: number;
  userId?: number;
  name: string;
  description?: string;
  targetApp?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppItem {
  id: number;
  projectId?: number;
  title: string;
  category: string;
  dataPayload?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SqlQueryResult {
  success: boolean;
  command?: string;
  rowCount?: number;
  fields?: string[];
  rows?: Record<string, any>[];
  executionTimeMs?: number;
  error?: string;
}

export interface DbLog {
  id: number;
  action: string;
  details?: string;
  executedBy?: string;
  status?: string;
  createdAt: string;
}
