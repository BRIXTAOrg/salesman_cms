// src/app/home/signedOutHomePage.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, MapPin, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

export default function SignedOutHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    companyCode: '',
    email: '',
    password: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid credentials');
      }

      toast.success('Welcome!');
      
      if (data.user.isAdminAppUser || data.user.isDashboardUser) {
        router.push('/dashboard'); // Adjust to your main signed-in route
      } else {
        router.push('/home');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-background">
      
      {/* LEFT PANE: Info (Takes up ~75% space) */}
      <div className="flex-1 bg-slate-900 bg-linear-to-br from-slate-900 to-slate-950 text-white relative flex flex-col justify-between p-8 lg:p-16 overflow-hidden">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay pointer-events-none"></div>
        
        {/* Header -- implement later*/}

        {/* Catchy Hero Content */}
        <div className="relative z-10 max-w-3xl my-12 lg:my-0">
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            Command Your <br className="hidden md:block" /> Field Operations.
          </h1>
          <p className="text-zinc-400 text-lg md:text-xl leading-relaxed mb-10 max-w-2xl">
            Streamline daily journeys, track live field attendance, and analyze market trends across your entire network from a single, unified command center.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-primary/20 rounded-lg"><MapPin className="w-5 h-5 text-primary" /></div>
              <div>
                <h3 className="font-semibold text-zinc-200">Live Territory Tracking</h3>
                <p className="text-sm text-zinc-500 mt-1">Monitor real-time movements and verify PJP executions automatically.</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg"><BarChart3 className="w-5 h-5 text-emerald-400" /></div>
              <div>
                <h3 className="font-semibold text-zinc-200">Market Analytics</h3>
                <p className="text-sm text-zinc-500 mt-1">Generate custom reports on sales, competition, and dealer performance.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-sm text-zinc-600 font-medium">
          <span suppressHydrationWarning>© {new Date().getFullYear()}</span> Made By Brixta. All rights reserved.
        </div>
      </div>

      {/* RIGHT PANE: Login Form (Fixed Width ~25%) */}
      <div className="w-full lg:w-[400px] xl:w-[480px] shrink-0 bg-card flex flex-col justify-center p-8 sm:p-12 border-l border-border relative z-20 shadow-2xl lg:shadow-none">
        <div className="w-full space-y-8">
          
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Log In</h2>
            <p className="text-muted-foreground text-sm">
              Enter your credentials to access the dashboard.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="companyCode">Company Code</Label>
              <Input
                id="companyCode"
                type="text"
                placeholder="companyfirstname"
                value={formData.companyCode}
                onChange={(e) => setFormData({ ...formData, companyCode: e.target.value })}
                required
                className="h-11 bg-background"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email or Login ID</Label>
              <Input
                id="email"
                type="text"
                placeholder="user@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="h-11 bg-background"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="h-11 bg-background pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Login'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Setting up a new company?{' '}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </p>

        </div>
      </div>

    </div>
  );
}