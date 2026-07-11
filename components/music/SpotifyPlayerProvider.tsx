"use client";

import { useEffect, useRef } from "react";
import { notify } from "@/lib/utils";
import { usePlayerStore } from "@/store/playerStore";

let sdkScriptPromise: Promise<void> | null = null;
let playerSingleton: InstanceType<NonNullable<typeof window.Spotify>["Player"]> | null =
  null;
let setupStarted = false;
let transferErrorShown = false;

function loadSpotifySdk() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Spotify) return Promise.resolve();
  if (sdkScriptPromise) return sdkScriptPromise;

  sdkScriptPromise = new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://sdk.scdn.co/spotify-player.js"]',
    );
    if (existing) return;

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.onerror = () => reject(new Error("Could not load Spotify SDK."));
    document.body.appendChild(script);
  });

  return sdkScriptPromise;
}

export function SpotifyPlayerProvider({ children }: { children: React.ReactNode }) {
  const lastAutoNextTrackRef = useRef<string | null>(null);
  const setSdkReady = usePlayerStore((state) => state.setSdkReady);
  const setDeviceId = usePlayerStore((state) => state.setDeviceId);
  const syncFromSdkState = usePlayerStore((state) => state.syncFromSdkState);

  useEffect(() => {
    async function setup() {
      try {
        await loadSpotifySdk();
        if (!window.Spotify || playerSingleton || setupStarted) return;
        setupStarted = true;

        const player = new window.Spotify.Player({
          name: "Maiabeat Player",
          getOAuthToken: async (callback) => {
            const response = await fetch("/api/spotify/token");
            const data = (await response.json()) as { access_token?: string; error?: string };
            if (!response.ok || !data.access_token) {
              notify(data.error ?? "Connect Spotify from Profile first.");
              return;
            }
            callback(data.access_token);
          },
          volume: 0.8,
        });

        player.addListener("ready", async (payload) => {
          const { device_id } = payload as Spotify.ReadyEvent;
          setSdkReady(true);
          setDeviceId(device_id);
          notify("Maiabeat Spotify device is ready.");
          const transferResponse = await fetch("/api/spotify/transfer", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ device_id }),
          }).catch(() => null);

          if (transferResponse && !transferResponse.ok && !transferErrorShown) {
            transferErrorShown = true;
            const data = (await transferResponse.json().catch(() => ({}))) as {
              error?: string;
            };
            if (data.error?.toLowerCase().includes("premium")) notify(data.error);
          }
        });

        player.addListener("not_ready", () => {
          setSdkReady(false);
          notify("Spotify device went offline.");
        });

        player.addListener("initialization_error", (payload) => {
          const { message } = payload as Spotify.Error;
          notify(message);
        });

        player.addListener("authentication_error", () => {
          notify("Reconnect Spotify from Profile.");
        });

        player.addListener("account_error", () => {
          notify("Spotify Premium is required to play full tracks in Maiabeat.");
        });

        player.addListener("playback_error", (payload) => {
          const { message } = payload as Spotify.Error;
          notify(message || "Spotify playback error.");
        });

        player.addListener("player_state_changed", (payload) => {
          syncFromSdkState(payload as Spotify.PlaybackState | null);
        });

        playerSingleton = player;
        window.maiabeatActivateSpotifyPlayer = () => player.activateElement();
        const connected = await player.connect();
        setSdkReady(connected);
      } catch {
        setupStarted = false;
        setSdkReady(false);
      }
    }

    void setup();
  }, [setDeviceId, setSdkReady, syncFromSdkState]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const state = usePlayerStore.getState();
      if (!state.isPlaying || !state.currentSong) return;

      const nextProgress = Math.min(state.progressMs + 1000, state.durationMs);
      state.setCurrentTime(Math.round(nextProgress / 1000));

      const trackId = state.currentSong.spotifyTrackId;
      const shouldAutoNext =
        state.durationMs > 0 &&
        state.durationMs - nextProgress <= 1200 &&
        lastAutoNextTrackRef.current !== trackId;

      if (shouldAutoNext) {
        lastAutoNextTrackRef.current = trackId;
        void state.next();
      }

      if (lastAutoNextTrackRef.current && lastAutoNextTrackRef.current !== trackId) {
        lastAutoNextTrackRef.current = null;
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  return <>{children}</>;
}
