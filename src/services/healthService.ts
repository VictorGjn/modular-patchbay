import { useHealthStore, type HealthProbeResult, type HealthStatus } from '../store/healthStore';
import { API_BASE } from '../config';

/* ── MCP Health Probe ── */

export async function probeMcpServer(serverId: string): Promise<HealthProbeResult> {
  const store = useHealthStore.getState();
  store.setMcpChecking(serverId);

  const start = performance.now();

  try {
    // Active probe: connects if needed, lists tools, measures latency
    const healthRes = await fetch(`${API_BASE}/health/mcp/${serverId}`, { signal: AbortSignal.timeout(15_000) });
    const latencyMs = Math.round(performance.now() - start);

    if (!healthRes.ok) {
      const result: HealthProbeResult = {
        status: 'error',
        latencyMs,
        toolCount: null,
        errorMessage: `HTTP ${healthRes.status}: ${healthRes.statusText}`,
        checkedAt: Date.now(),
      };
      store.setMcpHealth(serverId, result);
      return result;
    }

    const health = await healthRes.json();

    // Step 2: Determine status from response
    let status: HealthStatus = 'healthy';
    let errorMessage: string | null = null;
    const toolCount = health.tools?.length ?? health.toolCount ?? null;
    const tools = health.tools?.map((t: string | { name: string }) => typeof t === 'string' ? t : t.name) ?? undefined;

    if (health.status === 'error' || health.error) {
      status = 'error';
      errorMessage = health.error || health.message || 'Server reported error';
    } else if (health.status === 'disconnected' || health.status === 'not_configured') {
      status = 'error';
      errorMessage = health.status === 'not_configured' ? 'Not configured — add env vars in Settings' : 'Disconnected';
    } else if (latencyMs > 2000) {
      status = 'degraded';
      errorMessage = `Slow response: ${latencyMs}ms`;
    }

    const result: HealthProbeResult = { status, latencyMs, toolCount, errorMessage, checkedAt: Date.now(), tools };
    store.setMcpHealth(serverId, result);
    return result;
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    const errorMessage = err instanceof Error
      ? (err.name === 'TimeoutError' ? 'Timeout (10s)' : err.message)
      : 'Unknown error';

    const result: HealthProbeResult = { status: 'error', latencyMs, toolCount: null, errorMessage, checkedAt: Date.now() };
    store.setMcpHealth(serverId, result);
    return result;
  }
}

/* ── Skill Health Probe ── */

export async function probeSkill(skillId: string): Promise<HealthProbeResult> {
  const store = useHealthStore.getState();
  store.setSkillChecking(skillId);

  const start = performance.now();

  try {
    const res = await fetch(`${API_BASE}/health/skills/${encodeURIComponent(skillId)}`, { signal: AbortSignal.timeout(10_000) });
    const latencyMs = Math.round(performance.now() - start);

    if (!res.ok) {
      const result: HealthProbeResult = {
        status: res.status === 404 ? 'error' : 'unknown',
        latencyMs,
        toolCount: null,
        errorMessage: res.status === 404 ? 'Skill not found' : `HTTP ${res.status}`,
        checkedAt: Date.now(),
      };
      store.setSkillHealth(skillId, result);
      return result;
    }

    const json = await res.json() as { data?: { status: string; securityIssues: string[]; version: string | null; dependencies: number } };
    const audit = json.data;

    let status: HealthStatus = 'healthy';
    let errorMessage: string | null = null;
    if (audit?.status === 'error') {
      status = 'error';
      errorMessage = `Security: ${audit.securityIssues.slice(0, 2).join('; ')}`;
    } else if (audit?.status === 'warning') {
      status = 'degraded';
      errorMessage = `Warning: ${audit.securityIssues[0]}`;
    }

    const result: HealthProbeResult = {
      status,
      latencyMs,
      toolCount: audit?.dependencies ?? null,
      errorMessage,
      checkedAt: Date.now(),
    };
    store.setSkillHealth(skillId, result);
    return result;
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    const result: HealthProbeResult = {
      status: 'unknown',
      latencyMs,
      toolCount: null,
      errorMessage: err instanceof Error ? err.message : 'Audit failed',
      checkedAt: Date.now(),
    };
    store.setSkillHealth(skillId, result);
    return result;
  }
}

/* ── Batch Probes ── */

export async function probeAllMcp(serverIds: string[]): Promise<void> {
  // Use batch endpoint for efficiency
  try {
    const res = await fetch(`${API_BASE}/health/mcp/probe-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: serverIds }),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.ok) {
      const json = await res.json() as { data?: Array<{ id: string; status: string; latencyMs: number; toolCount: number; tools: string[]; errorMessage: string | null; checkedAt: number }> };
      const store = useHealthStore.getState();
      for (const probe of json.data || []) {
        store.setMcpHealth(probe.id, {
          status: probe.status as HealthStatus,
          latencyMs: probe.latencyMs,
          toolCount: probe.toolCount,
          tools: probe.tools,
          errorMessage: probe.errorMessage,
          checkedAt: probe.checkedAt,
        });
      }
      return;
    }
  } catch { /* fall back to individual probes */ }

  // Fallback: individual probes
  await Promise.allSettled(serverIds.map(id => probeMcpServer(id)));
}

export async function probeAllSkills(skillIds: string[]): Promise<void> {
  await Promise.allSettled(skillIds.map(id => probeSkill(id)));
}
