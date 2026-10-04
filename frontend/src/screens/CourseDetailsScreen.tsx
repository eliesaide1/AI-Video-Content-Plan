import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import sharedService, {
  RealtimeEvent,
  type CourseTree,
  type MarkdownDocument,
  type StartedJob,
  type Teaser,
} from '../shared/sharedService';
import { VC_Badge } from '../components/VC_Badge';
import { VC_Button } from '../components/VC_Button';
import { VC_Card } from '../components/VC_Card';
import { VC_EmptyState } from '../components/VC_EmptyState';
import { VC_JobProgress } from '../components/VC_JobProgress';
import { VC_Markdown } from '../components/VC_Markdown';
import { VC_PageHeader } from '../components/VC_PageHeader';
import { VC_SectionList } from '../components/VC_SectionList';
import { VC_Spinner } from '../components/VC_Spinner';
import { VC_Tabs } from '../components/VC_Tabs';
import { VC_TeaserBeats } from '../components/VC_TeaserBeats';

const TABS = [
  { id: 'curriculum', label: 'Curriculum' },
  { id: 'plan', label: 'COURSE.md' },
  { id: 'teaser', label: 'Teaser' },
];

/** Course details: Course -> Sections -> Lessons, plus COURSE.md and the teaser. */
export function CourseDetailsScreen() {
  const { courseId = '' } = useParams();
  const navigate = useNavigate();

  const [tree, setTree] = useState<CourseTree | null>(null);
  const [plan, setPlan] = useState<MarkdownDocument | null>(null);
  const [teaser, setTeaser] = useState<Teaser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('curriculum');
  const [activeJob, setActiveJob] = useState<StartedJob | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const loadedTree = await sharedService.getCourse(courseId);
      setTree(loadedTree);

      // Both are optional artefacts; absence is a normal state.
      setPlan(
        loadedTree.course.coursePlanPath
          ? await sharedService.getCoursePlan(courseId).catch(() => null)
          : null,
      );
      setTeaser(await sharedService.getTeaser(courseId).catch(() => null));
    } catch {
      // Alert already shown.
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const offLesson = sharedService.realtime.on(RealtimeEvent.LessonUpdated, () => void load());
    const offCourse = sharedService.realtime.on(RealtimeEvent.CourseUpdated, () => void load());
    const offTeaser = sharedService.realtime.on(RealtimeEvent.TeaserUpdated, () => void load());
    return () => {
      offLesson();
      offCourse();
      offTeaser();
    };
  }, [load]);

  if (loading) return <VC_Spinner label="Loading course..." />;
  if (!tree) return <VC_EmptyState title="Course not found" />;

  const { course, sections } = tree;
  const lessonCount = sections.reduce((total, section) => total + section.lessons.length, 0);

  return (
    <div className="vc-screen">
      <VC_PageHeader
        title={course.title}
        description={course.description}
        actions={
          <>
            <VC_Button
              variant="secondary"
              onClick={async () => {
                try {
                  setActiveJob(await sharedService.generateCourse(courseId));
                } catch {
                  /* alert shown */
                }
              }}
            >
              Regenerate curriculum
            </VC_Button>
            <VC_Button
              onClick={async () => {
                try {
                  setActiveJob(await sharedService.generateTeaser(courseId));
                } catch {
                  /* alert shown */
                }
              }}
            >
              {teaser ? 'Regenerate teaser' : 'Generate teaser'}
            </VC_Button>
            <VC_Button variant="ghost" onClick={() => navigate('/courses')}>
              Back
            </VC_Button>
          </>
        }
      />

      <div className="vc-inline-meta">
        <VC_Badge value={course.status} />
        <span>{course.level}</span>
        <span>{course.targetAudience.replace(/-/g, ' ')}</span>
        <span>{course.estimatedDuration} min</span>
        <span>
          {sections.length} section(s) · {lessonCount} lesson(s)
        </span>
      </div>

      {activeJob ? (
        <VC_Card title="Running">
          <VC_JobProgress
            jobId={activeJob.jobId}
            title={activeJob.type}
            onCompleted={() => void load()}
          />
        </VC_Card>
      ) : null}

      {course.error ? (
        <VC_Card title="Last error">
          <p className="vc-error-text">{course.error}</p>
        </VC_Card>
      ) : null}

      <VC_Tabs tabs={TABS} activeId={activeTab} onChange={setActiveTab} />

      {activeTab === 'curriculum' ? (
        <>
          {course.learningObjectives.length || course.prerequisites.length ? (
            <VC_Card title="Objectives & prerequisites">
              <div className="vc-two-col">
                <div>
                  <h4>Learning objectives</h4>
                  <ul>
                    {course.learningObjectives.map((objective, index) => (
                      <li key={index}>{objective}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4>Prerequisites</h4>
                  <ul>
                    {course.prerequisites.map((prerequisite, index) => (
                      <li key={index}>{prerequisite}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </VC_Card>
          ) : null}

          {sections.length ? (
            <VC_SectionList
              sections={sections}
              onOpenLesson={(lesson) => navigate(`/lessons/${lesson._id}`)}
              onRegenerateLesson={async (lesson) => {
                try {
                  setActiveJob(await sharedService.regenerateLesson(lesson._id));
                } catch {
                  /* alert shown */
                }
              }}
            />
          ) : (
            <VC_EmptyState
              title="No curriculum yet"
              message="Run 'Regenerate curriculum' to plan sections and lessons."
            />
          )}
        </>
      ) : null}

      {activeTab === 'plan' ? (
        <VC_Card title="COURSE.md" subtitle={plan?.path ?? course.coursePlanPath ?? ''}>
          {plan ? (
            <VC_Markdown markdown={plan.markdown} />
          ) : (
            <VC_EmptyState title="COURSE.md has not been generated yet" />
          )}
        </VC_Card>
      ) : null}

      {activeTab === 'teaser' ? (
        <VC_Card
          title="Teaser"
          subtitle={teaser?.markdownPath ?? ''}
          actions={teaser ? <VC_Badge value={teaser.status} /> : null}
        >
          {teaser ? (
            <>
              <p className="vc-teaser__hook">{teaser.hook}</p>
              <VC_TeaserBeats beats={teaser.beats} duration={teaser.duration} />
              <p className="vc-teaser__cta">{teaser.callToAction}</p>
            </>
          ) : (
            <VC_EmptyState
              title="No teaser yet"
              message="Generate the 15-30 second teaser for this course."
            />
          )}
        </VC_Card>
      ) : null}
    </div>
  );
}

export default CourseDetailsScreen;
