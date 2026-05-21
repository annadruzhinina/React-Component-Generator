"use client";

import dynamic from "next/dynamic";

export const ClientMainContent = dynamic(
  () => import("./main-content").then((m) => m.MainContent),
  { ssr: false }
);
