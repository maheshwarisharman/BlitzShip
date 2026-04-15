import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground relative py-20 px-4">
      {/* Background decorations - Vercel style subtle grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-[40vh] bg-gradient-to-b from-background via-background/90 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-[40vh] bg-gradient-to-t from-background via-background/90 to-transparent pointer-events-none" />

      <main className="relative z-10 max-w-2xl text-center flex flex-col items-center mt-[-10vh]">

        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight mb-6">
          Welcome To A BlitzShip React Deployment Website
        </h1>
        
        <p className="text-muted-foreground text-lg mb-8 max-w-[500px]">
          The most seamless way to deploy and manage your web applications with zero configuration. Choose our robust SaaS platform to scale securely.
        </p>

        <div className="flex gap-4">
          <Link href="/login">
            <Button className="h-11 px-8 rounded-full text-sm font-medium">Sign In to Dashboard</Button>
          </Link>
        </div>
      </main>

      <footer className="absolute bottom-6 w-full text-center z-10">
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} BlitzShip. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
