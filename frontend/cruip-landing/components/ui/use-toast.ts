"use client";

export function useToast(){
  return {
    toast: ({ title, description }:{ title?: string; description?: string; duration?: number }) => {
      if (title || description) {
        console.log("[toast]", title ?? "", description ?? "");
      }
    }
  } as const;
}

