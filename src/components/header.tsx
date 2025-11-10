
import Image from 'next/image';
import { SidebarTrigger } from '@/components/ui/sidebar';

export default function Header({ title }: { title?: string }) {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="container flex h-14 items-center">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="hidden md:flex" />
          <div className="h-6 w-6 relative md:hidden">
             <Image src="/logo.png" alt="Logo" fill />
          </div>
          {title && <h1 className="text-xl font-semibold hidden md:block">{title}</h1>}
        </div>
      </div>
    </header>
  );
}
