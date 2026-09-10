import type { ReactNode } from 'react';
import { useId, useState } from 'react';

export function Accordion({ children }: { children: ReactNode }) {
  return <div className="accordion">{children}</div>;
}

export function AccordionPanel({
  id,
  title,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const generatedId = useId();
  const panelId = id || generatedId;
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className={`accordion__panel${isOpen ? ' accordion__panel--open' : ''}`}>
      <button
        aria-controls={`accordion-content-${panelId}`}
        aria-expanded={isOpen}
        className="accordion__trigger"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span>{title}</span>
        <span aria-hidden="true" className="accordion__chevron">
          {isOpen ? '▾' : '▸'}
        </span>
      </button>
      {isOpen ? (
        <div className="accordion__content" id={`accordion-content-${panelId}`}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
