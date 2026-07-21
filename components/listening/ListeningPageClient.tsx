"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Check,
  Clock3,
  Copy,
  Crown,
  Headphones,
  Link2,
  LogOut,
  Radio,
  RefreshCw,
  Share2,
  UsersRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { BrutalButton } from "@/components/BrutalButton";
import { PlaybackControls } from "@/components/music/PlaybackControls";
import { createListeningSnapshot } from "@/lib/listening/snapshot";
import { formatTime, notify } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useListeningStore } from "@/store/listeningStore";
import { usePlayerStore } from "@/store/playerStore";

const connectionLabels = {
  idle: "No active room",
  connecting: "Connecting",
  connected: "Live",
  reconnecting: "Reconnecting",
  error: "Connection issue",
} as const;

export function ListeningPageClient({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const user = useAuthStore((state) => state.user);
  const room = useListeningStore((state) => state.room);
  const role = useListeningStore((state) => state.role);
  const loading = useListeningStore((state) => state.loading);
  const pendingAction = useListeningStore((state) => state.pendingAction);
  const error = useListeningStore((state) => state.error);
  const connectionStatus = useListeningStore((state) => state.connectionStatus);
  const createRoom = useListeningStore((state) => state.createRoom);
  const joinRoom = useListeningStore((state) => state.joinRoom);
  const leaveRoom = useListeningStore((state) => state.leaveRoom);
  const restoreRoom = useListeningStore((state) => state.restoreRoom);
  const currentSong = usePlayerStore((state) => state.currentSong);
  const progressMs = usePlayerStore((state) => state.progressMs);
  const durationMs = usePlayerStore((state) => state.durationMs);
  const isPreview = user?.id === "local-preview";
  const connectionLabel = isPreview ? "Preview mode" : connectionLabels[connectionStatus];
  const onlineMembers = useMemo(
    () => room?.members.filter((member) => member.online) ?? [],
    [room?.members],
  );

  const shareRoom = async () => {
    if (!room) return;
    const url = `${window.location.origin}/listen?code=${room.code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Listen with me on Maiabeat", url });
      } else {
        await navigator.clipboard.writeText(url);
        notify("Room link copied");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      notify("Could not share room link");
    }
  };

  const copyCode = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      notify("Room code copied");
    } catch {
      notify("Could not copy room code");
    }
  };

  return (
    <AuthGuard>
      <AppShell>
        <div className="listening-page">
          <header className="listening-title-row">
            <div className="min-w-0">
              <p className="page-kicker">Live session</p>
              <h1 className="page-title">Listening Together</h1>
            </div>
            <div
              className="listening-connection"
              data-status={connectionStatus}
              aria-live="polite"
            >
              {connectionStatus === "connected" && !isPreview ? (
                <Wifi size={17} />
              ) : (
                <WifiOff size={17} />
              )}
              {connectionLabel}
            </div>
          </header>

          {!room ? (
            <div className="listening-lobby-grid">
              <section className="listening-lobby-band listening-lobby-create">
                <Radio size={34} />
                <div>
                  <h2 className="section-title">Start a room</h2>
                  <p className="listening-supporting-copy">
                    Your current song and queue become the shared session.
                  </p>
                </div>
                <BrutalButton
                  tone="green"
                  icon={<Headphones size={18} />}
                  disabled={loading || isPreview}
                  onClick={async () => {
                    const created = await createRoom(
                      createListeningSnapshot(usePlayerStore.getState()),
                    );
                    if (created) notify(`Room ${created.code} is live`);
                  }}
                >
                  {pendingAction === "create" ? "Starting..." : "Start room"}
                </BrutalButton>
              </section>

              <section className="listening-lobby-band listening-lobby-join">
                <Link2 size={34} />
                <div>
                  <h2 className="section-title">Join a room</h2>
                  <p className="listening-supporting-copy">
                    Enter the six-character code shared by the host.
                  </p>
                </div>
                <label className="listening-code-field">
                  <span>Room code</span>
                  <input
                    value={code}
                    maxLength={6}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="ABC234"
                    onChange={(event) =>
                      setCode(
                        event.target.value
                          .toUpperCase()
                          .replace(/[^A-HJ-NP-Z2-9]/g, "")
                          .slice(0, 6),
                      )
                    }
                  />
                </label>
                <BrutalButton
                  tone="cyan"
                  icon={<UsersRound size={18} />}
                  disabled={loading || code.length !== 6 || isPreview}
                  onClick={async () => {
                    const joined = await joinRoom(code);
                    if (joined) notify(`Joined ${joined.code}`);
                  }}
                >
                  {pendingAction === "join" ? "Joining..." : "Join room"}
                </BrutalButton>
              </section>
            </div>
          ) : (
            <>
              <section className="listening-room-band listening-room-summary">
                <div className="listening-room-code-block">
                  <span>Room code</span>
                  <strong>{room.code}</strong>
                </div>
                <div className="listening-room-actions">
                  <button type="button" aria-label="Copy room code" title="Copy room code" onClick={copyCode}>
                    <Copy size={19} />
                  </button>
                  <button type="button" aria-label="Share listening room" title="Share room" onClick={shareRoom}>
                    <Share2 size={19} />
                  </button>
                  <button
                    type="button"
                    aria-label="Refresh listening room"
                    title="Refresh room"
                    onClick={() => void restoreRoom(room.id)}
                  >
                    <RefreshCw size={19} />
                  </button>
                </div>
                <div className="listening-room-role">
                  {role === "host" ? <Crown size={18} /> : <Headphones size={18} />}
                  {role === "host" ? "Host" : "Listening with host"}
                </div>
              </section>

              <div className="listening-session-grid">
                <section className="listening-room-band listening-now-playing">
                  <div className="listening-band-heading">
                    <div>
                      <p className="page-kicker">Synchronized playback</p>
                      <h2 className="section-title">Now Playing</h2>
                    </div>
                    {role === "listener" ? (
                      <span className="listening-synced-label"><Check size={15} /> Host controlled</span>
                    ) : null}
                  </div>

                  {currentSong ? (
                    <div className="listening-track">
                      <Image
                        src={currentSong.coverUrl || "/icons/default-cover.svg"}
                        alt=""
                        width={112}
                        height={112}
                        sizes="112px"
                      />
                      <div className="min-w-0">
                        <p className="text-ellipsis card-title">{currentSong.title}</p>
                        <p className="text-ellipsis font-bold">{currentSong.artist}</p>
                        <p className="listening-track-time">
                          <Clock3 size={15} /> {formatTime(progressMs / 1000)} / {formatTime((durationMs || currentSong.durationMs) / 1000)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="listening-empty-track">
                      <Headphones size={30} />
                      <p>{role === "host" ? "Pick a song to begin the session." : "Waiting for the host to pick a song."}</p>
                      {role === "host" ? <Link href="/search">Find music</Link> : null}
                    </div>
                  )}

                  <PlaybackControls />
                </section>

                <section className="listening-room-band listening-members" aria-labelledby="room-members-title">
                  <div className="listening-band-heading">
                    <div>
                      <p className="page-kicker">In this room</p>
                      <h2 id="room-members-title" className="section-title">Listeners</h2>
                    </div>
                    <span className="listening-member-count">{onlineMembers.length}</span>
                  </div>
                  <div className="listening-member-list">
                    {room.members.map((member) => (
                      <article key={member.userId} className="listening-member" data-online={member.online}>
                        <span className="listening-member-avatar" aria-hidden="true">
                          {member.displayName.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="text-ellipsis font-black">{member.displayName}</p>
                          <p>{member.role === "host" ? "Host" : member.online ? "Listening" : "Away"}</p>
                        </div>
                        {member.role === "host" ? <Crown size={18} /> : <span className="listening-presence-dot" />}
                      </article>
                    ))}
                  </div>
                </section>
              </div>

              <section className="listening-room-footer">
                <p>
                  {role === "host"
                    ? "Ending the room stops synchronization for everyone."
                    : "Leaving keeps your local player available."}
                </p>
                <BrutalButton
                  tone="pink"
                  icon={<LogOut size={18} />}
                  disabled={loading}
                  onClick={async () => {
                    const left = await leaveRoom();
                    if (left) notify(role === "host" ? "Room ended" : "Left the room");
                  }}
                >
                  {pendingAction === "leave" ? "Leaving..." : role === "host" ? "End room" : "Leave room"}
                </BrutalButton>
              </section>
            </>
          )}

          {isPreview ? (
            <div className="listening-message listening-preview-message">
              <span>Use a real account to create or join live rooms.</span>
              <Link href="/reset-preview">Sign in</Link>
            </div>
          ) : null}
          {error ? <p className="listening-message listening-message-error" role="alert">{error}</p> : null}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
