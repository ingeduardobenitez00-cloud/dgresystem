import { BookMarked } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';

export default function Header({ title }: { title?: string }) {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="container flex h-14 items-center">
        <div className="md:hidden">
          <SidebarTrigger />
        </div>
        <div className="flex items-center space-x-2 md:ml-4">
          <BookMarked className="h-6 w-6 text-primary md:hidden" />
          {title && <h1 className="text-xl font-semibold hidden md:block">{title}</h1>}
        </div>
      </div>
    </header>
  );
}
