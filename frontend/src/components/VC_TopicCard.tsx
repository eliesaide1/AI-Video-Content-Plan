import type { Topic } from '../shared/sharedService';
import { VC_Badge } from './VC_Badge';
import { VC_Button } from './VC_Button';

interface Props {
  topic: Topic;
  busy?: boolean;
  onApprove: (topic: Topic) => void;
  onReject: (topic: Topic) => void;
  onResearch: (topic: Topic) => void;
  onGenerate: (topic: Topic) => void;
  onOpenResearch: (topic: Topic) => void;
}

/** One candidate topic with its score, reasons, sources and approval actions. */
export function VC_TopicCard({
  topic,
  busy = false,
  onApprove,
  onReject,
  onResearch,
  onGenerate,
  onOpenResearch,
}: Props) {
  const researched = topic.status === 'researched' || topic.status === 'course-generated';

  return (
    <article className="vc-topic">
      <header className="vc-topic__head">
        <div>
          <h3 className="vc-topic__title">{topic.title}</h3>
          <p className="vc-topic__meta">
            {topic.category} · {topic.audience.replace(/-/g, ' ')} · depth {topic.desiredDepth}
          </p>
        </div>
        <div className="vc-topic__score-wrap">
          <span className="vc-topic__score">{topic.score}</span>
          <VC_Badge value={topic.status} />
        </div>
      </header>

      {topic.description ? <p className="vc-topic__description">{topic.description}</p> : null}

      {topic.measurableOutcome ? (
        <p className="vc-topic__outcome">
          <span className="vc-topic__outcome-icon" aria-hidden="true">
            ↗
          </span>
          {topic.measurableOutcome}
        </p>
      ) : null}

      {topic.toolName ? (
        <p className="vc-topic__tool">
          <span className="vc-topic__tool-label">Tool</span>
          {topic.toolUrl ? (
            <a href={topic.toolUrl} target="_blank" rel="noreferrer noopener">
              {topic.toolName}
            </a>
          ) : (
            <span>{topic.toolName}</span>
          )}
          {topic.isFreeOrOpenSource ? (
            <span className="vc-topic__free">free / open source</span>
          ) : (
            <span className="vc-topic__paid">may be paid</span>
          )}
        </p>
      ) : null}

      {topic.whatYouWillBuild ? (
        <div className="vc-topic__build">
          <span className="vc-topic__build-label">What you&apos;ll build</span>
          <p className="vc-topic__build-text">{topic.whatYouWillBuild}</p>
        </div>
      ) : null}

      {topic.whyNow || topic.whoBenefits ? (
        <dl className="vc-topic__facts">
          {topic.whoBenefits ? (
            <div>
              <dt>Who benefits</dt>
              <dd>{topic.whoBenefits}</dd>
            </div>
          ) : null}
          {topic.whyNow ? (
            <div>
              <dt>Why now</dt>
              <dd>{topic.whyNow}</dd>
            </div>
          ) : null}
          {topic.credibilityAnchor ? (
            <div>
              <dt>Why believe it</dt>
              <dd>{topic.credibilityAnchor}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {topic.prerequisites?.length ? (
        <p className="vc-topic__prereqs">
          <strong>Prerequisites:</strong> {topic.prerequisites.join(' · ')}
        </p>
      ) : null}

      {topic.rankingReasons.length ? (
        <ul className="vc-topic__reasons">
          {topic.rankingReasons.map((reason, index) => (
            <li key={`${topic._id}-reason-${index}`}>{reason}</li>
          ))}
        </ul>
      ) : null}

      {topic.sources.length ? (
        <p className="vc-topic__sources">
          Sources:{' '}
          {topic.sources.map((source, index) => (
            <span key={`${topic._id}-source-${index}`}>
              <a href={source.url} target="_blank" rel="noreferrer noopener">
                {source.title || source.url}
              </a>
              {index < topic.sources.length - 1 ? ', ' : ''}
            </span>
          ))}
        </p>
      ) : null}

      {topic.rejectedReason ? (
        <p className="vc-topic__rejected">Rejected: {topic.rejectedReason}</p>
      ) : null}

      <footer className="vc-topic__actions">
        {topic.status === 'candidate' ? (
          <>
            <VC_Button variant="primary" loading={busy} onClick={() => onApprove(topic)}>
              Approve
            </VC_Button>
            <VC_Button variant="danger" loading={busy} onClick={() => onReject(topic)}>
              Reject
            </VC_Button>
          </>
        ) : null}

        <VC_Button variant="secondary" loading={busy} onClick={() => onResearch(topic)}>
          Research
        </VC_Button>

        {researched ? (
          <VC_Button variant="ghost" onClick={() => onOpenResearch(topic)}>
            View MASTER.md
          </VC_Button>
        ) : null}

        <VC_Button variant="primary" loading={busy} onClick={() => onGenerate(topic)}>
          Generate course
        </VC_Button>
      </footer>
    </article>
  );
}

export default VC_TopicCard;
