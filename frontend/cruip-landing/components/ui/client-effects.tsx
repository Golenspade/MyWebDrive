"use client"

import { useEffect } from "react"
import AOS from "aos"

// Client-only side effects for marketing pages (AOS init, cursor, etc.)
export default function ClientEffects() {
  useEffect(() => {
    AOS.init({
      once: true,
      duration: 700,
      easing: "ease-out-cubic",
    })
    AOS.refreshHard()
  }, [])

  // Keep this component minimal; SmoothCursor is optional and fully client-side
  // Importing here avoids forcing the whole layout to be a Client Component
  const { SmoothCursor } = require("./smooth-cursor")
  return <SmoothCursor />
}

