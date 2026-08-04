import { ACTIVE_SLIDE_WARNING, scheduleStatus } from "@nagori/core";
import { Button, Checkbox, Field, Input, SlidePreview } from "@nagori/ui";
import { currentUser } from "@/lib/auth";
import { getEnv, getStore } from "@/lib/cloudflare";
import { DashboardShell } from "@/components/dashboard-shell";
import { isTabKey, type TabKey } from "@/lib/tabs";
import { InviteForm, PendingInvites } from "@/components/family-forms";
import { CreateFrameForm, DeviceRows } from "@/components/frame-forms";
import { MemoryForm } from "@/components/memory-form";
import { SettingsForm } from "@/components/settings-form";
import {
  archiveSlideAction,
  logoutAction,
  loginAction,
  renewSlideAction,
  rescheduleSlideAction,
  setupAction,
} from "./actions";

export const dynamic = "force-dynamic";

function Logo() {
  return (
    <span className="logo" aria-hidden="true">
      M
    </span>
  );
}

function AuthShell({
  mode,
  error,
}: {
  mode: "setup" | "login";
  error?: string;
}) {
  const setup = mode === "setup";
  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="wordmark">
          <Logo />
          <span>
            Nagori <small lang="ja">名残</small>
          </span>
        </div>
        <div className="auth-copy">
          <p className="eyebrow">A window into family life</p>
          <h1>
            The photos that matter, <em>already there.</em>
          </h1>
          <p>
            Share a moment from your phone. It quietly appears on the family
            frame — no taps, passwords or instructions needed on the other side.
          </p>
        </div>
        <p className="auth-foot">
          Designed for old iPads and the people we love.
        </p>
      </section>
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <p className="eyebrow">
            {setup ? "First-time setup" : "Welcome back"}
          </p>
          <h2>
            {setup ? "Create your family space" : "Sign in to your family"}
          </h2>
          <p>
            {setup
              ? "You’ll be the owner. More family members can join later."
              : "Add a new photo, write a note, or check the frame."}
          </p>
          {error && (
            <div className="alert">
              {error === "login"
                ? "That email and password don’t match."
                : error === "rate_limited"
                  ? "Too many attempts. Please wait 15 minutes and try again."
                  : error === "owner_email"
                    ? "Setup is reserved for this deployment’s configured owner email."
                    : "Please check the details and use a password with at least 12 characters."}
            </div>
          )}
          <form
            action={setup ? setupAction : loginAction}
            className="auth-form"
          >
            {setup && (
              <>
                <Field label="Your name">
                  <Input name="name" autoComplete="name" required />
                </Field>
                <Field label="Family space name">
                  <Input
                    name="householdName"
                    defaultValue="Our family"
                    required
                  />
                </Field>
                <input name="timezone" type="hidden" value="Europe/Lisbon" />
              </>
            )}
            <Field label="Email address">
              <Input name="email" type="email" autoComplete="email" required />
            </Field>
            <Field label="Password">
              <Input
                name="password"
                type="password"
                minLength={12}
                autoComplete={setup ? "new-password" : "current-password"}
                required
              />
            </Field>
            <Button type="submit">
              {setup ? "Create family space" : "Sign in"}
            </Button>
          </form>
          {!setup && (
            <p className="auth-note">
              Accounts are invitation-only. Ask your family owner for an invite.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Forever";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function dateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const store = getStore();
  const hasUsers = await store.hasUsers();
  if (!hasUsers)
    return (
      <AuthShell
        mode="setup"
        error={typeof params.error === "string" ? params.error : undefined}
      />
    );
  const user = await currentUser();
  if (!user)
    return (
      <AuthShell
        mode="login"
        error={typeof params.error === "string" ? params.error : undefined}
      />
    );

  const [slides, settings, activeCount, members, devices, invitations] =
    await Promise.all([
      store.listSlides(user.householdId),
      store.getSettings(user.householdId),
      store.countActiveSlides(user.householdId),
      store.listMembers(user.householdId),
      store.listDevices(user.householdId),
      store.listPendingInvitations(user.householdId),
    ]);
  const grouped = {
    active: slides.filter((slide) => scheduleStatus(slide) === "active"),
    upcoming: slides.filter((slide) => scheduleStatus(slide) === "upcoming"),
    expired: slides.filter((slide) => scheduleStatus(slide) === "expired"),
  };
  const initialTab: TabKey = isTabKey(params.tab) ? params.tab : "today";
  const initials = user.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const rotationWarning = activeCount >= ACTIVE_SLIDE_WARNING && (
    <div className="alert warning">
      The rotation has {activeCount} active slides. Archive a few or give them
      an end date before it reaches the 200-slide limit.
    </div>
  );

  return (
    <DashboardShell
      initialTab={initialTab}
      libraryCount={slides.length}
      brand={
        <span className="brand">
          <Logo />
          <span>
            Nagori <small lang="ja">名残</small>
          </span>
        </span>
      }
      account={
        <div className="sidebar-foot">
          <div className="avatar">{initials}</div>
          <div>
            <strong>{user.name}</strong>
            <span>{user.role}</span>
          </div>
          <form action={logoutAction}>
            <button title="Sign out" type="submit">
              ↗
            </button>
          </form>
        </div>
      }
      topbar={
        <header className="topbar">
          <div>
            <p>{user.householdName}</p>
            <span>Private family space</span>
          </div>
          <a
            className="frame-link"
            href={getEnv().FRAME_URL}
            target="_blank"
            rel="noreferrer"
          >
            <span className="online-dot" /> Open frame
          </a>
        </header>
      }
      panels={{
        today: (
          <>
            <section className="welcome">
              <div>
                <h1>Good day, {user.name.split(" ")[0]}.</h1>
                <p>
                  {activeCount === 0
                    ? "The frame is ready for its first memory."
                    : `${activeCount} ${activeCount === 1 ? "memory is" : "memories are"} keeping the frame company.`}
                </p>
              </div>
            </section>
            {rotationWarning}
            <section className="composer">
              <div className="section-intro">
                <p className="eyebrow">Share something new</p>
                <h2>A small moment makes their day.</h2>
              </div>
              <MemoryForm showCaptions={settings.showCaptions} />
            </section>
          </>
        ),
        library: (
          <section className="library">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Current rotation</p>
                <h2>What they’re seeing</h2>
              </div>
              <p>{activeCount} of 200 active</p>
            </div>
            {rotationWarning}
            {grouped.active.length === 0 ? (
              <div className="empty-library">
                <span>□</span>
                <h3>No active memories yet</h3>
                <p>
                  Share a photo or note and it will arrive on the frame within a
                  minute.
                </p>
              </div>
            ) : (
              <div className="memory-grid">
                {grouped.active.map((slide) => (
                  <article className="memory-card" key={slide.id}>
                    <SlidePreview
                      imageUrl={
                        slide.kind === "photo"
                          ? `/api/media/${encodeURIComponent(slide.id)}`
                          : null
                      }
                      theme={slide.theme}
                      message={slide.message}
                      caption={slide.caption}
                      fit={settings.fitMode}
                      showCaption={settings.showCaptions}
                    />
                    <div className="memory-meta">
                      <div>
                        <span className="status active">Showing now</span>
                        <h3>
                          {slide.caption ||
                            (slide.kind === "message"
                              ? "Family note"
                              : "Untitled memory")}
                        </h3>
                        <p>Until {formatDate(slide.displayUntil)}</p>
                      </div>
                      <form action={archiveSlideAction}>
                        <input type="hidden" name="slideId" value={slide.id} />
                        <Button size="sm" type="submit" variant="text">
                          Archive
                        </Button>
                      </form>
                    </div>
                    <details className="schedule-editor">
                      <summary>Change schedule</summary>
                      <form action={rescheduleSlideAction}>
                        <input type="hidden" name="slideId" value={slide.id} />
                        <div className="date-grid">
                          <Field label="From">
                            <Input
                              name="displayFrom"
                              type="date"
                              defaultValue={dateInputValue(slide.displayFrom)}
                              required
                            />
                          </Field>
                          <Field label="Until">
                            <Input
                              name="displayUntil"
                              type="date"
                              defaultValue={dateInputValue(slide.displayUntil)}
                            />
                          </Field>
                        </div>
                        <Checkbox name="forever" value="yes">
                          Keep in rotation forever
                        </Checkbox>
                        <Button size="sm" type="submit" variant="text">
                          Save schedule
                        </Button>
                      </form>
                    </details>
                  </article>
                ))}
              </div>
            )}
            {(grouped.upcoming.length > 0 || grouped.expired.length > 0) && (
              <div className="schedule-groups">
                {grouped.upcoming.length > 0 && (
                  <div>
                    <h3>Coming up</h3>
                    {grouped.upcoming.map((slide) => (
                      <div className="schedule-item" key={slide.id}>
                        <strong>
                          {slide.caption || slide.message?.slice(0, 45)}
                        </strong>
                        <span>Starts {formatDate(slide.displayFrom)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {grouped.expired.length > 0 && (
                  <div>
                    <h3>Ready to archive</h3>
                    {grouped.expired.map((slide) => (
                      <div className="schedule-item" key={slide.id}>
                        <strong>
                          {slide.caption || slide.message?.slice(0, 45)}
                        </strong>
                        <span>Ended {formatDate(slide.displayUntil)}</span>
                        <form action={renewSlideAction}>
                          <input
                            type="hidden"
                            name="slideId"
                            value={slide.id}
                          />
                          <Button size="sm" type="submit" variant="text">
                            Renew for {settings.defaultVisibilityDays} days
                          </Button>
                        </form>
                        <form action={archiveSlideAction}>
                          <input
                            type="hidden"
                            name="slideId"
                            value={slide.id}
                          />
                          <Button size="sm" type="submit" variant="text">
                            Archive
                          </Button>
                        </form>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        ),
        family: (
          <section className="family-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Family access</p>
                <h2>People in {user.householdName}</h2>
              </div>
              <p>
                {members.length} {members.length === 1 ? "person" : "people"}
              </p>
            </div>
            <div className="family-grid">
              <div>
                <div className="member-list">
                  {members.map((member) => (
                    <div key={member.id}>
                      <span className="avatar">
                        {member.name.slice(0, 2).toUpperCase()}
                      </span>
                      <p>
                        <strong>{member.name}</strong>
                        <small>{member.email}</small>
                      </p>
                      <em>{member.role}</em>
                    </div>
                  ))}
                </div>
                {user.role === "owner" && (
                  <PendingInvites invitations={invitations} />
                )}
              </div>
              {user.role === "owner" && <InviteForm />}
            </div>
          </section>
        ),
        frame: (
          <section className="utility-section">
            <p className="eyebrow">Frame</p>
            <h2>Connect an iPad</h2>
            <p>
              Name the frame, then send the link to whoever has the iPad. They
              open it, add it to the Home Screen, and tap Connect once. After
              that it updates by itself.
            </p>
            <CreateFrameForm />
            {devices.length > 0 && (
              <DeviceRows devices={devices} isOwner={user.role === "owner"} />
            )}
          </section>
        ),
        settings: (
          <section className="utility-section">
            <p className="eyebrow">Playback</p>
            <h2>Keep it comfortable</h2>
            <p>These settings apply to every frame in your family space.</p>
            <SettingsForm
              settings={settings}
              saved={params.saved === "settings"}
            />
          </section>
        ),
      }}
    />
  );
}
