"use client";

export function LoginVisualBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="login-visual-base absolute inset-0" />
      <div className="login-visual-mesh absolute inset-0" />
      <div className="login-visual-grid absolute inset-0" />
      <div className="login-visual-glow absolute inset-0" />
      <div className="login-visual-blob login-visual-blob-a absolute" />
      <div className="login-visual-blob login-visual-blob-b absolute" />
      <div className="login-visual-blob login-visual-blob-c absolute" />

      <svg
        className="login-visual-arcs absolute inset-0 h-full w-full"
        viewBox="0 0 800 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <path
          d="M-40 180 C 180 80, 420 60, 640 200"
          stroke="url(#auth-arc-a)"
          strokeWidth="1"
          opacity="0.5"
        />
        <path
          d="M 80 420 C 260 300, 520 280, 760 400"
          stroke="url(#auth-arc-b)"
          strokeWidth="1"
          opacity="0.35"
        />
        <path
          d="M 40 680 C 220 560, 480 520, 720 640"
          stroke="url(#auth-arc-a)"
          strokeWidth="1"
          opacity="0.25"
        />
        <circle cx="640" cy="200" r="3" fill="rgba(240,153,123,0.45)" />
        <circle cx="260" cy="300" r="2" fill="rgba(240,153,123,0.3)" />
        <circle cx="480" cy="520" r="2.5" fill="rgba(216,90,48,0.35)" />
        <defs>
          <linearGradient id="auth-arc-a" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(240,153,123,0)" />
            <stop offset="45%" stopColor="rgba(240,153,123,0.55)" />
            <stop offset="100%" stopColor="rgba(216,90,48,0.15)" />
          </linearGradient>
          <linearGradient id="auth-arc-b" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(216,90,48,0.05)" />
            <stop offset="50%" stopColor="rgba(240,153,123,0.4)" />
            <stop offset="100%" stopColor="rgba(240,153,123,0)" />
          </linearGradient>
        </defs>
      </svg>

      <svg
        className="login-visual-watermark absolute"
        viewBox="0 0 63 47"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M40.6714 0C52.8651 0 62.7501 9.885 62.7501 22.0787V46.4815C57.6159 46.4815 53.4538 42.3194 53.4538 37.1852V22.0787C53.4538 15.0192 47.7309 9.2963 40.6714 9.2963H34.6274C31.5455 9.2963 28.5894 10.5204 26.4103 12.6996L10.6581 28.453C9.78643 29.3245 9.29637 30.5066 9.2963 31.7393V32.537C9.2963 35.1041 11.3773 37.1852 13.9445 37.1852H34.8612C34.8612 42.1588 30.9553 46.2198 26.0438 46.4691L25.5649 46.4815H13.9445C6.24315 46.4815 0 40.2383 0 32.537V31.7393C7.20463e-05 28.0411 1.46913 24.494 4.08415 21.879L19.8374 6.1268C23.7601 2.20421 29.0799 0.00005 34.6274 0H40.6714Z"
          fill="currentColor"
        />
        <path
          d="M44.1574 12.7825C47.3663 12.7825 49.9676 15.3838 49.9676 18.5927V45.3195C44.8334 45.3195 40.6713 41.1575 40.6713 36.0232V22.0788H36.7857L29.1912 29.6733C28.1015 30.7629 26.6237 31.3751 25.0827 31.3751H15.6613C15.1747 31.3751 14.931 30.7867 15.2751 30.4427L31.2343 14.4846C32.3238 13.3951 33.8013 12.7825 35.3422 12.7825H44.1574Z"
          fill="currentColor"
        />
      </svg>

      <div className="login-visual-noise absolute inset-0" />
      <div className="login-visual-vignette absolute inset-0" />
    </div>
  );
}
