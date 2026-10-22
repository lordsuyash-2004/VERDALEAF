import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X, Check, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";

const MAX_EDGE = 1600;

function frameToDataUrl(video) {
  const w = video.videoWidth;
  const h = video.videoHeight;
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

export const CameraCapture = ({ onCapture, onClose }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [facing, setFacing] = useState("environment");
  const [shot, setShot] = useState(null);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState(null);
  const [hasMultiple, setHasMultiple] = useState(false);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStarting(true);
    setError(null);

    (async () => {
      try {
        stop();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        const devices = await navigator.mediaDevices.enumerateDevices();
        setHasMultiple(devices.filter((d) => d.kind === "videoinput").length > 1);
      } catch (e) {
        if (!cancelled) {
          setError(
            e?.name === "NotAllowedError"
              ? "Camera permission denied. Allow camera access in your browser settings, or upload a photo instead."
              : "No camera available on this device. Upload a photo instead."
          );
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [facing, stop]);

  useEffect(() => () => stop(), [stop]);

  const close = () => {
    stop();
    onClose();
  };

  const shoot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      toast.error("Camera is still warming up — try again in a second.");
      return;
    }
    setShot(frameToDataUrl(video));
  };

  const use = () => {
    stop();
    onCapture(shot);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col animate-in fade-in duration-200"
      data-testid="camera-sheet"
    >
      <div className="flex items-center justify-between px-4 h-16 shrink-0 text-white/90">
        <span className="text-xs tracking-[0.25em] uppercase font-semibold">
          {shot ? "Review shot" : "Live camera"}
        </span>
        <button
          onClick={close}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          aria-label="Close camera"
          data-testid="camera-close-btn"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`w-full h-full object-cover ${facing === "user" ? "scale-x-[-1]" : ""} ${shot ? "invisible" : ""}`}
          data-testid="camera-video"
        />
        {shot && (
          <img
            src={shot}
            alt="captured leaf"
            className="absolute inset-0 w-full h-full object-contain bg-black"
            data-testid="camera-shot-preview"
          />
        )}

        {!shot && !error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-[72%] max-w-sm aspect-square rounded-3xl border-2 border-white/50 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        )}

        {starting && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-white/80 gap-2" data-testid="camera-starting">
            <Loader2 className="w-5 h-5 animate-spin" /> Starting camera…
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-8" data-testid="camera-error">
            <p className="text-center text-sm text-white/80 max-w-xs leading-relaxed">{error}</p>
          </div>
        )}

        {!shot && !error && !starting && (
          <p className="absolute inset-x-0 bottom-4 text-center text-xs text-white/70 px-8">
            Fill the frame with one leaf. Steady hands, natural light.
          </p>
        )}
      </div>

      <div className="shrink-0 px-6 pb-10 pt-6 flex items-center justify-center gap-8">
        {shot ? (
          <>
            <button
              onClick={() => setShot(null)}
              className="flex flex-col items-center gap-2 text-white/80 hover:text-white transition-colors"
              data-testid="camera-retake-btn"
            >
              <span className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                <RotateCcw className="w-6 h-6" />
              </span>
              <span className="text-xs">Retake</span>
            </button>
            <button
              onClick={use}
              className="flex flex-col items-center gap-2 text-white transition-transform active:scale-95"
              data-testid="camera-use-btn"
            >
              <span className="w-20 h-20 rounded-full bg-botanical-forest border-4 border-white/80 flex items-center justify-center">
                <Check className="w-8 h-8" />
              </span>
              <span className="text-xs font-semibold">Use photo</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
              disabled={!hasMultiple || !!error}
              className="flex flex-col items-center gap-2 text-white/80 hover:text-white disabled:opacity-30 transition-colors"
              data-testid="camera-switch-btn"
            >
              <span className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                <RefreshCw className="w-6 h-6" />
              </span>
              <span className="text-xs">Flip</span>
            </button>
            <button
              onClick={shoot}
              disabled={!!error || starting}
              className="w-20 h-20 rounded-full bg-white border-4 border-white/40 flex items-center justify-center text-botanical-forest disabled:opacity-40 active:scale-90 transition-transform"
              aria-label="Take photo"
              data-testid="camera-shutter-btn"
            >
              <Camera className="w-8 h-8" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CameraCapture;
