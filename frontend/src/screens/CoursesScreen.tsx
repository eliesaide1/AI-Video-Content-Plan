import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import sharedService, { RealtimeEvent, type Course } from '../shared/sharedService';
import { VC_Badge } from '../components/VC_Badge';
import { VC_Button } from '../components/VC_Button';
import { VC_Card } from '../components/VC_Card';
import { VC_EmptyState } from '../components/VC_EmptyState';
import { VC_PageHeader } from '../components/VC_PageHeader';
import { VC_Spinner } from '../components/VC_Spinner';

/** Courses — everything the factory has produced so far. */
export function CoursesScreen() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCourses(await sharedService.listCourses());
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
    () => sharedService.realtime.on(RealtimeEvent.CourseUpdated, () => void load()),
    [load],
  );

  if (loading) return <VC_Spinner label="Loading courses..." />;

  return (
    <div className="vc-screen">
      <VC_PageHeader
        title="Courses"
        description="Generated curricula. Open one to review its sections, lessons and teaser."
        actions={
          <VC_Button variant="secondary" onClick={() => void load()}>
            Refresh
          </VC_Button>
        }
      />

      {courses.length ? (
        <div className="vc-course-grid">
          {courses.map((course) => (
            <VC_Card
              key={course._id}
              title={course.title}
              subtitle={`${course.level} · ${course.targetAudience.replace(/-/g, ' ')} · ${course.estimatedDuration} min`}
              actions={<VC_Badge value={course.status} />}
            >
              <p className="vc-course-grid__description">{course.description}</p>

              {course.error ? <p className="vc-error-text">{course.error}</p> : null}

              <div className="vc-course-grid__footer">
                <span>{course.learningObjectives.length} objective(s)</span>
                <VC_Button onClick={() => navigate(`/courses/${course._id}`)}>Open</VC_Button>
              </div>
            </VC_Card>
          ))}
        </div>
      ) : (
        <VC_EmptyState
          title="No courses yet"
          message="Approve a topic on the Discover screen and generate a course."
          action={<VC_Button onClick={() => navigate('/discover')}>Go to Discover</VC_Button>}
        />
      )}
    </div>
  );
}

export default CoursesScreen;
