"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Separator({ className }:{ className?: string }){
  return <hr className={cn("border-t", className)} />;
}

