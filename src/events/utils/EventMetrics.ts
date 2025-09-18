export interface EventMetric {
  count: number;
  errors: number;
  durations: number[];
}

export interface EventHealthReport {
  totalEvents: number;
  totalErrors: number;
  averageProcessingTime: number;
  errorRate: number; // errors / events
  perEvent: Record<string, {
    count: number;
    errors: number;
    avgDuration: number;
  }>;
}

class EventMetrics {
  private metrics = new Map<string, EventMetric>();
  private totalCount = 0;
  private totalErrors = 0;

  public recordEventEmission(eventName: string, durationMs?: number): void {
    const metric = this.metrics.get(eventName) || { count: 0, errors: 0, durations: [] };
    metric.count += 1;
    if (typeof durationMs === 'number') metric.durations.push(durationMs);
    this.metrics.set(eventName, metric);
    this.totalCount += 1;
  }

  public recordError(eventName: string): void {
    const metric = this.metrics.get(eventName) || { count: 0, errors: 0, durations: [] };
    metric.errors += 1;
    this.metrics.set(eventName, metric);
    this.totalErrors += 1;
  }

  public getHealthReport(): EventHealthReport {
    const perEvent: EventHealthReport['perEvent'] = {};
    for (const [name, m] of this.metrics.entries()) {
      const avg = m.durations.length
        ? m.durations.reduce((a, b) => a + b, 0) / m.durations.length
        : 0;
      perEvent[name] = {
        count: m.count,
        errors: m.errors,
        avgDuration: Number(avg.toFixed(2)),
      };
    }
    const allDurations = Array.from(this.metrics.values()).flatMap(m => m.durations);
    const avgAll = allDurations.length
      ? allDurations.reduce((a, b) => a + b, 0) / allDurations.length
      : 0;

    return {
      totalEvents: this.totalCount,
      totalErrors: this.totalErrors,
      averageProcessingTime: Number(avgAll.toFixed(2)),
      errorRate: this.totalCount ? Number((this.totalErrors / this.totalCount).toFixed(4)) : 0,
      perEvent,
    };
  }
}

const Metrics = new EventMetrics();
export default Metrics;
