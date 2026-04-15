import { UserButton, ClerkProvider } from "@clerk/nextjs";
import Link from "next/link";
import { Search, Bell, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";
import blitzLogo from "../../assets/BlitzLogo icon only.png";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {


  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background">
        <div className="flex h-14 items-center px-4 w-full justify-between max-w-7xl mx-auto">
          {/* Left Area (Logo & Breadcrumbs) */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <Image src={blitzLogo} alt="Blitz Logo" className="h-10 w-10 object-contain invert" />
            </Link>
            <h2 className="font-semibold">BlitzShip</h2>
          </div>
          
          {/* Right Area (Search & Auth) */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex relative w-64 items-center group">
              <Search className="absolute left-2.5 w-4 h-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
              <Input
                type="search"
                placeholder="Search..."
                className="w-full pl-9 h-8 bg-transparent border-border focus-visible:ring-1 focus-visible:ring-neutral-700 text-sm shadow-none placeholder:text-muted-foreground"
              />
              <div className="absolute right-2 text-[10px] border border-border text-muted-foreground px-1.5 rounded-[4px] bg-neutral-950 font-mono tracking-widest hidden sm:block">
                ⌘K
              </div>
            </div>
            <button className="flex items-center justify-center w-8 h-8 rounded-full border border-border bg-background hover:bg-neutral-900 transition-colors text-muted-foreground">
              <Bell className="w-4 h-4" />
            </button>
            <div className="pl-2">
              <ClerkProvider afterSignOutUrl='/'>
                <UserButton appearance={{ elements: { avatarBox: "w-8 h-8 rounded-full border border-border", userButtonPopoverCard: "bg-background border-border text-foreground" } }} />
              </ClerkProvider>
            </div>
          </div>
        </div>

      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 pb-20 mt-4">
        {children}
      </main>
    </div>
  );
}
