import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import sharedService, { RealtimeEvent, type Course, type Teaser } from '../shared/sharedService';
import { VC_Badge } from '../components/VC_Badge';
import { VC_Button } from '../components/VC_Button';
import { VC_Card } from '../components/VC_Card';
import { VC_EmptyState } from '../components/VC_EmptyState';
import { VC_PageHeader } from '../components/VC_PageHeader';
import { VC_Spinner } from '../components/VC_Spinner';
import { VC_TeaserBeats } from '../components/VC_TeaserBeats';

/** Teasers — preview every 15-30 second promotional script. */
export function TeasersScreen() {
  const navigate = useNavigate();
  const [teasers, setTeasers] = useState<Teaser[]>([]);
  const [courses, setCourses] = useState<Record<string, Course>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedTeasers, loadedCourses] = await Promise.all([
        sharedService.listTeasers(),
        sharedService.listCourses(),
      ]);
      setTeasers(loadedTeasers);
      setCourses(Object.fromEntries(loadedCourses.map((course) => [course._id, course])));
    } catch {
      // Alert already shown.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(
    () => sharedService.realtime.on(RealtimeEvent.TeaserUpdated, () => void load()),
    [load],
  );

  if (loading) return <VC_Spinner label="Loading teasers..." />;

  return (
    <div className="vc-screen">
      <VC_PageHeader
        title="Teasers"
        description="Short promotional scripts generated alongside each course."
        actions={
          <VC_Button variant="secondary" onClick={() => void load()}>
            Refresh
          </VC_Button>
        }
      />

      {teasers.length ? (
        teasers.map((teaser) => {
          const course = courses[teaser.courseId];
          return (
            <VC_Card
              key={teaser._id}
              title={course?.title ?? 'Unknown course'}
              subtitle={`${teaser.duration}s · ${teaser.beats.length} beat(s)`}
              actions={
                <>
                  <VC_Badge value={teaser.status} />
                  <VC_Button
                    variant="ghost"
                    onClick={() => navigate(`/courses/${teaser.courseId}`)}
                  >
                    Open course
                  </VC_Button>
                </>
              }
            >
              <p className="vc-teaser__hook">{teaser.hook}</p>
              <VC_TeaserBeats beats={teaser.beats} duration={teaser.duration} />
              <p className="vc-teaser__cta">{teaser.callToAction}</p>
              {teaser.error ? <p className="vc-error-text">{teaser.error}</p> : null}
            </VC_Card>
          );
        })
      ) : (
        <VC_EmptyState
          title="No teasers yet"
          message="Generate a course — the teaser is produced at the end of the pipeline."
          action={<VC_Button onClick={() => navigate('/discover')}>Go to Discover</VC_Button>}
        />
      )}
    </div>
  );
}

export default TeasersScreen;
