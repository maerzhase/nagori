"use client";

import { Tab, TabPanel, Tabs, TabsList } from "@nagori/ui";
import { type ReactNode, useState } from "react";
import { isTabKey, TAB_KEYS, TAB_LABELS, type TabKey } from "@/lib/tabs";

export interface DashboardShellProps {
  initialTab: TabKey;
  libraryCount: number;
  brand: ReactNode;
  account: ReactNode;
  topbar: ReactNode;
  panels: Record<TabKey, ReactNode>;
}

export function DashboardShell({
  initialTab,
  libraryCount,
  brand,
  account,
  topbar,
  panels,
}: DashboardShellProps) {
  const [tab, setTab] = useState<TabKey>(initialTab);
  return (
    <Tabs
      className="app-shell"
      orientation="vertical"
      value={tab}
      onValueChange={(value) => {
        if (!isTabKey(value)) return;
        setTab(value);
        // Shallow update: the panels are already in the tree, so a router
        // navigation would refetch the page to show what is on screen. The
        // param still exists so a server action can redirect back to a tab.
        const url = new URL(window.location.href);
        url.searchParams.set("tab", value);
        url.searchParams.delete("error");
        url.searchParams.delete("saved");
        window.history.replaceState(null, "", url);
      }}
    >
      <aside className="sidebar">
        {brand}
        <TabsList aria-label="Sections">
          {TAB_KEYS.map((key) => (
            <Tab key={key} value={key}>
              <Icon name={key} />
              {TAB_LABELS[key]}
              {key === "library" ? <span>{libraryCount}</span> : null}
            </Tab>
          ))}
        </TabsList>
        {account}
      </aside>
      <main className="dashboard" id="top">
        {topbar}
        <div className="content">
          {TAB_KEYS.map((key) => (
            <TabPanel key={key} value={key}>
              {panels[key]}
            </TabPanel>
          ))}
          <footer>
            Nagori <span lang="ja">名残</span> <span>·</span> The memories that
            remain.
          </footer>
        </div>
      </main>
    </Tabs>
  );
}

function Icon({ name }: { name: TabKey }) {
  const paths = {
    today: (
      <>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v10h13V10" />
      </>
    ),
    library: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="10" r="2" />
        <path d="m5 17 4-4 3 3 2-2 5 3" />
      </>
    ),
    family: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6" />
        <path d="M16 5.5a3 3 0 0 1 0 5.8M17 14c2.3.5 3.5 2.5 3.5 5" />
      </>
    ),
    frame: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 17h8M12 7v6M9 10h6" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
