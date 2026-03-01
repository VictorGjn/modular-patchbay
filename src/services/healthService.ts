import { useHealthStore, type HealthProbeResult, type HealthStatus } from '../store/healthStore';
import { API_BASE } from '../config';

/* ── MCP Health Probe ── */

export async function probeMcpServer(serverId: string): Promise<HealthProbeResult> {
  const store = useHealthStore.getState();
  store.setMcpChecking(serverId);

  const start = performance.now();

  try {
    // Step 1: Check if server exists and is connectable
    const healthRes = await fetch(`${API_BASE}/mcp/${serverId}/health`, { signal: AbortSignal.timeout(10_000) });
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
    const tools = health.tools?.map((t: any) => typeof t === 'string' ? t : t.name) ?? undefined;

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

  // Skills are local files — we check if the backend can resolve them
  const start = performance.now();

  try {
    const res = await fetch(`${API_BASE}/skills/health/${encodeURIComponent(skillId)}`, { signal: AbortSignal.timeout(5_000) });
    const latencyMs = Math.round(performance.now() - start);

    if (!res.ok) {
      // Backend might not have this route yet — degrade gracefully
      const result: HealthProbeResult = {
        status: res.status === 404 ? 'unknown' : 'error',
        latencyMs,
        toolCount: null,
        errorMessage: res.status === 404 ? 'Health check not available' : `HTTP ${res.status}`,
        checkedAt: Date.now(),
      };
      store.setSkillHealth(skillId, result);
      return result;
    }

    const data = await res.json();
    const result: HealthProbeResult = {
      status: data.exists ? 'healthy' : 'error',
      latencyMs,
      toolCount: null,
      errorMessage: data.exists ? null : 'Skill file not found',
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
      errorMessage: 'Backend unavailable',
      checkedAt: Date.now(),
    };
    store.setSkillHealth(skillId, result);
    return result;
  }
}

/* ── Batch Probes ── */

export async function probeAllMcp(serverIds: string[]): Promise<void> {
  await Promise.allSettled(serverIds.map(id => probeMcpServer(id)));
}

export async function probeAllSkills(skillIds: string[]): Promise<void> {
  await Promise.allSettled(skillIds.map(id => probeSkill(id)));
}
