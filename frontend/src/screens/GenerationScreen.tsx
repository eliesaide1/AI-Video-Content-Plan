import { useCallback, useEffect, useState } from 'react';
import sharedService, {
  RealtimeEvent,
  type GenerationJob,
  type JobUpdatePayload,
} from '../shared/sharedService';
import { VC_Badge } from '../components/VC_Badge';
import { VC_Button } from '../components/VC_Button';
import { VC_Card } from '../components/VC_Card';
import { VC_EmptyState } from '../components/VC_EmptyState';
import { VC_JobProgress } from '../components/VC_JobProgress';
import { VC_PageHeader } from '../components/VC_PageHeader';
import { VC_Spinner } from '../components/VC_Spinner';

/** Generation — every job, with live progress pushed over socket.io. */
export function GenerationScreen() {
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setJobs(await sharedService.listJobs({ limit: 30 }));
    } catch {
      // Alert already shown.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // The global job channel tells us when a job's state changes.
  useEffect(() => {
    return sharedService.realtime.on<JobUpdatePayload>(RealtimeEvent.JobUpdated, (payload) => {
      setJobs((current) => {
        const index = current.findIndex((job) => job._id === payload.jobId);
        if (index === -1) {
          void load();
          return current;
        }
        const next = [...current];
        next[index] = {
          ...next[index],
          status: payload.status,
          stage: payload.stage,
          progress: payload.progress,
          error: payload.error ?? null,
        };
        return next;
      });
    });
  }, [load]);

  if (loading) return <VC_Spinner label="Loading jobs..." />;

  const active = jobs.filter((job) => job.status === 'queued' || job.status === 'running');
  const finished = jobs.filter((job) => job.status === 'completed' || job.status === 'failed');

  return (
    <div className="vc-screen">
      <VC_PageHeader
        title="Generation"
        description="Long-running work runs in the background; progress streams over socket.io."
        actions={
          <VC_Button variant="secondary" onClick={() => void load()}>
            Refresh
          </VC_Button>
        }
      />

      <VC_Card title={`Active (${active.length})`}>
        {active.length ? (
          active.map((job) => (
            <VC_JobProgress key={job._id} jobId={job._id} title={`${job.type} · ${job.entityId}`} />
          ))
        ) : (
          <VC_EmptyState title="Nothing running" message="Start a job from Discover or Courses." />
        )}
      </VC_Card>

      <VC_Card title={`History (${finished.length})`}>
        {finished.length ? (
          <table className="vc-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Entity</th>
                <th>Status</th>
                <th>Stage</th>
                <th>Started</th>
                <th>Finished</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {finished.map((job) => (
                <tr key={job._id}>
                  <td>{job.type}</td>
                  <td className="vc-table__mono">{job.entityId}</td>
                  <td>
                    <VC_Badge value={job.status} />
                  </td>
                  <td>{job.stage.replace(/-/g, ' ')}</td>
                  <td>{job.startedAt ? new Date(job.startedAt).toLocaleTimeString() : '—'}</td>
                  <td>{job.completedAt ? new Date(job.completedAt).toLocaleTimeString() : '—'}</td>
                  <td className="vc-table__error">{job.error ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <VC_EmptyState title="No finished jobs yet" />
        )}
      </VC_Card>
    </div>
  );
}

export default GenerationScreen;
