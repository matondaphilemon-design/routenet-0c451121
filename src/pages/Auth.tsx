import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, User, Loader2, Eye, EyeOff, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { AppLogo } from "@/components/brand/AppLogo";

export default function Auth() {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName || email.split("@")[0] },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        localStorage.removeItem("routenet-guest");
        toast.success("Account created");
        navigate("/onboarding");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        localStorage.removeItem("routenet-guest");
        toast.success("Welcome back");
        navigate(localStorage.getItem("routenet-onboarded") === "true" ? "/home" : "/onboarding");
      }
    } catch (err: any) {
      toast.error(err?.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const skip = () => {
    // Guest mode — taste profile and library live in local storage only.
    localStorage.setItem("routenet-guest", "true");
    navigate("/onboarding");
  };

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 py-12"
      style={{ background: "var(--gradient-bg)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-[340px]"
      >
        <div className="mb-8 flex flex-col items-center gap-2.5">
          <AppLogo className="h-12 w-12 rounded-xl border border-border/60 p-1.5" />
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">routenet</h1>
          <p className="text-xs font-medium text-muted-foreground">
            {isSignUp ? "Create your account with email" : "Sign in with your email"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          {isSignUp && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display name"
                autoComplete="name"
                className="h-10 border-border bg-background-card pl-9 text-[13px]"
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              autoComplete="email"
              className="h-10 border-border bg-background-card pl-9 text-[13px]"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              minLength={6}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              className="h-10 border-border bg-background-card pl-9 pr-9 text-[13px]"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>

          <Button
            type="submit"
            size="sm"
            disabled={loading}
            className="h-10 w-full gap-2 rounded-lg text-[13px] font-semibold"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isSignUp ? "Create account" : "Sign in"}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={skip}
          className="h-10 w-full justify-center gap-1.5 rounded-lg border-border bg-transparent text-[13px] font-semibold"
        >
          Continue without an account
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
          Your taste profile is saved on this device. Sign in later to sync it.
        </p>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-[12px] font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            {isSignUp ? "Already have an account? Sign in" : "New here? Create an account"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
