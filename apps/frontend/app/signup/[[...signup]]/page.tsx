import { SignUp } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground relative">
      {/* Background decorations - Vercel style subtle grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-[40vh] bg-gradient-to-b from-background via-background/90 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-[40vh] bg-gradient-to-t from-background via-background/90 to-transparent pointer-events-none" />

      <main className="relative z-10 flex flex-col items-center justify-center flex-1 w-full px-4 sm:px-6">
        <div className="w-full max-w-[400px] mb-8 mt-12 flex flex-col items-center text-center">          
          <p className="text-sm text-muted-foreground max-w-[300px]">
            Sign up to manage your deployments
          </p>
        </div>

        <div className="w-full max-w-[400px]">
          <SignUp 
            routing="path"
            path="/signup"
          />
        </div>
      </main>
    </div>
  );
}
