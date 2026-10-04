import type { TeaserBeat } from '../shared/sharedService';

interface Props {
  beats: TeaserBeat[];
  duration: number;
}

/** The 15-30s teaser timeline: hook -> problem -> idea -> outcome -> CTA. */
export function VC_TeaserBeats({ beats, duration }: Props) {
  return (
    <div className="vc-beats">
      <p className="vc-beats__total">Total duration: {duration}s</p>
      <ol className="vc-beats__list">
        {beats.map((beat, index) => (
          <li className="vc-beats__item" key={`${beat.label}-${index}`}>
            <div className="vc-beats__time">
              {beat.startSecond}s – {beat.endSecond}s
            </div>
            <div className="vc-beats__content">
              <span className="vc-beats__label">{beat.label.replace(/-/g, ' ')}</span>
              <p className="vc-beats__narration">{beat.narration}</p>
              {beat.onScreenText ? (
                <p className="vc-beats__screen">On screen: {beat.onScreenText}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default VC_TeaserBeats;
