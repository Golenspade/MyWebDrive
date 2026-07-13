"use client";

import { useState } from "react";

type AccordionProps = {
  children: React.ReactNode;
  title: string;
  id: string;
  active?: boolean;
};

export default function Accordion({
  children,
  title,
  id,
  active = false,
}: AccordionProps) {
  const [accordionOpen, setAccordionOpen] = useState<boolean>(active);

  return (
    <div className="relative rounded-nothing-md border border-nothing-line-2 bg-nothing-surface">
      <h2>
        <button
          id={`accordion-title-${id}`}
          className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nothing-focus"
          onClick={(e) => {
            e.preventDefault();
            setAccordionOpen((prev) => !prev);
          }}
          aria-expanded={accordionOpen}
          aria-controls={`accordion-text-${id}`}
        >
          <span>{title}</span>
          <span className="ml-8 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-nothing-line-2 bg-nothing-raised">
            <svg
              className={`origin-center transform fill-nothing-secondary transition-transform duration-200 ease-out ${accordionOpen ? "rotate-180" : ""}` }
              xmlns="http://www.w3.org/2000/svg"
              width={10}
              height={6}
              fill="none"
            >
              <path
                d="m2 .586 3 3 3-3L9.414 2 5.707 5.707a1 1 0 0 1-1.414 0L.586 2 2 .586Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </button>
      </h2>
      <div
        id={`accordion-text-${id}`}
        role="region"
        aria-labelledby={`accordion-title-${id}`}
        className={`grid overflow-hidden text-sm text-nothing-secondary transition-[grid-template-rows,opacity] duration-300 ease-in-out ${accordionOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <p className="px-4 pb-3">{children}</p>
        </div>
      </div>
    </div>
  );
}
