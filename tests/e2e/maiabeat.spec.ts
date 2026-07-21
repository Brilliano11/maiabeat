import { expect, test } from "@playwright/test";

test("login page renders without embedded credentials", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Maiabeat" })).toBeVisible();
  await expect(page.getByPlaceholder("Email")).toHaveValue("");
  await expect(page.getByPlaceholder("Password")).toHaveValue("");
});

test("protected page redirects anonymous users to login", async ({ page }) => {
  await page.goto("/home");

  await expect(page).toHaveURL(/\/login\?next=%2Fhome$/);
  await expect(page.getByRole("heading", { name: "Maiabeat" })).toBeVisible();

  await page.goto("/listen");
  await expect(page).toHaveURL(/\/login\?next=%2Flisten$/);
});

test("responses include production security headers", async ({ request }) => {
  const response = await request.get("/login");
  const headers = response.headers();
  const csp = headers["content-security-policy"];

  expect(response.ok()).toBe(true);
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["x-powered-by"]).toBeUndefined();
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("https://sdk.scdn.co");
});

test("app icon metadata and PWA manifest use the Maiabeat logo", async ({
  page,
  request,
}) => {
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = (await manifestResponse.json()) as {
    icons?: Array<{ src?: string; purpose?: string }>;
  };
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ src: "/icons/icon-192.png", purpose: "any" }),
      expect.objectContaining({ src: "/icons/icon-512.png", purpose: "any" }),
      expect.objectContaining({
        src: "/icons/icon-maskable-512.png",
        purpose: "maskable",
      }),
    ]),
  );

  for (const path of [
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/icons/icon-maskable-512.png",
  ]) {
    const response = await request.get(path);
    expect(response.ok(), path).toBe(true);
    expect(response.headers()["content-type"], path).toContain("image/png");
  }

  await page.goto("/login");
  await expect(page.locator('link[rel="icon"][href^="/icon.png"]')).toHaveCount(1);
  await expect(
    page.locator('link[rel="apple-touch-icon"][href^="/apple-icon.png"]'),
  ).toHaveCount(1);
});

test("playlist cover upload requires authentication", async ({ request }) => {
  const response = await request.post("/api/library/playlists/test-playlist/cover");

  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toMatchObject({ error: "Login required." });
});

test("Spotify callback rejects invalid state without exposing internal messages", async ({
  request,
}) => {
  const response = await request.get(
    "/api/spotify/callback?code=invalid-code&state=invalid-state",
    { maxRedirects: 0 },
  );
  const location = response.headers().location;

  expect(response.status()).toBe(307);
  expect(location).toContain("/profile?spotify=state_error");
  expect(location).not.toContain("message=");
});

test("selected song survives navigation when the server queue is stale", async ({ page }) => {
  let persistedTrackId: string | null = null;
  let persistedQueue: string[] = [];
  const hindia = {
    id: "hindia-old",
    spotifyTrackId: "hindia-old",
    spotifyUri: "spotify:track:hindia-old",
    title: "Everything U Are",
    artist: "Hindia",
    coverUrl: "/icons/default-cover.svg",
    durationMs: 175000,
  };
  const davd = {
    id: "davd-selected",
    spotifyTrackId: "davd-selected",
    spotifyUri: "spotify:track:davd-selected",
    title: "DAVD Song",
    artist: "DAVD",
    coverUrl: "/icons/default-cover.svg",
    durationMs: 182000,
  };
  let serverQueue = [{ id: "stale-hindia", song: hindia, position: 0 }];
  let serverPlayerState: Record<string, unknown> | null = null;

  await page.route("**/api/library", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        likedSongs: [davd, hindia],
        playlists: [],
        recentlyPlayed: [],
        playlistSongs: [],
        queue: serverQueue,
        playerState: serverPlayerState,
      }),
    });
  });
  await page.route("**/api/library/queue", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON() as {
        currentTrackId?: string | null;
        songs?: Array<typeof hindia>;
      };
      persistedTrackId = body.currentTrackId ?? null;
      persistedQueue = (body.songs ?? []).map((song) => song.spotifyTrackId);
      serverQueue = (body.songs ?? []).map((song, position) => ({
        id: `server-${song.spotifyTrackId}-${position}`,
        song,
        position,
      }));
      serverPlayerState = {
        currentSong: (body.songs ?? []).find(
          (song) => song.spotifyTrackId === body.currentTrackId,
        ) ?? null,
        currentIndex: 0,
        isPlaying: false,
        progressMs: 0,
        shuffleEnabled: false,
        repeatMode: "off",
      };
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/preview");
  await expect(page).toHaveURL(/\/home$/);
  await page.evaluate(() => {
    window.localStorage.setItem(
      "maiabeat-auth",
      JSON.stringify({
        state: {
          user: {
            id: "playback-regression-user",
            email: "playback@example.com",
            displayName: "Playback QA",
          },
          loading: false,
          hydrated: true,
          error: null,
        },
        version: 0,
      }),
    );
  });

  await page.reload();
  await page.getByRole("button", { name: "Play DAVD Song" }).click();
  await page.getByRole("link", { name: "Player" }).first().click();

  await expect(page.getByRole("heading", { name: "DAVD Song" })).toBeVisible();
  await expect(page.locator("main")).toContainText("DAVD");
  await expect(page.locator("main")).toContainText("Everything U Are");
  await expect.poll(() => persistedTrackId).toBe("davd-selected");
  expect(persistedQueue).toEqual(["davd-selected", "hindia-old"]);

  await page.reload();
  await expect(page.getByRole("heading", { name: "DAVD Song" })).toBeVisible();
  await expect(page.locator("main")).toContainText("Everything U Are");
});

test("Spotify SDK track changes synchronize metadata and upcoming queue", async ({ page }) => {
  let persistedQueue: string[] = [];
  let externalPlaybackState: Record<string, unknown> | null = null;

  await page.addInitScript(() => {
    const listeners: Record<string, (payload: unknown) => void> = {};
    class MockSpotifyPlayer {
      addListener(event: string, callback: (payload: unknown) => void) {
        listeners[event] = callback;
        if (event === "player_state_changed") sdkWindow.spotifyStateListenerReady = true;
      }
      async connect() {
        window.setTimeout(() => listeners.ready?.({ device_id: "sdk-device" }), 0);
        return true;
      }
      disconnect() {}
      async activateElement() {}
      async pause() {}
      async resume() {}
      async setVolume() {}
    }

    const sdkWindow = window as unknown as {
      Spotify: { Player: typeof MockSpotifyPlayer };
      emitSpotifyState: (state: unknown) => void;
      spotifyStateListenerReady: boolean;
    };
    sdkWindow.Spotify = { Player: MockSpotifyPlayer };
    sdkWindow.spotifyStateListenerReady = false;
    sdkWindow.emitSpotifyState = (state) => listeners.player_state_changed?.(state);
  });

  const hindia = {
    id: "hindia-sdk-old",
    spotifyTrackId: "hindia-sdk-old",
    spotifyUri: "spotify:track:hindia-sdk-old",
    title: "Everything U Are",
    artist: "Hindia",
    coverUrl: "/icons/default-cover.svg",
    durationMs: 175000,
  };

  await page.route("**/api/library", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        likedSongs: [],
        playlists: [],
        recentlyPlayed: [],
        playlistSongs: [],
        queue: [{ id: "hindia-sdk-queue", song: hindia, position: 0 }],
        playerState: {
          currentSong: hindia,
          currentIndex: 0,
          isPlaying: false,
          progressMs: 0,
          shuffleEnabled: false,
          repeatMode: "off",
        },
      }),
    });
  });
  await page.route("**/api/library/queue", async (route) => {
    const body = route.request().postDataJSON() as {
      songs?: Array<{ spotifyTrackId: string }>;
    };
    persistedQueue = (body.songs ?? []).map((song) => song.spotifyTrackId);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.route("**/api/spotify/transfer", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.route("**/api/spotify/playback-state", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ state: externalPlaybackState }),
    });
  });

  await page.goto("/preview");
  await expect(page).toHaveURL(/\/home$/);
  await page.evaluate(() => {
    window.localStorage.setItem(
      "maiabeat-auth",
      JSON.stringify({
        state: {
          user: {
            id: "sdk-sync-user",
            email: "sdk@example.com",
            displayName: "SDK QA",
          },
          loading: false,
          hydrated: true,
          error: null,
        },
        version: 0,
      }),
    );
  });
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { spotifyStateListenerReady?: boolean })
          .spotifyStateListenerReady,
      ),
    )
    .toBe(true);

  await page.evaluate(() => {
    const sdkWindow = window as unknown as { emitSpotifyState: (state: unknown) => void };
    sdkWindow.emitSpotifyState({
      paused: false,
      position: 12000,
      duration: 182000,
      track_window: {
        current_track: {
          id: "davd-sdk",
          uri: "spotify:track:davd-sdk",
          name: "Here With Me",
          duration_ms: 182000,
          artists: [{ name: "d4vd" }],
          album: { name: "Petals to Thorns", images: [{ url: "/icons/cover-cyan.svg" }] },
        },
        next_tracks: [
          {
            id: "tarot-sdk",
            uri: "spotify:track:tarot-sdk",
            name: "Tarot",
            duration_ms: 205000,
            artists: [{ name: ".Feast" }],
            album: { name: "Membangun & Menghancurkan", images: [] },
          },
        ],
      },
    });
  });

  await expect(page.getByRole("link", { name: "Here With Me d4vd" })).toBeVisible();
  await page.getByRole("link", { name: "Player" }).first().click();
  await expect(page.getByRole("heading", { name: "Here With Me" })).toBeVisible();
  await expect(page.locator("main")).toContainText("d4vd");
  await expect(page.locator("main")).toContainText("Tarot");
  await expect.poll(() => persistedQueue).toEqual(["davd-sdk", "tarot-sdk"]);

  externalPlaybackState = {
    is_playing: true,
    progress_ms: 24000,
    device: { id: "phone-device" },
    item: {
      id: "niki-external",
      uri: "spotify:track:niki-external",
      name: "Backburner",
      duration_ms: 236000,
      artists: [{ name: "NIKI" }],
      album: { name: "Nicole", images: [{ url: "/icons/cover-pink.svg" }] },
    },
  };
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

  await expect(page.getByRole("heading", { name: "Backburner" })).toBeVisible();
  await expect(page.locator("main")).toContainText("NIKI");
  await expect.poll(() => persistedQueue).toEqual(["niki-external"]);
});

test("login succeeds when test credentials are provided", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  test.skip(!email || !password, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run real login.");

  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email!);
  await page.getByPlaceholder("Password").fill(password!);
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { name: "Maiabeat hits different." })).toBeVisible();
});

test("preview search supports results and recent searches", async ({ page }) => {
  await page.goto("/preview");
  await expect(page).toHaveURL(/\/home$/);

  await page.getByRole("link", { name: "Search" }).first().click();
  const searchInput = page.locator('main input[placeholder="Cari lagu, artis, album, atau playlist."]');
  await searchInput.fill("Sunset");

  await expect(page.locator("main")).toContainText("Sunset Drive");

  await page.locator("main").getByRole("button", { name: "Clear search" }).click();
  await searchInput.focus();
  await expect(page.getByText("Pencarian terakhir")).toBeVisible();
  await expect(page.getByText("Sunset")).toBeVisible();
});

test("search filters sort and filter preview results", async ({ page }) => {
  await page.goto("/preview");
  await expect(page).toHaveURL(/\/home$/);

  await page.getByRole("link", { name: "Search" }).first().click();
  const searchInput = page.locator('main input[placeholder="Cari lagu, artis, album, atau playlist."]');
  await searchInput.fill("e");
  await expect(page.locator("main")).toContainText("Sunset Drive");

  await page.getByRole("button", { name: "Filters" }).click();
  await page.getByLabel("Sort").selectOption("Name");
  await expect(page.locator(".search-results").first().locator(".card-title").first()).toHaveText(
    "Coffee & Rain",
  );

  await page.getByLabel("Song length").selectOption("Short");
  await expect(page.getByText(/Tidak ada hasil untuk/)).toBeVisible();

  await page.getByRole("button", { name: "Reset search filters" }).click();
  await expect(page.locator("main")).toContainText("Sunset Drive");
});

test("now playing queue drawer supports reorder and remove", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/preview");
  await expect(page).toHaveURL(/\/home$/);

  await page.evaluate(() => {
    const songs = ["One", "Two", "Three"].map((name, position) => ({
      id: `queue-${name.toLowerCase()}`,
      spotifyTrackId: `queue-${name.toLowerCase()}`,
      spotifyUri: `spotify:track:queue-${name.toLowerCase()}`,
      title: `Queue ${name}`,
      artist: "Maiabeat QA",
      coverUrl: "/icons/default-cover.svg",
      durationMs: 180000 + position * 1000,
    }));

    window.localStorage.setItem(
      "maiabeat-player",
      JSON.stringify({
        state: {
          currentSong: songs[0],
          queue: songs.map((song, position) => ({
            id: `${song.spotifyTrackId}-${position}`,
            song,
            position,
          })),
          currentIndex: 0,
          shuffleEnabled: false,
          repeatMode: "off",
          volume: 0.8,
          lastAudibleVolume: 0.8,
          isMuted: false,
          history: [],
        },
        version: 0,
      }),
    );
  });

  await page.goto("/home");
  await page.getByRole("button", { name: "Open queue" }).first().click();
  const drawer = page.getByRole("dialog", { name: "Queue" });
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText("Queue One");
  await expect(drawer.locator(".queue-drawer-item")).toHaveCount(2);

  await drawer.getByRole("button", { name: "Move Queue Three up" }).click();
  await expect(drawer.locator(".queue-drawer-item").first()).toContainText("Queue Three");

  await drawer.getByRole("button", { name: "Remove Queue Three" }).click();
  await expect(drawer).not.toContainText("Queue Three");
  await drawer.getByRole("button", { name: "Close queue", exact: true }).click();
  await expect(drawer).toBeHidden();
});

test("playlist management edits details, reorders, removes, and plays", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/preview");
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/playlists/playlist-anggitunes");

  await expect(page.getByRole("heading", { name: "Anggitunes" })).toBeVisible();
  await expect(page.locator(".playlist-track-row")).toHaveCount(3);

  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit details" });
  await editor.getByLabel("Name").fill("Road Mix");
  await editor.getByLabel("Description").fill("Songs for a late drive.");
  await editor.getByRole("button", { name: "Cyan playlist cover" }).click();
  await editor.getByRole("button", { name: /Private/ }).click();
  await editor.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("heading", { name: "Road Mix" })).toBeVisible();
  await expect(page.getByText("Songs for a late drive.")).toBeVisible();
  await expect(page.getByText("private playlist", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Move Electric Sky up" }).click();
  await expect(page.locator(".playlist-track-row").first()).toContainText("Electric Sky");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Remove Coffee & Rain from playlist" }).click();
  await expect(page.locator(".playlist-track-row")).toHaveCount(2);

  await page.getByRole("button", { name: "Play All" }).click();
  const queuedTitle = await page.evaluate(() => {
    const persisted = JSON.parse(localStorage.getItem("maiabeat-player") ?? "{}");
    return persisted.state?.currentSong?.title;
  });
  expect(queuedTitle).toBe("Electric Sky");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Road Mix" })).toBeVisible();
  await expect(page.locator(".playlist-track-row").first()).toContainText("Electric Sky");
  await expect(page.locator(".playlist-track-row")).toHaveCount(2);
});

test("playlist editor crops a gallery cover before saving", async ({ page }) => {
  const landscapePng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAZAAAADICAYAAADGFbfiAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAASiSURBVHhe7dUxDcRAAAPB408qMALnvrRk5Y1gioGw2nOee4Fv9z3AH6eDAaKDAcJAYOhggDAQGDoYIAwEhg4GCAOBoYMBwkBg6GCAMBAYOhggDASGDgYIA4GhgwHCQGDoYIAwEBg6GCAMBIYOBggDgaGDAcJAYOhggDAQGDoYIAwEhg4GCAOBoYMBwkBg6GCAMBAYOhggDASGDgYIA4GhgwHCQGDoYIAwEBg6GCAMBIYOBggDgaGDAcJAYOhggDAQGDoYIAwEhg4GCAOBoYMBwkBg6GCAMBAYOhggDASGDgYIA4GhgwHCQGDoYIAwEBg6GCAMBIYOBggDgaGDAcJAYOhggDAQGDoYIAwEhg4GCAOBoYMBwkBg6GCAMBAYOhggDASGDgYIA4GhgwHCQGDoYIAwEBg6GCAMBIYOBggDgaGDAcJAYOhggDAQGDoYIAwEhg4GCAOBoYMBwkBg6GCAMBAYOhggDASGDgYIA4GhgwHCQGDoYIAwEBg6GCAMBIYOBggDgaGDAcJAYOhggDAQGDoYIAwEhg4GCAOBoYMBwkBg6GCAMBAYOhggDASGDgYIA4GhgwHCQGDoYIAwEBg6GCAMBIYOBggDgaGDAcJAYOhggDAQGDoYIAwEhg4GCAOBoYMBwkBg6GCAMBAYOhggDASGDgYIA4GhgwHCQGDoYIAwEBg6GCAMBIYOBggDgaGDAcJAYOhggDAQGDoYIAwEhg4GCAOBoYMBwkBg6GCAMBAYOhggDASGDgYIA4GhgwHCQGDoYIAwEBg6GCAMBIYOBggDgaGDAcJAYOhggDAQGDoYIAwEhg4GCAOBoYMBwkBg6GCAMBAYOhggDASGDgYIA4GhgwHCQGDoYIAwEBg6GCAMBIYOBggDgaGDAcJAYOhggDAQGDoYIAwEhg4GCAOBoYMBwkBg6GCAMBAYOhggDASGDgYIA4GhgwHCQGDoYIAwEBg6GCAMBIYOBggDgaGDAcJAYOhggDAQGDoYIAwEhg4GCAOBoYMBwkBg6GCAMBAYOhggDASGDgYIA4GhgwHCQGDoYIAwEBg6GCAMBIYOBggDgaGDAcJAYOhggDAQGDoYIAwEhg4GCAOBoYMBwkBg6GCAMBAYOhggDASGDgYIA4GhgwHCQGDoYIAwEBg6GCAMBIYOBggDgaGDAcJAYOhggDAQGDoYIAwEhg4GCAOBoYMBwkBg6GCAMBAYOhggDASGDgYIA4GhgwHCQGDoYIAwEBg6GCAMBIYOBggDgaGDAcJAYOhggDAQGDoYIAwEhg4GCAOBoYMBwkBg6GCAMBAYOhggDASGDgYIA4GhgwHCQGDoYIAwEBg6GCAMBIYOBggDgaGDAcJAYOhggDAQGDoYIAwEhg4GCAOBoYMBwkBg6GCAMBAYOhggDASGDgYIA4GhgwHCQGDoYIAwEBg6GCAMBIYOBggDgaGDAcJAYOhggDAQGDoYIAwEhg4GCAOBoYMBwkBg6GCAMBAYOhggDASGDgYIA4GhgwHCQGDoYIAwEBg6GCAMBIYOBggDgaGDAcJAYOhggDAQGDoYIAwEhg4GCAOBoYMBwkBg6GCAMBAYOhggDASGDgYIA4GhgwHCQGDoYIAwEBg6GCAMBAYOhggDASGDgYIA4GhgwHCQGDoYIAwEBg6GCAMBAYOhggDASGDgYIA4GhgwHCQGDoYIAwEBg6GCAMBIYOBggDgaGDAcJAYOhggfjBWj3tFnH54AAAAAElFTkSuQmCC",
    "base64",
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/preview");
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/playlists/playlist-anggitunes");

  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit details" });
  await editor.locator('input[type="file"]').setInputFiles({
    name: "custom-cover.png",
    mimeType: "image/png",
    buffer: landscapePng,
  });

  const cropEditor = page.getByRole("dialog", { name: "Adjust cover" });
  await expect(cropEditor).toBeVisible();
  const cropImage = cropEditor.locator(".playlist-cover-crop-media");
  const initialTransform = await cropImage.getAttribute("style");
  const cropStage = cropEditor.locator(".playlist-cover-crop-stage");
  const cropBox = await cropStage.boundingBox();
  expect(cropBox).not.toBeNull();
  await page.mouse.move(cropBox!.x + cropBox!.width / 2, cropBox!.y + cropBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(cropBox!.x + cropBox!.width / 2 - 70, cropBox!.y + cropBox!.height / 2);
  await page.mouse.up();
  await expect(cropImage).not.toHaveAttribute("style", initialTransform ?? "");

  const zoom = cropEditor.getByRole("slider", { name: /Zoom/ });
  await expect(zoom).toBeVisible();
  await zoom.fill("1.6");
  await cropEditor.getByRole("button", { name: "Use cover" }).click();
  await expect(editor.getByRole("button", { name: "Custom playlist cover" })).toBeVisible();
  await editor.getByRole("button", { name: "Save changes" }).click();

  await expect
    .poll(() => page.locator(".playlist-detail-header img").getAttribute("src"))
    .toContain("data:image/jpeg;base64");
});

test("lyrics panel follows playback, seeks, and opens fullscreen", async ({ page }) => {
  await page.goto("/preview");
  await expect(page).toHaveURL(/\/home$/);

  await page.route("**/api/lyrics?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        found: true,
        instrumental: false,
        synced: true,
        source: "LRCLIB",
        lines: [
          { timeMs: 0, text: "First lyric line" },
          { timeMs: 10000, text: "Second lyric line" },
          { timeMs: 20000, text: "Third lyric line" },
        ],
      }),
    });
  });
  await page.route("**/api/spotify/seek", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.evaluate(() => {
    const song = {
      id: "lyrics-track",
      spotifyTrackId: "lyrics-track",
      spotifyUri: "spotify:track:lyrics-track",
      title: "Lyrics Check",
      artist: "Maiabeat QA",
      album: "QA Sessions",
      coverUrl: "/icons/default-cover.svg",
      durationMs: 180000,
    };
    localStorage.setItem(
      "maiabeat-player",
      JSON.stringify({
        state: {
          currentSong: song,
          queue: [{ id: "lyrics-track-0", song, position: 0 }],
          currentIndex: 0,
          shuffleEnabled: false,
          repeatMode: "off",
          volume: 0.8,
          lastAudibleVolume: 0.8,
          isMuted: false,
          history: [],
        },
        version: 0,
      }),
    );
  });

  await page.goto("/player");
  const lyricsPanel = page.locator(".lyrics-panel");
  await expect(lyricsPanel.getByRole("heading", { name: "Lyrics" })).toBeVisible();
  await expect(lyricsPanel.getByText("Synced")).toBeVisible();
  await expect(lyricsPanel.getByText("First lyric line")).toHaveAttribute("data-active", "true");

  await lyricsPanel.getByRole("button", { name: "Second lyric line" }).click();
  await expect(page.getByRole("slider", { name: "Seek progress" })).toHaveValue("10000");

  await lyricsPanel.getByRole("button", { name: "Open fullscreen lyrics" }).click();
  await expect(lyricsPanel).toHaveClass(/lyrics-panel-fullscreen/);
  await page.keyboard.press("Escape");
  await expect(lyricsPanel).not.toHaveClass(/lyrics-panel-fullscreen/);
});

test("navigation and create playlist modal work in preview", async ({ page }) => {
  await page.goto("/preview");
  await expect(page).toHaveURL(/\/home$/);

  await page.getByRole("link", { name: "Library" }).first().click();
  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();

  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create playlist" })).toBeVisible();
  await expect(page.getByPlaceholder("Playlist name")).toBeVisible();
});

test("player exposes volume and mute controls", async ({ page }) => {
  await page.goto("/preview");
  await expect(page).toHaveURL(/\/home$/);

  await page.evaluate(() => {
    const song = {
      id: "test-track",
      spotifyTrackId: "test-track",
      spotifyUri: "spotify:track:test-track",
      title: "Volume Check",
      artist: "Maiabeat QA",
      coverUrl: "/icons/default-cover.svg",
      durationMs: 180000,
    };

    window.localStorage.setItem(
      "maiabeat-player",
      JSON.stringify({
        state: {
          currentSong: song,
          queue: [{ id: "test-track-0", song, position: 0 }],
          currentIndex: 0,
          shuffleEnabled: false,
          repeatMode: "off",
          volume: 0.8,
          lastAudibleVolume: 0.8,
          isMuted: false,
          history: [],
        },
        version: 0,
      }),
    );
  });

  await page.goto("/player");
  await expect(page.getByRole("heading", { name: "Volume Check" })).toBeVisible();

  const volume = page.getByRole("slider", { name: "Volume" });
  await expect(volume).toHaveValue("80");
  await volume.fill("35");
  await expect(volume).toHaveValue("35");

  await page.getByRole("button", { name: "Mute" }).click();
  await expect(volume).toHaveValue("0");
  await page.getByRole("button", { name: "Unmute" }).click();
  await expect(volume).toHaveValue("35");
});

test("next button skips even when repeat one is enabled", async ({ page }) => {
  await page.goto("/preview");
  await expect(page).toHaveURL(/\/home$/);

  await page.evaluate(() => {
    const songs = [
      {
        id: "repeat-track-one",
        spotifyTrackId: "repeat-track-one",
        spotifyUri: "spotify:track:repeat-track-one",
        title: "Repeat Track One",
        artist: "Maiabeat QA",
        coverUrl: "/icons/default-cover.svg",
        durationMs: 180000,
      },
      {
        id: "repeat-track-two",
        spotifyTrackId: "repeat-track-two",
        spotifyUri: "spotify:track:repeat-track-two",
        title: "Repeat Track Two",
        artist: "Maiabeat QA",
        coverUrl: "/icons/default-cover.svg",
        durationMs: 180000,
      },
    ];

    window.localStorage.setItem(
      "maiabeat-player",
      JSON.stringify({
        state: {
          currentSong: songs[0],
          queue: songs.map((song, position) => ({
            id: `${song.spotifyTrackId}-${position}`,
            song,
            position,
          })),
          currentIndex: 0,
          shuffleEnabled: false,
          repeatMode: "one",
          volume: 0.8,
          lastAudibleVolume: 0.8,
          isMuted: false,
          history: [],
        },
        version: 0,
      }),
    );
  });

  await page.goto("/player");
  await expect(page.getByRole("heading", { name: "Repeat Track One" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Repeat one" })).toBeVisible();

  await page.getByRole("button", { name: "Next", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Repeat Track Two" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Repeat one" })).toBeVisible();
});

test("important private API routes return JSON instead of 404 HTML", async ({ request }) => {
  for (const path of [
    "/api/library",
    "/api/lyrics?track=Test&artist=Test",
    "/api/spotify/me",
    "/api/spotify/search?q=NIKI",
    "/api/home",
    "/api/genre/chill",
  ]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(401);
    expect(response.headers()["content-type"], path).toContain("application/json");
    await expect(response.text(), path).resolves.toContain("Login required");
  }

  const listeningResponse = await request.post("/api/listening/rooms", {
    data: { playback: {} },
  });
  expect(listeningResponse.status()).toBe(401);
  expect(listeningResponse.headers()["content-type"]).toContain("application/json");
  await expect(listeningResponse.text()).resolves.toContain("Login required");
});

test("Listening Together lobby explains account requirement in preview", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/preview");
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/listen?code=SYNC24");

  await expect(page.getByRole("heading", { name: "Listening Together" })).toBeVisible();
  await expect(page.getByLabel("Room code")).toHaveValue("SYNC24");
  await expect(page.getByRole("button", { name: "Start room" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Join room" })).toBeDisabled();
  await expect(page.getByText("Use a real account to create or join live rooms.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/reset-preview",
  );
  await expect(page.getByText("Preview mode", { exact: true })).toBeVisible();
});

test("Listening Together connects host and listener through the Realtime fallback", async ({
  browser,
  page: hostPage,
  baseURL,
}) => {
  const song = {
    id: "broadcast-song",
    spotifyTrackId: "broadcast-song",
    spotifyUri: "spotify:track:broadcast-song",
    title: "Realtime Together",
    artist: "Maiabeat Live",
    coverUrl: "/icons/cover-cyan.svg",
    durationMs: 210000,
  };
  const listenerPlayRequests: Array<{ spotifyUri?: string }> = [];

  const preparePage = async (
    page: typeof hostPage,
    user: { id: string; email: string; displayName: string },
    withHostPlayback: boolean,
  ) => {
    await page.addInitScript((deviceId) => {
      const listeners: Record<string, (payload: unknown) => void> = {};
      class MockSpotifyPlayer {
        addListener(event: string, callback: (payload: unknown) => void) {
          listeners[event] = callback;
        }
        async connect() {
          window.setTimeout(() => listeners.ready?.({ device_id: deviceId }), 0);
          return true;
        }
        disconnect() {}
        async activateElement() {}
        async pause() {}
        async resume() {}
        async setVolume() {}
      }

      (window as unknown as { Spotify: { Player: typeof MockSpotifyPlayer } }).Spotify = {
        Player: MockSpotifyPlayer,
      };
    }, `${user.id}-device`);

    await page.route("**/api/listening/rooms", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Listening Together database migration has not been applied yet.",
        }),
      });
    });
    await page.route("**/api/listening/rooms/join", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Listening Together database migration has not been applied yet.",
        }),
      });
    });
    await page.route("**/api/library", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          likedSongs: [],
          playlists: [],
          recentlyPlayed: [],
          playlistSongs: [],
          queue: withHostPlayback ? [{ id: "broadcast-song-0", song, position: 0 }] : [],
          playerState: withHostPlayback
            ? {
                currentSong: song,
                currentIndex: 0,
                isPlaying: true,
                progressMs: 12000,
                shuffleEnabled: false,
                repeatMode: "off",
              }
            : null,
        }),
      });
    });
    await page.route("**/api/spotify/playback-state", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ state: null }),
      });
    });
    await page.route("**/api/spotify/transfer", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });
    await page.route("**/api/spotify/play", async (route) => {
      if (!withHostPlayback) listenerPlayRequests.push(route.request().postDataJSON());
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/preview");
    await expect(page).toHaveURL(/\/home$/);
    await page.evaluate(
      ({ nextUser, nextSong, seedPlayback }) => {
        localStorage.setItem(
          "maiabeat-auth",
          JSON.stringify({
            state: {
              user: nextUser,
              loading: false,
              hydrated: true,
              error: null,
            },
            version: 0,
          }),
        );
        localStorage.removeItem("maiabeat-listening-room");
        localStorage.setItem(
          "maiabeat-player",
          JSON.stringify({
            state: {
              currentSong: seedPlayback ? nextSong : null,
              queue: seedPlayback
                ? [{ id: "broadcast-song-0", song: nextSong, position: 0 }]
                : [],
              currentIndex: 0,
              shuffleEnabled: false,
              repeatMode: "off",
              volume: 0.8,
              lastAudibleVolume: 0.8,
              isMuted: false,
              history: [],
            },
            version: 0,
          }),
        );
      },
      { nextUser: user, nextSong: song, seedPlayback: withHostPlayback },
    );
  };

  const listenerContext = await browser.newContext({ baseURL });
  const listenerPage = await listenerContext.newPage();
  try {
    await preparePage(
      hostPage,
      { id: "broadcast-host", email: "host@example.com", displayName: "Room Host" },
      true,
    );
    await hostPage.goto("/listen");
    await expect(
      hostPage.getByText("Realtime Together", { exact: true }).last(),
    ).toBeVisible();
    await hostPage.getByRole("button", { name: "Start room" }).click();
    await expect(hostPage.getByText("Live", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    const roomCode = await hostPage.locator(".listening-room-code-block strong").innerText();
    expect(roomCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    await expect(hostPage.getByText("Starting...", { exact: true })).toHaveCount(0);

    await preparePage(
      listenerPage,
      {
        id: "broadcast-listener",
        email: "listener@example.com",
        displayName: "Room Listener",
      },
      false,
    );
    await listenerPage.goto(`/listen?code=${roomCode}`);
    await listenerPage.getByRole("button", { name: "Join room" }).click();

    await expect(listenerPage.getByText("Live", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      listenerPage
        .locator(".listening-now-playing")
        .getByText("Realtime Together", { exact: true }),
    ).toBeVisible();
    await expect(listenerPage.getByText("Room Host", { exact: true })).toBeVisible();
    await expect(listenerPage.getByText("Room Listener", { exact: true })).toBeVisible();
    await expect.poll(() => listenerPlayRequests.at(-1)?.spotifyUri ?? null).toBe(
      song.spotifyUri,
    );
  } finally {
    await listenerContext.close();
  }
});

test("Listening Together retries host playback when the listener device becomes ready", async ({ page }) => {
  const playRequests: Array<{ spotifyUri?: string; positionMs?: number }> = [];
  const now = new Date().toISOString();
  const song = {
    id: "device-ready-song",
    spotifyTrackId: "device-ready-song",
    spotifyUri: "spotify:track:device-ready-song",
    title: "Device Ready Song",
    artist: "Maiabeat Live",
    coverUrl: "/icons/cover-cyan.svg",
    durationMs: 210000,
  };
  const room = {
    id: "device-ready-room",
    code: "READY2",
    hostId: "room-host",
    status: "active",
    createdAt: now,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    playback: {
      currentSong: song,
      queue: [song],
      currentIndex: 0,
      isPlaying: true,
      positionMs: 42000,
      startedAt: now,
      version: 3,
      updatedAt: now,
    },
    members: [
      {
        userId: "room-host",
        displayName: "Room Host",
        role: "host",
        joinedAt: now,
        lastSeen: now,
        online: true,
      },
      {
        userId: "room-listener",
        displayName: "Room Listener",
        role: "listener",
        joinedAt: now,
        lastSeen: now,
        online: true,
      },
    ],
  };

  await page.addInitScript(() => {
    const listeners: Record<string, (payload: unknown) => void> = {};
    class MockSpotifyPlayer {
      addListener(event: string, callback: (payload: unknown) => void) {
        listeners[event] = callback;
      }
      async connect() {
        window.setTimeout(() => listeners.ready?.({ device_id: "listener-device" }), 700);
        return true;
      }
      disconnect() {}
      async activateElement() {}
      async pause() {}
      async resume() {}
      async setVolume() {}
    }

    (window as unknown as { Spotify: { Player: typeof MockSpotifyPlayer } }).Spotify = {
      Player: MockSpotifyPlayer,
    };
  });
  await page.route("**/api/library", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        likedSongs: [],
        playlists: [],
        recentlyPlayed: [],
        playlistSongs: [],
        queue: [],
        playerState: null,
      }),
    });
  });
  await page.route("**/api/spotify/playback-state", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ state: null }),
    });
  });
  await page.route("**/api/spotify/transfer", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.route("**/api/spotify/play", async (route) => {
    playRequests.push(route.request().postDataJSON());
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.route("**/api/listening/rooms/device-ready-room", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ room }),
    });
  });

  await page.goto("/preview");
  await expect(page).toHaveURL(/\/home$/);
  await page.evaluate((roomId) => {
    localStorage.setItem(
      "maiabeat-auth",
      JSON.stringify({
        state: {
          user: {
            id: "room-listener",
            email: "listener@example.com",
            displayName: "Room Listener",
          },
          loading: false,
          hydrated: true,
          error: null,
        },
        version: 0,
      }),
    );
    localStorage.setItem(
      "maiabeat-listening-room",
      JSON.stringify({ state: { activeRoomId: roomId }, version: 0 }),
    );
    localStorage.removeItem("maiabeat-player");
  }, room.id);

  await page.reload();
  await page.goto("/listen");
  await expect(
    page.locator(".listening-now-playing").getByText("Device Ready Song", { exact: true }),
  ).toBeVisible();
  await expect.poll(() => playRequests.at(-1)?.spotifyUri ?? null).toBe(song.spotifyUri);
  expect(playRequests.at(-1)?.positionMs ?? 0).toBeGreaterThanOrEqual(42000);
  expect(playRequests.at(-1)?.positionMs ?? 0).toBeLessThan(60000);
});

test("Listening Together renders a synced listener room and locks host controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/preview");
  await expect(page).toHaveURL(/\/home$/);

  await page.evaluate(() => {
    const song = {
      id: "room-song",
      spotifyTrackId: "room-song",
      spotifyUri: "spotify:track:room-song",
      title: "Same Moment",
      artist: "Maiabeat Live",
      coverUrl: "/icons/cover-cyan.svg",
      durationMs: 210000,
    };
    const now = new Date().toISOString();
    const room = {
      id: "room-live",
      code: "SYNC24",
      hostId: "host-user",
      status: "active",
      createdAt: now,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      playback: {
        currentSong: song,
        queue: [song],
        currentIndex: 0,
        isPlaying: true,
        positionMs: 42000,
        startedAt: now,
        version: 7,
        updatedAt: now,
      },
      members: [
        {
          userId: "host-user",
          displayName: "Room Host",
          role: "host",
          joinedAt: now,
          lastSeen: now,
          online: true,
        },
        {
          userId: "local-preview",
          displayName: "Anggita",
          role: "listener",
          joinedAt: now,
          lastSeen: now,
          online: true,
        },
      ],
    };

    localStorage.setItem(
      "maiabeat-listening-room",
      JSON.stringify({
        state: {
          activeRoomId: room.id,
          room,
          role: "listener",
          connectionStatus: "connected",
          loading: false,
          error: null,
        },
        version: 0,
      }),
    );
    localStorage.setItem(
      "maiabeat-player",
      JSON.stringify({
        state: {
          currentSong: song,
          queue: [{ id: "room-song-0", song, position: 0 }],
          currentIndex: 0,
          isPlaying: true,
          progressMs: 42000,
          durationMs: song.durationMs,
          shuffleEnabled: false,
          repeatMode: "off",
          volume: 0.8,
          lastAudibleVolume: 0.8,
          isMuted: false,
          history: [],
        },
        version: 0,
      }),
    );
  });

  await page.goto("/listen?code=SYNC24");
  await expect(page.getByText("SYNC24", { exact: true })).toBeVisible();
  await expect(
    page.locator(".listening-now-playing").getByText("Same Moment", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Room Host", { exact: true })).toBeVisible();
  await expect(page.getByText("Anggita", { exact: true })).toBeVisible();
  await expect(page.getByText("Host controlled", { exact: true })).toBeVisible();
  await expect(
    page.locator(".listening-now-playing").getByRole("button", { name: "Play or pause" }),
  ).toBeDisabled();
  await expect(page.getByRole("link", { name: "Listening room SYNC24" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Together", exact: true })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("Maria Forest theme persists and keeps responsive navigation fixed", async ({ page }) => {
  await page.goto("/preview");
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/settings");

  const mariaTheme = page.getByRole("radio", { name: "Maria Forest" });
  await mariaTheme.click();
  await expect(mariaTheme).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "maria");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "maria");
  await expect(page.locator(".app-shell")).toHaveClass(/theme-maria/);
  await expect(page.locator(".app-shell")).toHaveCSS("font-family", /Playfair Display/);
  await expect(page.locator(".sidebar-brand")).toHaveCSS(
    "background-color",
    "rgb(123, 46, 58)",
  );
  await expect(page.locator(".app-shell")).toHaveCSS("--yellow", "#68000c");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".bottom-navigation-item")).toHaveCount(5);
  await expect(page.locator(".bottom-navigation-shell")).toHaveCSS("position", "fixed");
  await expect(page.locator(".desktop-sidebar")).toHaveCSS("display", "none");

  const mobileOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(mobileOverflow).toBe(false);

  await page.setViewportSize({ width: 1366, height: 768 });
  await expect(page.locator(".desktop-sidebar")).toHaveCSS("position", "fixed");
  await expect(page.locator(".bottom-navigation-shell")).toHaveCSS("display", "none");
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
]) {
  test(`responsive smoke ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/preview");
    await expect(page).toHaveURL(/\/home$/);

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
}
