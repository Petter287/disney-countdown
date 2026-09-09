import { useEffect, useState } from 'react';
import type { TripSettings } from '../model/trip';
import { calculateCountdown, formatTripStartDate } from '../model/countdown';

function pad(value: number, length: number) {
  return String(value).padStart(length, '0');
}

export function TripCountdown({ settings }: { settings: TripSettings }) {
  const [snapshot, setSnapshot] = useState(() => calculateCountdown(settings.startAt, settings.defaultArrivalAt));

  useEffect(() => {
    const tick = () => setSnapshot(calculateCountdown(settings.startAt, settings.defaultArrivalAt));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [settings.startAt, settings.defaultArrivalAt]);

  return (
    <>
      <div className="date-pill">{formatTripStartDate(settings.defaultArrivalAt, settings.defaultTimezone)}</div>
      <div className="countdown-grid" aria-label="Cuenta regresiva">
        <div className="count-unit"><strong>{pad(snapshot.days, 3)}</strong><span>Días</span></div>
        <div className="count-unit"><strong>{pad(snapshot.hours, 2)}</strong><span>Horas</span></div>
        <div className="count-unit"><strong>{pad(snapshot.minutes, 2)}</strong><span>Minutos</span></div>
        <div className="count-unit"><strong>{pad(snapshot.seconds, 2)}</strong><span>Segundos</span></div>
      </div>
      <div className="countdown-progress-label">
        <span>Cuenta regresiva iniciada</span>
        <span>{snapshot.percent.toFixed(1)}%</span>
      </div>
      <div className="countdown-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(snapshot.percent)}>
        <div className="countdown-progress-fill" style={{ width: `${snapshot.percent}%` }} />
      </div>
      <p className="countdown-message">
        {snapshot.started
          ? 'El viaje ya comenzó.'
          : `Faltan ${snapshot.days} ${snapshot.days === 1 ? 'día' : 'días'} para el comienzo del viaje.`}
      </p>
    </>
  );
}
