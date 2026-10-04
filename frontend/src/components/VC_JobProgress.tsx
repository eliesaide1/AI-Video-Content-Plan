import { useEffect, useState } from 'react';
import sharedService, {
  RealtimeEvent,
  type GenerationJob,
  type JobLogPayload,
  type JobUpdatePayload,
} from '../shared/sharedService';
import { VC_Badge } from './VC_Badge';

interface Props {
  jobId: string;
  title?: string;
  onCompleted?: (job: JobUpdatePayload) => void;
}

/**
 * VC_JobProgress — live progress for one generation job.
 *
 * It takes one snapshot over HTTP, then listens on socket.io. All transport
 * details come from sharedService; this component only renders.
 */
export function VC_JobProgress({ jobId, title, onCompleted }: Props) {
  const [status, setStatus] = useState<string>('queued');
  const [stage, setStage] = useState<string>('queued');
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const applySnapshot = (job: GenerationJob) => {
      if (cancelled) return;
      setStatus(job.status);
      setStage(job.stage);
      setProgress(job.progress);
      setError(job.error);
      setLogs(job.logs.map((entry) => entry.message));
    };

    sharedService.getJob(jobId).then(applySnapshot).catch(() => undefined);

    const unwatch = sharedService.realtime.watchJob(jobId);

    const offUpdate = sharedService.realtime.on<JobUpdatePayload>(
      RealtimeEvent.JobUpdated,
      (payload) => {
        if (payload.jobId !== jobId) return;
        setStatus(payload.status);
        setStage(payload.stage);
        setProgress(payload.progress);
        setError(payload.error ?? null);
        if (payload.status === 'completed' || payload.status === 'failed') {
          onCompleted?.(payload);
        }
      },
    );

    const offLog = sharedService.realtime.on<JobLogPayload>(RealtimeEvent.JobLog, (payload) => {
      if (payload.jobId !== jobId) return;
      setLogs((current) => [...current, payload.message].slice(-40));
    });

    return () => {
      cancelled = true;
      unwatch();
      offUpdate();
      offLog();
    };
    // onCompleted is intentionally excluded: callers pass inline closures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  return (
    <div className="vc-job">
      <div className="vc-job__head">
        <strong>{title ?? 'Generation job'}</strong>
        <VC_Badge value={status} />
        <span className="vc-job__stage">{stage.replace(/-/g, ' ')}</span>
        <span className="vc-job__percent">{progress}%</span>
      </div>

      <div className="vc-job__bar" role="progressbar" aria-valuenow={progress}>
        <div
          className={`vc-job__bar-fill ${status === 'failed' ? 'vc-job__bar-fill--failed' : ''}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {error ? <p className="vc-job__error">{error}</p> : null}

      {logs.length ? (
        <ol className="vc-job__logs">
          {logs.map((message, index) => (
            <li key={`${jobId}-log-${index}`}>{message}</li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

export default VC_JobProgress;
