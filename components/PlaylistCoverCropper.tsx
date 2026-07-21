"use client";

import { useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Check, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import { BrutalButton } from "@/components/BrutalButton";
import { notify } from "@/lib/utils";

const outputSize = 512;
const minZoom = 1;
const maxZoom = 4;
const zoomStep = 0.1;

export type PlaylistCoverCropSource = {
  fileName: string;
  height: number;
  url: string;
  width: number;
};

type PlaylistCoverCropperProps = {
  source: PlaylistCoverCropSource;
  onApply: (file: File, previewUrl: string) => void;
  onCancel: () => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = document.createElement("img");
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded."));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Cover could not be created."))),
      "image/jpeg",
      0.88,
    );
  });
}

export function PlaylistCoverCropper({
  source,
  onApply,
  onCancel,
}: PlaylistCoverCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(minZoom);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [applying, setApplying] = useState(false);

  const changeZoom = (nextZoom: number) => {
    setZoom(clamp(Number(nextZoom.toFixed(2)), minZoom, maxZoom));
  };

  const resetCrop = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(minZoom);
  };

  const applyCrop = async () => {
    if (!croppedAreaPixels) {
      notify("Move the image before applying the cover.");
      return;
    }

    try {
      setApplying(true);
      const image = await loadImage(source.url);
      const canvas = document.createElement("canvas");
      canvas.width = outputSize;
      canvas.height = outputSize;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Browser cannot process this image.");

      context.fillStyle = "#211719";
      context.fillRect(0, 0, outputSize, outputSize);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        outputSize,
        outputSize,
      );

      const blob = await canvasToBlob(canvas);
      const baseName = source.fileName.replace(/\.[^.]+$/, "").slice(0, 60) || "playlist-cover";
      const file = new File([blob], `${baseName}-cropped.jpg`, { type: "image/jpeg" });
      const previewUrl = canvas.toDataURL("image/jpeg", 0.88);
      setApplying(false);
      onApply(file, previewUrl);
    } catch (error) {
      setApplying(false);
      notify(error instanceof Error ? error.message : "Cover could not be created.");
    }
  };

  return (
    <section className="playlist-cover-cropper" aria-labelledby="playlist-cover-crop-title">
      <header className="playlist-cover-crop-header">
        <h3 id="playlist-cover-crop-title">Crop cover</h3>
        <button
          type="button"
          aria-label="Reset crop"
          onClick={resetCrop}
          className="playlist-cover-crop-icon"
        >
          <RotateCcw size={18} />
        </button>
      </header>

      <div className="playlist-cover-crop-stage">
        <Cropper
          image={source.url}
          crop={crop}
          zoom={zoom}
          minZoom={minZoom}
          maxZoom={maxZoom}
          zoomSpeed={0.25}
          aspect={1}
          cropShape="rect"
          objectFit="cover"
          showGrid
          restrictPosition
          zoomWithScroll
          keyboardStep={8}
          disableAutomaticStylesInjection
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_croppedArea, pixels) => setCroppedAreaPixels(pixels)}
          classes={{
            containerClassName: "playlist-cover-crop-engine",
            mediaClassName: "playlist-cover-crop-media",
            cropAreaClassName: "playlist-cover-crop-window",
          }}
          mediaProps={{ alt: "Playlist cover to crop" }}
          cropperProps={{ "aria-label": "Position playlist cover" }}
        />
      </div>

      <div className="playlist-cover-crop-controls">
        <button
          type="button"
          aria-label="Zoom out"
          disabled={zoom <= minZoom}
          onClick={() => changeZoom(zoom - zoomStep)}
          className="playlist-cover-crop-icon"
        >
          <ZoomOut size={19} />
        </button>
        <label className="playlist-cover-zoom-control">
          <span>Zoom {zoom.toFixed(1)}x</span>
          <input
            type="range"
            min={minZoom}
            max={maxZoom}
            step={zoomStep}
            value={zoom}
            onChange={(event) => changeZoom(Number(event.target.value))}
          />
        </label>
        <button
          type="button"
          aria-label="Zoom in"
          disabled={zoom >= maxZoom}
          onClick={() => changeZoom(zoom + zoomStep)}
          className="playlist-cover-crop-icon"
        >
          <ZoomIn size={19} />
        </button>
      </div>

      <div className="playlist-cover-crop-actions">
        <BrutalButton tone="white" icon={<X size={17} />} onClick={onCancel}>
          Cancel
        </BrutalButton>
        <BrutalButton
          tone="green"
          icon={<Check size={17} />}
          disabled={applying || !croppedAreaPixels}
          onClick={() => void applyCrop()}
        >
          {applying ? "Applying..." : "Use cover"}
        </BrutalButton>
      </div>
    </section>
  );
}
