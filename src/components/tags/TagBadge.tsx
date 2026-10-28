'use client';

import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { tagName, type Tag } from '@/types/tag';
import { TagIcon } from './tag-icons';

/** The tag's name in the current interface language. */
export function useTagName() {
  const { i18n } = useTranslation();
  const language = i18n?.resolvedLanguage ?? i18n?.language;
  return (tag: Pick<Tag, 'name'>) => tagName(tag, language);
}

interface TagBadgeProps {
  tag: Tag;
  className?: string;
}

/** A small read-only tag label with its icon, if the icon key is known. */
export function TagBadge({ tag, className }: TagBadgeProps) {
  const nameOf = useTagName();

  return (
    <span
      data-testid="tag-badge"
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 whitespace-nowrap',
        className,
      )}
    >
      <TagIcon icon={tag.icon} className="h-3 w-3 shrink-0" />
      {nameOf(tag)}
    </span>
  );
}

interface TagBadgeListProps {
  tags: Tag[] | undefined;
  /** Show at most this many and a "+N" for the rest. */
  max?: number;
  className?: string;
}

export function TagBadgeList({ tags, max, className }: TagBadgeListProps) {
  if (!tags?.length) return null;
  const shown = max ? tags.slice(0, max) : tags;
  const hidden = tags.length - shown.length;

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {shown.map((tag) => (
        <TagBadge key={tag.id} tag={tag} />
      ))}
      {hidden > 0 && <span className="text-xs font-medium text-zinc-500">+{hidden}</span>}
    </div>
  );
}

interface TagToggleProps {
  tag: Tag;
  selected: boolean;
  disabled?: boolean;
  onToggle: (tag: Tag) => void;
  className?: string;
}

/** A selectable tag chip for filters. */
export function TagToggle({ tag, selected, disabled, onToggle, className }: TagToggleProps) {
  const nameOf = useTagName();

  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled && !selected}
      onClick={() => onToggle(tag)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-40 disabled:pointer-events-none',
        selected
          ? 'bg-orange-600 text-white border-orange-600'
          : 'bg-white text-zinc-600 border-zinc-200 hover:border-orange-200 hover:text-orange-600',
        className,
      )}
    >
      <TagIcon icon={tag.icon} className="h-4 w-4 shrink-0" />
      {nameOf(tag)}
    </button>
  );
}
