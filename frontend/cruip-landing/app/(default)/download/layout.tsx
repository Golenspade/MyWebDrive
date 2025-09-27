"use client";

import type { ReactNode } from "react";

export default function DownloadLayout({ children }: { children: ReactNode }) {
  // Hide the global site Header/Footer for the /download route to avoid double headers.
  return <>{children}</>;
}

