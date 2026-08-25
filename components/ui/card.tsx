import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";

const BASE =
  "rounded-card border border-line bg-surface p-4 text-left transition-colors";

interface StaticCardProps {
  interactive?: false;
  children: ReactNode;
  className?: string;
}

interface InteractiveCardProps {
  interactive: true;
  children: ReactNode;
  className?: string;
  href?: string;
  onClick?: MouseEventHandler;
  "aria-label"?: string;
}

export type CardProps = StaticCardProps | InteractiveCardProps;

// Card | default, interactive (hover + focus). Focus ring comes from the
// global :focus-visible rule — this renders a real <a> or <button> so it
// applies with no extra work.
export function Card(props: CardProps) {
  if (props.interactive) {
    const { href, onClick, children, className = "", "aria-label": ariaLabel } = props;
    const classes = `${BASE} block min-h-12 w-full hover:border-action ${className}`;

    if (href) {
      return (
        <Link href={href} aria-label={ariaLabel} className={classes}>
          {children}
        </Link>
      );
    }
    return (
      <button type="button" onClick={onClick} aria-label={ariaLabel} className={classes}>
        {children}
      </button>
    );
  }

  const { children, className = "" } = props;
  return <div className={`${BASE} ${className}`}>{children}</div>;
}
