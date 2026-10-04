import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import sharedService, {
  type MasterDocument,
  type Research,
  type StartedJob,
  type Topic,
} from '../shared/sharedService';
import { VC_Badge } from '../components/VC_Badge';
import { VC_Button } from '../components/VC_Button';
import { VC_Card } from '../components/VC_Card';
import { VC_ClaimList } from '../components/VC_ClaimList';
import { VC_EmptyState } from '../components/VC_EmptyState';
import { VC_JobProgress } from '../components/VC_JobProgress';
import { VC_Markdown } from '../components/VC_Markdown';
import { VC_PageHeader } from '../components/VC_PageHeader';
import { VC_Spinner } from '../components/VC_Spinner';
import { VC_Tabs } from '../components/VC_Tabs';

const TABS = [
  { id: 'master', label: 'MASTER.md' },
  { id: 'claims', label: 'Claims & confidence' },
  { id: 'sources', label: 'Sources' },
];

/** Research review: read MASTER.md and approve before the course is built. */
export function ResearchScreen() {
  const { topicId = '' } = useParams();
  const navigate = useNavigate();

  const [topic, setTopic] = useState<Topic | null>(null);
  const [research, setResearch] = useState<Research | null>(null);
  const [master, setMaster] = useState<MasterDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('master');
  const [activeJob, setActiveJob] = useState<StartedJob | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const loadedTopic = await sharedService.getTopic(topicId);
        if (cancelled) return;
        setTopic(loadedTopic);

        // Research may not exist yet — that is an expected state, not an error
        // the user needs an alert for.
        const loadedResearch = await sharedService.getResearchByTopic(topicId).catch(() => null);
        if (cancelled) return;
        setResearch(loadedResearch);

        if (loadedResearch?.masterMarkdownPath) {
          const loadedMaster = await sharedService.getMasterDocument(topicId).catch(() => null);
          if (!cancelled) setMaster(loadedMaster);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [topicId]);

  async function startResearch() {
    try {
      setActiveJob(await sharedService.researchTopic(topicId));
    } catch {
      // Alert already shown.
    }
  }

  async function approveAndGenerate() {
    try {
      await sharedService.approveTopic(topicId);
      setActiveJob(await sharedService.generateFromTopic(topicId));
    } catch {
      // Alert already shown.
    }
  }

  if (loading) return <VC_Spinner label="Loading research..." />;
  if (!topic) return <VC_EmptyState title="Topic not found" />;

  return (
    <div className="vc-screen">
      <VC_PageHeader
        title={topic.title}
        description={topic.description}
        actions={
          <>
            <VC_Button variant="secondary" onClick={startResearch}>
              {research ? 'Re-run research' : 'Run research'}
            </VC_Button>
            <VC_Button onClick={approveAndGenerate}>Approve &amp; generate course</VC_Button>
            <VC_Button variant="ghost" onClick={() => navigate('/discover')}>
              Back
            </VC_Button>
          </>
        }
      />

      <div className="vc-inline-meta">
        <VC_Badge value={topic.status} />
        {research ? <VC_Badge value={research.status} /> : null}
        <span>{topic.audience.replace(/-/g, ' ')}</span>
        <span>depth {topic.desiredDepth}</span>
        {research?.aiModel ? <span>model {research.aiModel}</span> : null}
      </div>

      {activeJob ? (
        <VC_Card title="Running">
          <VC_JobProgress
            jobId={activeJob.jobId}
            title={activeJob.type}
            onCompleted={(payload) => {
              if (payload.status === 'completed') window.location.reload();
            }}
          />
        </VC_Card>
      ) : null}

      {research?.error ? (
        <VC_Card title="Last error">
          <p className="vc-error-text">{research.error}</p>
        </VC_Card>
      ) : null}

      {!research ? (
        <VC_EmptyState
          title="No research yet"
          message="Run research to produce MASTER.md for this topic."
          action={<VC_Button onClick={startResearch}>Run research</VC_Button>}
        />
      ) : (
        <>
          <VC_Tabs tabs={TABS} activeId={activeTab} onChange={setActiveTab} />

          {activeTab === 'master' ? (
            <VC_Card title="MASTER.md" subtitle={master?.path ?? research.masterMarkdownPath ?? ''}>
              {master ? (
                <VC_Markdown markdown={master.markdown} />
              ) : (
                <VC_EmptyState title="MASTER.md has not been written yet" />
              )}
            </VC_Card>
          ) : null}

          {activeTab === 'claims' ? (
            <VC_Card
              title="Claims & confidence"
              subtitle="Only claims marked as verified facts are backed by a source."
            >
              <VC_ClaimList claims={research.claims} />
            </VC_Card>
          ) : null}

          {activeTab === 'sources' ? (
            <VC_Card title="Sources" subtitle={research.sourcesMarkdownPath ?? ''}>
              {research.sources.length ? (
                <ul className="vc-source-list">
                  {research.sources.map((source, index) => (
                    <li key={index}>
                      <a href={source.url} target="_blank" rel="noreferrer noopener">
                        {source.title || source.url}
                      </a>
                      {source.publishedAt ? (
                        <span className="vc-source-list__date">
                          published {new Date(source.publishedAt).toLocaleDateString()}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <VC_EmptyState title="No sources recorded" />
              )}
            </VC_Card>
          ) : null}
        </>
      )}
    </div>
  );
}

export default ResearchScreen;
