"use client";

import { Suspense } from "react";
import AppCatalogPage from "@/components/download/catalog-page";

export default function DownloadPage() {
  return (
    <Suspense fallback={null}>
      <AppCatalogPage />
    </Suspense>
  );
}
