import type { ResearchClaim } from '../shared/sharedService';

interface Props {
  claims: ResearchClaim[];
}

const LABELS: Record<ResearchClaim['kind'], string> = {
  'verified-fact': 'Verified fact',
  'ai-explanation': 'AI explanation',
  recommendation: 'Recommendation',
  assumption: 'Assumption',
};

/**
 * Research claims grouped by confidence, so a reviewer can see at a glance
 * what is sourced and what is not before approving content for students.
 */
export function VC_ClaimList({ claims }: Props) {
  if (!claims.length) return <p className="vc-claims__empty">No claims were recorded.</p>;

  return (
    <ul className="vc-claims">
      {claims.map((claim, index) => (
        <li className={`vc-claims__item vc-claims__item--${claim.kind}`} key={index}>
          <span className="vc-claims__kind">{LABELS[claim.kind]}</span>
          <p className="vc-claims__statement">{claim.statement}</p>
          {claim.sourceUrls.length ? (
            <p className="vc-claims__sources">
              {claim.sourceUrls.map((url, urlIndex) => (
                <a key={urlIndex} href={url} target="_blank" rel="noreferrer noopener">
                  {url}
                </a>
              ))}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default VC_ClaimList;
