import { CategoriesSection } from "../sections/categories-section";

// A line under the top layout shows categories
interface HomeViewProps {
  categoryId: string;
}

// The client components will leverage the prefetch from server component
export const HomeView = ({ categoryId? }: HomeViewProps) => {
  return (
    <div className="max-w-[150rem] mx-auto mb-10 px-4 pt-2.5 flex flex-col gap-y-6">
      <CategoriesSection categoryId={categoryId} />
    </div>
  );
};
