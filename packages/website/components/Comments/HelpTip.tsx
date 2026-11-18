import React, { useId, useState } from 'react';

/**
 * A small "?" button that explains a form field. The text shows on hover and
 * keyboard focus, and a tap toggles it on touch screens.
 *
 * The bubble is positioned against the nearest positioned ancestor, so put
 * this inside a `relative` field container: the bubble then spans that
 * container and can never overflow the viewport on narrow screens.
 */
export default function HelpTip(props: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  return (
    <span className="group inline-flex">
      <button
        type="button"
        aria-label={`${props.label}说明`}
        aria-describedby={tooltipId}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
        className="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-gray-300 text-[10px] leading-none text-gray-400 transition-colors hover:border-blue-500 hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-dark-400 dark:text-dark-light dark:hover:border-blue-400 dark:hover:text-blue-400"
      >
        ?
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className={`pointer-events-none absolute bottom-full left-0 right-0 z-20 mb-1 rounded-md bg-gray-800 px-2.5 py-1.5 text-xs font-normal leading-relaxed text-white shadow-lg transition-opacity dark:bg-gray-700 ${
          open
            ? 'visible opacity-100'
            : 'invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100'
        }`}
      >
        {props.children}
      </span>
    </span>
  );
}
