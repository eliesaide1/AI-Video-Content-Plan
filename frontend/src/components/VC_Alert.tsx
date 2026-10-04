import { useEffect, useState } from 'react';
import { dismissAlert, subscribeToAlerts, type AppAlert } from '../shared/sharedService';

/**
 * VC_Alert — the single alert surface of the application.
 *
 * It renders whatever `sharedService.handleServerError()` publishes, which
 * means EVERY server error becomes a visible alert without any screen having
 * to wire it up. Mounted once in App.tsx.
 */
export function VC_Alert() {
  const [alerts, setAlerts] = useState<AppAlert[]>([]);

  useEffect(() => subscribeToAlerts(setAlerts), []);

  if (!alerts.length) return null;

  return (
    <div className="vc-alert-stack" role="region" aria-label="Notifications">
      {alerts.map((alert) => (
        <div key={alert.id} className={`vc-alert vc-alert--${alert.kind}`} role="alert">
          <div className="vc-alert__body">
            <strong className="vc-alert__title">{alert.title}</strong>
            <p className="vc-alert__message">{alert.message}</p>

            {alert.details?.length ? (
              <ul className="vc-alert__details">
                {alert.details.map((detail, index) => (
                  <li key={`${alert.id}-detail-${index}`}>{detail}</li>
                ))}
              </ul>
            ) : null}

            {alert.requestId ? (
              <span className="vc-alert__request">request {alert.requestId}</span>
            ) : null}
          </div>

          <button
            type="button"
            className="vc-alert__close"
            aria-label="Dismiss notification"
            onClick={() => dismissAlert(alert.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export default VC_Alert;
