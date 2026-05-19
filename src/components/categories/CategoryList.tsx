import { Category } from '@/types/category';
import { cn } from '@/lib/utils';
import { useRef, useEffect } from 'react';

interface CategoryListProps {
  categories: Category[];
  activeCategoryId?: string;
  onSelectCategory: (categoryId: string) => void;
}

export function CategoryList({ categories, activeCategoryId, onSelectCategory }: CategoryListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll active item into view
  useEffect(() => {
    if (activeCategoryId && scrollContainerRef.current) {
      const activeElement = scrollContainerRef.current.querySelector('[data-active="true"]') as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeCategoryId]);

  return (
    <div className="w-full overflow-x-auto no-scrollbar py-2" ref={scrollContainerRef}>
      <div className="flex gap-3 px-4 min-w-max">
        <button
          onClick={() => onSelectCategory('')}
          data-active={!activeCategoryId}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium transition-colors border",
            !activeCategoryId 
              ? "bg-orange-600 text-white border-orange-600" 
              : "bg-white text-zinc-600 border-zinc-200 hover:border-orange-200 hover:text-orange-600"
          )}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => onSelectCategory(category.id)}
            data-active={activeCategoryId === category.id}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-colors border whitespace-nowrap",
              activeCategoryId === category.id
                ? "bg-orange-600 text-white border-orange-600"
                : "bg-white text-zinc-600 border-zinc-200 hover:border-orange-200 hover:text-orange-600"
            )}
          >
            {category.name}
          </button>
        ))}
      </div>
    </div>
  );
}
