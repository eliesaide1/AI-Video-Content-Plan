import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import sharedService, { type HealthInfo } from '../shared/sharedService';

const LINKS = [
  { to: '/discover', label: 'Discover' },
  { to: '/courses', label: 'Courses' },
  { to: '/teasers', label: 'Teasers' },
  { to: '/generation', label: 'Generation' },
];

/** Top navigation plus a live backend/AI status readout. */
export function VC_Nav() {
  const [health, setHealth] = useState<HealthInfo | null>(null);

  useEffect(() => {
    // Health is informational: a failure here should not raise a global alert.
    sharedService
      .health()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <nav className="vc-nav">
      <span className="vc-nav__brand">AI Content &amp; Course Factory</span>

      <ul className="vc-nav__links">
        {LINKS.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              className={({ isActive }) =>
                `vc-nav__link ${isActive ? 'vc-nav__link--active' : ''}`
              }
            >
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>

      <span className={`vc-nav__health vc-nav__health--${health ? 'up' : 'down'}`}>
        {health
          ? `db ${health.database} · ai ${health.aiProvider}`
          : 'backend unreachable'}
      </span>
    </nav>
  );
}

export default VC_Nav;
