import {
  ArrowLeft,
  Camera,
  Check,
  Download,
  Images,
  LocateFixed,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  RefreshCw,
  Share2,
  SwitchCamera,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { loadGoogleMaps } from "../services/GoogleMapsLoader";
import { localDatabaseService } from "../services/LocalDatabaseService";
import { useAppStore } from "../store/useAppStore";
import { canvasToJpeg, drawSurveyStamp, formatCaptureTime } from "../utils/surveyPhotoStamp";
import { enterAppFullscreen, exitAppFullscreen } from "../utils/appFullscreen";
import { createSatelliteSnapshot, satelliteImageryAttribution } from "../utils/satelliteSnapshot";
import "./surveyCamera.css";

const CAMERA_CONSTRAINTS = {
  width: { ideal: 2560 },
  height: { ideal: 1440 },
};

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not supported on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 15_000,
    });
  });
}

async function resolveAddress(latitude, longitude) {
  try {
    const maps = await loadGoogleMaps();
    const results = await new Promise((resolve, reject) => {
      new maps.Geocoder().geocode(
        { location: { lat: latitude, lng: longitude } },
        (items, status) => status === "OK" ? resolve(items) : reject(new Error(status)),
      );
    });
    const first = results?.[0];
    const localityComponent = first?.address_components?.find((component) =>
      component.types.some((type) => ["neighborhood", "sublocality", "locality"].includes(type)));
    return {
      address: first?.formatted_address ?? "",
      locality: localityComponent?.long_name ?? "Survey location",
    };
  } catch {
    return { address: "GPS coordinates captured", locality: "Survey location" };
  }
}

function downloadPhoto(photo) {
  const url = URL.createObjectURL(photo.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = photo.fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

async function sharePhoto(photo) {
  const file = new File([photo.blob], photo.fileName, { type: photo.mimeType });
  if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
    downloadPhoto(photo);
    return "downloaded";
  }
  await navigator.share({
    files: [file],
    title: "PlotScale survey photo",
    text: photo.address || "GPS-tagged PlotScale survey photo",
  });
  return "shared";
}

function PhotoThumbnail({ photo, onDelete, onOpen, onShare }) {
  const url = useMemo(() => URL.createObjectURL(photo.blob), [photo.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <article className="survey-gallery-card">
      <button className="survey-gallery-card__image" type="button" onClick={() => onOpen(photo, url)}>
        <img src={url} alt={`Survey captured ${formatCaptureTime(photo.capturedAt)}`} />
      </button>
      <div className="survey-gallery-card__body">
        <strong>{photo.locality || "Survey location"}</strong>
        <small>{formatCaptureTime(photo.capturedAt)}</small>
        <small>{photo.latitude === null ? "Without GPS" : `${photo.latitude.toFixed(6)}, ${photo.longitude.toFixed(6)}`}</small>
        <div className="survey-gallery-card__actions">
          <button type="button" onClick={() => downloadPhoto(photo)}><Download size={15} /> Save</button>
          <button type="button" onClick={() => onShare(photo)}><Share2 size={15} /> Share</button>
          <button type="button" className="is-danger" onClick={() => onDelete(photo)}><Trash2 size={15} /> Delete</button>
        </div>
      </div>
    </article>
  );
}

function CaptureReview({ photo, onClose, onDownload, onShare }) {
  const url = useMemo(() => URL.createObjectURL(photo.blob), [photo.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <div className="survey-capture-review" role="dialog" aria-modal="true" aria-label="Photo saved">
      <div className="survey-capture-review__card">
        <header><span><Check size={19} /> Saved to Gallery</span><button type="button" onClick={onClose} aria-label="Close photo review"><X size={20} /></button></header>
        <img src={url} alt="Newly captured survey" />
        <div className="survey-capture-review__actions">
          <button type="button" className="is-primary" onClick={() => onShare(photo)}><Share2 size={18} /> Share to WhatsApp / apps</button>
          <button type="button" onClick={() => onDownload(photo)}><Download size={18} /> Save to device</button>
          <button type="button" onClick={onClose}><Camera size={18} /> Take another</button>
        </div>
      </div>
    </div>
  );
}

export function SurveyCameraPage() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const satelliteImageRef = useRef(null);
  const navigate = useNavigate();
  const user = useAppStore((state) => state.user);
  const ownerKey = user?.id ?? "guest";
  const [view, setView] = useState("camera");
  const [facingMode, setFacingMode] = useState("environment");
  const [cameraState, setCameraState] = useState("idle");
  const [locationState, setLocationState] = useState("idle");
  const [location, setLocation] = useState(null);
  const [satellitePreviewUrl, setSatellitePreviewUrl] = useState("");
  const [satelliteState, setSatelliteState] = useState("idle");
  const [photos, setPhotos] = useState([]);
  const [latestPhoto, setLatestPhoto] = useState(null);
  const [captureReview, setCaptureReview] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isImmersive, setIsImmersive] = useState(() => Boolean(
    document.fullscreenElement || document.webkitFullscreenElement,
  ));
  const [clock, setClock] = useState(() => new Date());

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState("idle");
  }, []);

  const startCamera = useCallback(async (requestedFacingMode = facingMode) => {
    enterAppFullscreen();
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot open a live camera. Use PlotScale over HTTPS on a supported phone browser.");
      return;
    }
    setError("");
    setNotice("");
    setCameraState("starting");
    streamRef.current?.getTracks().forEach((track) => track.stop());
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { ...CAMERA_CONSTRAINTS, facingMode: { ideal: requestedFacingMode } },
        });
      } catch (caught) {
        if (!["OverconstrainedError", "NotFoundError"].includes(caught.name)) throw caught;
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const actualFacing = stream.getVideoTracks()[0]?.getSettings?.().facingMode;
      setFacingMode(actualFacing === "user" ? "user" : requestedFacingMode);
      setCameraState("ready");
    } catch (caught) {
      setCameraState("error");
      if (caught.name === "NotAllowedError" || caught.name === "SecurityError") {
        setError("Camera permission was blocked. Allow camera access in browser settings, then try again.");
      } else {
        setError(caught.message || "The camera could not be opened.");
      }
    }
  }, [facingMode]);

  const refreshGallery = useCallback(async () => {
    try {
      setPhotos(await localDatabaseService.listSurveyPhotos(ownerKey));
    } catch (caught) {
      setError(caught.message);
    }
  }, [ownerKey]);

  useEffect(() => {
    refreshGallery();
  }, [refreshGallery]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const syncFullscreenState = () => {
      const active = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      setIsImmersive(active);
    };
    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("webkitfullscreenchange", syncFullscreenState);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("webkitfullscreenchange", syncFullscreenState);
    };
  }, []);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    exitAppFullscreen();
  }, []);

  const enableLocation = async () => {
    setError("");
    setLocationState("loading");
    try {
      const position = await getPosition();
      const base = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyM: position.coords.accuracy,
        altitudeM: position.coords.altitude,
      };
      satelliteImageRef.current = null;
      setSatellitePreviewUrl("");
      setSatelliteState("loading");
      setLocation({ ...base, address: "Resolving address…", locality: "Survey location" });
      setLocationState("ready");
      const [addressResult, satelliteResult] = await Promise.allSettled([
        resolveAddress(base.latitude, base.longitude),
        createSatelliteSnapshot(base.latitude, base.longitude),
      ]);
      const resolved = addressResult.status === "fulfilled"
        ? addressResult.value
        : { address: "GPS coordinates captured", locality: "Survey location" };
      setLocation({ ...base, ...resolved });
      if (satelliteResult.status === "fulfilled") {
        satelliteImageRef.current = satelliteResult.value.image;
        setSatellitePreviewUrl(satelliteResult.value.dataUrl);
        setSatelliteState("ready");
      } else {
        setSatelliteState("error");
      }
    } catch (caught) {
      setLocationState("error");
      setError(caught.code === 1
        ? "Location permission was blocked. The camera still works, but the photo will not contain GPS data."
        : caught.message || "Current location could not be read.");
    }
  };

  const switchCamera = async () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    await startCamera(next);
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || cameraState !== "ready" || !video.videoWidth || !video.videoHeight) return;
    setCameraState("capturing");
    setError("");
    try {
      const maximumEdge = 2560;
      const ratio = Math.min(1, maximumEdge / Math.max(video.videoWidth, video.videoHeight));
      const width = Math.round(video.videoWidth * ratio);
      const height = Math.round(video.videoHeight * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (facingMode === "user") {
        context.translate(width, 0);
        context.scale(-1, 1);
      }
      context.drawImage(video, 0, 0, width, height);
      if (facingMode === "user") context.setTransform(1, 0, 0, 1, 0, 0);
      const capturedAt = new Date();
      drawSurveyStamp(context, width, height, {
        ...location,
        capturedAt,
        satelliteImage: satelliteImageRef.current,
      });
      const blob = await canvasToJpeg(canvas);
      const photo = await localDatabaseService.saveSurveyPhoto({
        ownerKey,
        blob,
        capturedAt: capturedAt.toISOString(),
        facingMode,
        ...location,
      });
      setLatestPhoto(photo);
      setCaptureReview(photo);
      setPhotos((current) => [photo, ...current]);
      setNotice("Photo saved to PlotScale offline gallery.");
    } catch (caught) {
      setError(caught.message || "Photo could not be saved.");
    } finally {
      setCameraState("ready");
    }
  };

  const removePhoto = async (photo) => {
    if (!window.confirm("Delete this survey photo from this device?")) return;
    await localDatabaseService.deleteSurveyPhoto(photo.id);
    setPhotos((current) => current.filter((item) => item.id !== photo.id));
    if (latestPhoto?.id === photo.id) setLatestPhoto(null);
  };

  const handleShare = async (photo) => {
    try {
      const result = await sharePhoto(photo);
      setNotice(result === "shared"
        ? "The device share sheet was opened. Choose WhatsApp or another app."
        : "File sharing is unavailable in this browser, so the JPG was downloaded instead.");
    } catch (caught) {
      if (caught.name !== "AbortError") setError(caught.message || "The photo could not be shared.");
    }
  };

  const showCamera = () => {
    setView("camera");
    setLightbox(null);
  };

  const showGallery = () => {
    stopCamera();
    setView("gallery");
    setLightbox(null);
    refreshGallery();
  };

  const leaveCamera = async () => {
    stopCamera();
    setIsImmersive(false);
    await exitAppFullscreen();
    navigate("/dashboard");
  };

  const toggleFullscreen = async () => {
    if (isImmersive) {
      setIsImmersive(false);
      await exitAppFullscreen();
      return;
    }
    setIsImmersive(true);
    const opened = await enterAppFullscreen();
    if (!opened) {
      setNotice("Camera view expanded. This browser may keep its address bar visible; install PlotScale to the Home Screen to hide browser controls too.");
    }
  };

  return (
    <main className={`survey-camera-page ${view === "camera" ? "survey-camera-page--camera" : ""} ${isImmersive ? "is-immersive" : ""}`}>
      <header className="survey-camera-header">
        <button className="icon-button" type="button" onClick={leaveCamera} aria-label="Back to dashboard"><ArrowLeft size={19} /></button>
        <Brand compact />
        {view === "camera" ? (
          <button className="survey-fullscreen-button" type="button" onClick={toggleFullscreen} aria-label={isImmersive ? "Exit full screen" : "Open camera full screen"}>
            {isImmersive ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            <span>{isImmersive ? "Exit" : "Full screen"}</span>
          </button>
        ) : (
          <span className="calculator-header__chip"><Camera size={14} /> Survey Camera</span>
        )}
      </header>

      <section className="survey-camera-intro">
        <div>
          <span className="status-pill"><Camera size={15} /> Offline-first evidence photos</span>
          <h1>GPS Survey Camera</h1>
          <p>Capture from the front or rear camera with date, coordinates, accuracy and a position stamp.</p>
        </div>
        <nav className="survey-camera-tabs" aria-label="Survey camera sections">
          <button type="button" className={view === "camera" ? "is-active" : ""} onClick={showCamera}><Camera size={17} /> Camera</button>
          <button type="button" className={view === "gallery" ? "is-active" : ""} onClick={showGallery}><Images size={17} /> Gallery <span>{photos.length}</span></button>
        </nav>
      </section>

      {error && <div className="survey-camera-message is-error"><X size={17} /> <span>{error}</span></div>}
      {notice && <div className="survey-camera-message is-success"><Check size={17} /> <span>{notice}</span></div>}

      {view === "camera" ? (
        <section className="survey-camera-workspace">
          <div className={`survey-viewfinder ${facingMode === "user" ? "is-front" : ""}`}>
            <video ref={videoRef} muted playsInline autoPlay aria-label="Live camera preview" />
            {isImmersive && (
              <button className="survey-immersive-exit" type="button" onClick={toggleFullscreen} aria-label="Exit clean full-screen camera">
                <Minimize2 size={22} />
              </button>
            )}
            {cameraState !== "ready" && cameraState !== "capturing" && (
              <div className="survey-viewfinder__empty">
                <Camera size={42} />
                <strong>{cameraState === "starting" ? "Opening camera…" : "Camera is off"}</strong>
                <p>Camera access begins only after you press the button.</p>
                <button type="button" onClick={() => startCamera()} disabled={cameraState === "starting"}>
                  <Camera size={18} /> Start camera
                </button>
              </div>
            )}

            <div className="survey-viewfinder__topbar">
              <span>{clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              <span>{facingMode === "user" ? "Front camera" : "Rear camera"}</span>
            </div>

            <div className="survey-live-stamp">
              <div>
                <strong><MapPin size={15} /> {location?.locality || "Location not enabled"}</strong>
                <span>{location?.address || "Enable GPS to add position details"}</span>
                {location && <code>{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)} · ±{Math.round(location.accuracyM)} m</code>}
                <small>{formatCaptureTime(clock)}</small>
              </div>
              <span className={`survey-position-tile is-${satelliteState}`} aria-label="Satellite map position preview">
                {satellitePreviewUrl ? <img src={satellitePreviewUrl} alt="Current GPS position in satellite view" /> : <small>{satelliteState === "loading" ? "Loading satellite…" : "Enable GPS"}</small>}
                <MapPin className="survey-position-tile__pin" size={27} />
                {satellitePreviewUrl && <em>Esri</em>}
              </span>
            </div>

            <div className="survey-viewfinder__controls">
              <button type="button" className={location ? "is-enabled" : ""} onClick={enableLocation} disabled={locationState === "loading"} aria-label="Enable or refresh GPS location">
                {locationState === "loading" ? <RefreshCw className="is-spinning" size={21} /> : <LocateFixed size={21} />}
              </button>
              <button type="button" className="survey-shutter" onClick={capturePhoto} disabled={cameraState !== "ready"} aria-label="Take photo"><span /></button>
              <button type="button" onClick={switchCamera} disabled={!['ready', 'idle'].includes(cameraState)} aria-label="Switch front or rear camera"><SwitchCamera size={23} /></button>
            </div>
          </div>

          <aside className="survey-camera-sidepanel">
            <h2>Capture details</h2>
            <div className="survey-detail-row"><Camera size={18} /><span><strong>{facingMode === "user" ? "Front camera" : "Rear camera"}</strong><small>Tap switch to change camera</small></span></div>
            <div className="survey-detail-row"><Navigation size={18} /><span><strong>{location ? "GPS ready" : "GPS optional"}</strong><small>{location ? `Accuracy ±${Math.round(location.accuracyM)} m` : "Enable it before capture for a location stamp"}</small></span></div>
            <p className="survey-privacy-note">Photos stay in IndexedDB on this device and are never uploaded automatically. When GPS is enabled, Google resolves the address and nearby imagery tiles are requested from Esri; the photo itself is not sent.<br />{satelliteImageryAttribution}.</p>
            {latestPhoto && (
              <div className="survey-latest">
                <strong>Latest photo saved</strong>
                <button type="button" onClick={() => handleShare(latestPhoto)}><Share2 size={16} /> Share / save to device</button>
                <button type="button" onClick={() => downloadPhoto(latestPhoto)}><Download size={16} /> Download JPG</button>
              </div>
            )}
          </aside>
        </section>
      ) : (
        <section className="survey-gallery" aria-label="Survey photo gallery">
          <header>
            <div><h2>Offline photo gallery</h2><p>{photos.length} photo{photos.length === 1 ? "" : "s"} stored on this device</p></div>
            <button type="button" className="primary-button" onClick={showCamera}><Camera size={17} /> Take photo</button>
          </header>
          {photos.length ? (
            <div className="survey-gallery-grid">
              {photos.map((photo) => <PhotoThumbnail key={photo.id} photo={photo} onDelete={removePhoto} onShare={handleShare} onOpen={(item, url) => setLightbox({ item, url })} />)}
            </div>
          ) : (
            <div className="survey-gallery-empty"><Images size={42} /><h2>No survey photos yet</h2><p>Captured photos will appear here and remain available offline.</p><button type="button" onClick={showCamera}><Camera size={17} /> Open camera</button></div>
          )}
        </section>
      )}

      {lightbox && (
        <div className="survey-lightbox" role="dialog" aria-modal="true" aria-label="Survey photo preview">
          <button type="button" className="survey-lightbox__close" onClick={() => setLightbox(null)} aria-label="Close photo"><X size={22} /></button>
          <img src={lightbox.url} alt="Full survey capture" />
          <footer>
            <span>{lightbox.item.address || lightbox.item.locality}</span>
          <button type="button" onClick={() => handleShare(lightbox.item)}><Share2 size={16} /> Share</button>
            <button type="button" onClick={() => downloadPhoto(lightbox.item)}><Download size={16} /> Save</button>
          </footer>
        </div>
      )}
      {captureReview && (
        <CaptureReview
          photo={captureReview}
          onClose={() => setCaptureReview(null)}
          onDownload={downloadPhoto}
          onShare={handleShare}
        />
      )}
    </main>
  );
}
