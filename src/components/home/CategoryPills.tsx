import { motion } from "framer-motion";

interface CategoryPillsProps {
  categories: string[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export function CategoryPills({ categories, activeCategory, onCategoryChange }: CategoryPillsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {categories.map((category, index) => {
        const isActive = category === activeCategory;
        return (
          <motion.button
            key={category}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onCategoryChange(category)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-white/10 text-foreground hover:bg-white/20"
            }`}
          >
            {category}
          </motion.button>
        );
      })}
    </div>
  );
}
