import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import sharedService, {
  RealtimeEvent,
  type Audience,
  type CourseDepth,
  type MetaInfo,
  type StartedJob,
  type Topic,
} from '../shared/sharedService';
import { VC_Button } from '../components/VC_Button';
import { VC_Card } from '../components/VC_Card';
import { VC_EmptyState } from '../components/VC_EmptyState';
import { VC_Input } from '../components/VC_Input';
import { VC_JobProgress } from '../components/VC_JobProgress';
import { VC_PageHeader } from '../components/VC_PageHeader';
import { VC_Select } from '../components/VC_Select';
import { VC_Spinner } from '../components/VC_Spinner';
import { VC_TextArea } from '../components/VC_TextArea';
import { VC_TopicCard } from '../components/VC_TopicCard';

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'candidate', label: 'Candidates' },
  { value: 'approved', label: 'Approved' },
  { value: 'researched', label: 'Researched' },
  { value: 'course-generated', label: 'Course generated' },
  { value: 'rejected', label: 'Rejected' },
];

/**
 * Discover — enter a topic manually or run automated discovery, then approve
 * what should go through the pipeline. This is the human approval gate.
 */
export function DiscoverScreen() {
  const navigate = useNavigate();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [meta, setMeta] = useState<MetaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyTopicId, setBusyTopicId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<StartedJob | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [whatYouWillBuild, setWhatYouWillBuild] = useState('');
  const [audience, setAudience] = useState<Audience>('intermediate-developers');
  const [depth, setDepth] = useState<CourseDepth>('medium');
  const [creating, setCreating] = useState(false);

  const loadTopics = useCallback(async () => {
    setLoading(true);
    try {
      const result = await sharedService.listTopics({
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setTopics(result);
    } catch {
      // The alert was already raised by sharedService.handleServerError.
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    void loadTopics();
  }, [loadTopics]);

  useEffect(() => {
    sharedService
      .meta()
      .then(setMeta)
      .catch(() => undefined);
  }, []);

  // Realtime: topic approvals and finished discovery runs refresh the list.
  useEffect(() => {
    const offTopic = sharedService.realtime.on(RealtimeEvent.TopicUpdated, () => {
      void loadTopics();
    });
    const offDiscovery = sharedService.realtime.on(RealtimeEvent.DiscoveryCompleted, () => {
      void loadTopics();
    });
    return () => {
      offTopic();
      offDiscovery();
    };
  }, [loadTopics]);

  const audienceOptions = useMemo(
    () =>
      (meta?.audiences ?? ['intermediate-developers']).map((value) => ({
        value,
        label: value.replace(/-/g, ' '),
      })),
    [meta],
  );

  const depthOptions = useMemo(
    () =>
      (meta?.depths ?? ['short', 'medium', 'large']).map((value) => ({
        value,
        label:
          value === 'short'
            ? 'short (~30-60 min)'
            : value === 'medium'
              ? 'medium (~1-4 h)'
              : 'large (~10-12 h)',
      })),
    [meta],
  );

  async function handleCreateTopic(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      await sharedService.createTopic({
        title,
        description: description || undefined,
        whatYouWillBuild: whatYouWillBuild || undefined,
        audience,
        desiredDepth: depth,
      });
      sharedService.pushAlert({
        kind: 'success',
        title: 'Topic added',
        message: `"${title}" is approved and ready to research.`,
      });
      setTitle('');
      setDescription('');
      setWhatYouWillBuild('');
      await loadTopics();
    } catch {
      // Alert already shown.
    } finally {
      setCreating(false);
    }
  }

  async function runDiscovery() {
    try {
      const job = await sharedService.discoverTopics();
      setActiveJob(job);
    } catch {
      // Alert already shown.
    }
  }

  async function withBusy(topic: Topic, action: () => Promise<unknown>) {
    setBusyTopicId(topic._id);
    try {
      await action();
    } catch {
      // Alert already shown.
    } finally {
      setBusyTopicId(null);
    }
  }

  return (
    <div className="vc-screen">
      <VC_PageHeader
        title="Discover"
        description="Add a topic yourself or pull candidates from real sources, then approve what gets built. Every topic should be something a student can follow step by step to a working result."
        actions={<VC_Button onClick={runDiscovery}>Run discovery</VC_Button>}
      />

      {activeJob ? (
        <VC_Card title="Discovery run">
          <VC_JobProgress
            jobId={activeJob.jobId}
            title="Discovery"
            onCompleted={() => void loadTopics()}
          />
        </VC_Card>
      ) : null}

      <VC_Card title="Add a topic manually">
        <form className="vc-form" onSubmit={handleCreateTopic}>
          <VC_Input
            label="Topic title"
            value={title}
            required
            minLength={5}
            placeholder="Build a pull-request review bot for your team"
            hint="Phrase it as an outcome: Build… / Add… / Automate… / Fix…"
            onChange={(event) => setTitle(event.target.value)}
          />
          <VC_TextArea
            label="What the student will build"
            value={whatYouWillBuild}
            rows={2}
            placeholder="A bot running on their own repo that comments review notes on every pull request."
            hint="The thing they have working at the end. This steers the whole course."
            onChange={(event) => setWhatYouWillBuild(event.target.value)}
          />
          <VC_TextArea
            label="Description"
            value={description}
            rows={3}
            placeholder="What problem does this solve, and how does the course solve it?"
            onChange={(event) => setDescription(event.target.value)}
          />
          <div className="vc-form__row">
            <VC_Select
              label="Audience"
              value={audience}
              options={audienceOptions}
              onChange={(event) => setAudience(event.target.value as Audience)}
            />
            <VC_Select
              label="Approximate depth"
              value={depth}
              options={depthOptions}
              hint="A hint about scope — content is never padded to reach it."
              onChange={(event) => setDepth(event.target.value as CourseDepth)}
            />
          </div>
          <VC_Button type="submit" loading={creating}>
            Add topic
          </VC_Button>
        </form>
      </VC_Card>

      <VC_Card
        title="Topics"
        actions={
          <div className="vc-filters">
            <VC_Select
              label="Status"
              value={statusFilter}
              options={STATUS_FILTERS}
              onChange={(event) => setStatusFilter(event.target.value)}
            />
            <VC_Input
              label="Search"
              value={search}
              placeholder="mcp agents"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        }
      >
        {loading ? (
          <VC_Spinner label="Loading topics..." />
        ) : topics.length ? (
          <div className="vc-topic-list">
            {topics.map((topic) => (
              <VC_TopicCard
                key={topic._id}
                topic={topic}
                busy={busyTopicId === topic._id}
                onApprove={(selected) =>
                  void withBusy(selected, async () => {
                    await sharedService.approveTopic(selected._id);
                    await loadTopics();
                  })
                }
                onReject={(selected) =>
                  void withBusy(selected, async () => {
                    await sharedService.rejectTopic(selected._id, 'Not a good fit right now');
                    await loadTopics();
                  })
                }
                onResearch={(selected) =>
                  void withBusy(selected, async () => {
                    const job = await sharedService.researchTopic(selected._id);
                    setActiveJob(job);
                  })
                }
                onGenerate={(selected) =>
                  void withBusy(selected, async () => {
                    const job = await sharedService.generateFromTopic(selected._id);
                    setActiveJob(job);
                  })
                }
                onOpenResearch={(selected) => navigate(`/research/${selected._id}`)}
              />
            ))}
          </div>
        ) : (
          <VC_EmptyState
            title="No topics yet"
            message="Add one manually above, or run discovery to pull candidates from real sources."
          />
        )}
      </VC_Card>
    </div>
  );
}

export default DiscoverScreen;
