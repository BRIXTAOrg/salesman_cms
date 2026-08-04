// src/app/login/page.tsx
'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Loader2, LogIn } from 'lucide-react';
import Image from 'next/image';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                // Hard redirect to refresh server components and read the new cookie
                window.location.href = data.redirect || '/home';
            } else {
                setError(data.error || 'Login failed. Please check your credentials.');
            }
        } catch (err) {
            setError('A network error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
            <Card className="w-full max-w-md shadow-lg border-primary/20">
                <CardHeader className="text-center space-y-4">
                    <div className="flex justify-center">
                        <Image
                            src="/logo.webp"
                            alt="Logo"
                            width={48}
                            height={48}
                            className="rounded-xl shadow-sm"
                        />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-bold tracking-tight">
                            Welcome
                        </CardTitle>
                        <CardDescription className="mt-2">
                            Enter your credentials to access the Dashboard
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    {error && (
                        <div className="flex items-center p-3 mb-6 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800" role="alert">
                            <AlertCircle className="shrink-0 inline w-4 h-4 mr-2" />
                            <span className="font-medium">{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="user@email.com"
                                required
                                disabled={loading}
                                className="h-11"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                disabled={loading}
                                className="h-11"
                            />
                        </div>

                        <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
                            {loading ? (
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                <LogIn className="mr-2 h-5 w-5" />
                            )}
                            {loading ? 'Authenticating...' : 'Sign In'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}