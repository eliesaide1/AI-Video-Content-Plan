import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import sharedService, { type Lesson } from '../shared/sharedService';
import { VC_Badge } from '../components/VC_Badge';
import { VC_Button } from '../components/VC_Button';
import { VC_Card } from '../components/VC_Card';
import { VC_EmptyState } from '../components/VC_EmptyState';
import { VC_Markdown } from '../components/VC_Markdown';
import { VC_PageHeader } from '../components/VC_PageHeader';
import { VC_Spinner } from '../components/VC_Spinner';
import { VC_Tabs } from '../components/VC_Tabs';

const TABS = [
  { id: 'edit', label: 'Edit' },
  { id: 'preview', label: 'Preview' },
];

/** Lesson editor — inspect and edit generated markdown before rendering. */
export function LessonEditorScreen() {
  const { lessonId = '' } = useParams();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [markdown, setMarkdown] = useState('');
  const [original, setOriginal] = useState('');
  const [path, setPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('edit');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [loadedLesson, document] = await Promise.all([
          sharedService.getLesson(lessonId),
          sharedService.getLessonMarkdown(lessonId),
        ]);
        if (cancelled) return;
        setLesson(loadedLesson);
        setMarkdown(document.markdown);
        setOriginal(document.markdown);
        setPath(document.path);
      } catch {
        // Alert already shown.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  async function save() {
    setSaving(true);
    try {
      const updated = await sharedService.saveLessonMarkdown(lessonId, markdown);
      setLesson(updated);
      setOriginal(markdown);
      sharedService.pushAlert({
        kind: 'success',
        title: 'Lesson saved',
        message: `"${updated.title}" was written back to disk.`,
      });
    } catch {
      // Alert already shown.
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <VC_Spinner label="Loading lesson..." />;
  if (!lesson) return <VC_EmptyState title="Lesson not found" />;

  const dirty = markdown !== original;

  return (
    <div className="vc-screen">
      <VC_PageHeader
        title={lesson.title}
        description={lesson.learningObjective}
        actions={
          <>
            <VC_Button loading={saving} disabled={!dirty} onClick={save}>
              {dirty ? 'Save changes' : 'Saved'}
            </VC_Button>
            <VC_Button
              variant="secondary"
              onClick={async () => {
                try {
                  await sharedService.regenerateLesson(lessonId);
                  sharedService.pushAlert({
                    kind: 'info',
                    title: 'Regenerating',
                    message: 'Watch the Generation screen for progress.',
                  });
                } catch {
                  /* alert shown */
                }
              }}
            >
              Regenerate
            </VC_Button>
            <VC_Button variant="ghost" onClick={() => navigate(`/courses/${lesson.courseId}`)}>
              Back to course
            </VC_Button>
          </>
        }
      />

      <div className="vc-inline-meta">
        <VC_Badge value={lesson.status} />
        <span>{lesson.estimatedDuration} min</span>
        {path ? <span>{path}</span> : null}
      </div>

      <VC_Tabs tabs={TABS} activeId={activeTab} onChange={setActiveTab} />

      {activeTab === 'edit' ? (
        <VC_Card title="Lesson markdown">
          <textarea
            className="vc-editor"
            value={markdown}
            spellCheck={false}
            onChange={(event) => setMarkdown(event.target.value)}
          />
        </VC_Card>
      ) : (
        <VC_Card title="Preview">
          <VC_Markdown markdown={markdown} />
        </VC_Card>
      )}
    </div>
  );
}

export default LessonEditorScreen;
