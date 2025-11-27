"use client";

export function useToast(){
  return {
    toast: ({ title, description }:{ title?: string; description?: string; duration?: number }) => {
      if (title || description) {
        // Keep this as a dev-only console.warn so we can debug toast usage
        // without violating the shared `no-console` rule (only warn/error
        // allowed). Production users won't see this.
        if (process.env.NODE_ENV !== 'production') {
          console.warn("[toast]", title ?? "", description ?? "");
        }
      }
    }
  } as const;
}

