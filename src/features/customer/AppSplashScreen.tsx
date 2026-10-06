import { useEffect, useState } from "react";

const SPLASH_DURATION_MS = 2700;
const EXIT_DURATION_MS = 650;

export function AppSplashScreen() {
  const [isVisible, setIsVisible] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const leaveTimer = window.setTimeout(() => setIsLeaving(true), SPLASH_DURATION_MS);
    const removeTimer = window.setTimeout(
      () => setIsVisible(false),
      SPLASH_DURATION_MS + EXIT_DURATION_MS,
    );

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className={`meem-splash ${isLeaving ? "meem-splash--leaving" : ""}`}
      role="status"
      aria-label="أهلًا بك في ميم"
    >
      <div className="meem-splash__glow" aria-hidden="true" />
      <div className="meem-splash__content">
        <div className="meem-splash__mark">
          <img
            src="/app-icon-192.png"
            alt="شعار ميم"
            width={112}
            height={112}
            className="meem-splash__logo"
          />
        </div>

        <p className="meem-splash__brand" dir="ltr">
          MEEM <span aria-hidden="true">|</span> <span dir="rtl">ميم</span>
        </p>

        <div className="meem-splash__rule" aria-hidden="true" />

        <div className="meem-splash__welcome">
          <h1>أهلًا بك في ميم</h1>
          <p dir="ltr">Welcome to Meem</p>
        </div>
      </div>
    </div>
  );
}