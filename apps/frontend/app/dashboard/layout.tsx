import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Search, Bell, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background">
        <div className="flex h-14 items-center px-4 w-full justify-between max-w-7xl mx-auto">
          {/* Left Area (Logo & Breadcrumbs) */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <svg className="h-6 w-6 text-foreground" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 22H22L12 2Z" fill="currentColor" />
              </svg>
            </Link>
            
            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-neutral-800" xmlns="http://www.w3.org/2000/svg">
                <path d="M16.88 3.549L7.12 20.451" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            
            <div className="flex items-center gap-2 hover:bg-neutral-900 px-2 py-1 rounded-md cursor-pointer transition-colors">
              <Avatar className="w-5 h-5">
                <AvatarImage src="" />
                <AvatarFallback className="text-[10px] bg-gradient-to-tr from-foreground to-muted-foreground text-background">usr</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">personal</span>
              <span className="bg-neutral-800 text-[11px] font-medium text-neutral-300 px-1.5 py-0.5 rounded-full ml-1">Hobby</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground ml-1" />
            </div>
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
              <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: "w-8 h-8 rounded-full border border-border", userButtonPopoverCard: "bg-background border-border text-foreground" } }} />
            </div>
          </div>
        </div>

        {/* Secondary Navigation (Tabs) */}
        <div className="border-t border-border bg-background/50">
          <nav className="flex items-center gap-6 px-4 w-full max-w-7xl mx-auto overflow-x-auto no-scrollbar">
            {['Overview', 'Integrations', 'Activity', 'Domains', 'Usage', 'Settings'].map((tab) => (
              <Link
                key={tab}
                href="#"
                className={`flex items-center text-[13px] h-11 transition-colors border-b-2 whitespace-nowrap px-1 ${
                  tab === 'Overview' 
                    ? 'border-foreground font-medium text-foreground' 
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 pb-20 mt-4">
        {children}
      </main>
    </div>
  );
}
