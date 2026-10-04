import type { Lesson, Section } from '../shared/sharedService';
import { VC_Badge } from './VC_Badge';
import { VC_Button } from './VC_Button';

interface Props {
  sections: Section[];
  onOpenLesson: (lesson: Lesson) => void;
  onRegenerateLesson: (lesson: Lesson) => void;
}

/** Course -> Sections -> Lessons, the curriculum tree of the details screen. */
export function VC_SectionList({ sections, onOpenLesson, onRegenerateLesson }: Props) {
  return (
    <div className="vc-sections">
      {sections.map((section) => (
        <section className="vc-sections__item" key={section._id}>
          <header className="vc-sections__head">
            <h3>
              Section {section.order} — {section.title}
            </h3>
            <span className="vc-sections__count">{section.lessons.length} lesson(s)</span>
          </header>

          {section.description ? (
            <p className="vc-sections__description">{section.description}</p>
          ) : null}

          <ul className="vc-lessons">
            {section.lessons.map((lesson) => (
              <li className="vc-lessons__row" key={lesson._id}>
                <div className="vc-lessons__info">
                  <span className="vc-lessons__order">{lesson.orderInSection}</span>
                  <div>
                    <strong className="vc-lessons__title">{lesson.title}</strong>
                    <p className="vc-lessons__objective">
                      {lesson.learningObjective || 'No objective recorded'}
                    </p>
                    {lesson.error ? (
                      <p className="vc-lessons__error">{lesson.error}</p>
                    ) : null}
                  </div>
                </div>

                <div className="vc-lessons__right">
                  <span className="vc-lessons__duration">{lesson.estimatedDuration} min</span>
                  <VC_Badge value={lesson.status} />
                  <VC_Button
                    variant="ghost"
                    disabled={!lesson.markdownPath}
                    onClick={() => onOpenLesson(lesson)}
                  >
                    Edit
                  </VC_Button>
                  <VC_Button variant="secondary" onClick={() => onRegenerateLesson(lesson)}>
                    Regenerate
                  </VC_Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default VC_SectionList;
