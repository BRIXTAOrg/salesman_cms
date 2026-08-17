// src/app/signup/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Loader2, Rocket } from 'lucide-react';
import Image from 'next/image';

function slugify(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 63);
}

export default function SignupPage() {
    const [companyName, setCompanyName] = useState('');
    const [schemaName, setSchemaName] = useState('');
    const [schemaEdited, setSchemaEdited] = useState(false);
    const [officeAddress, setOfficeAddress] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [companyEmail, setCompanyEmail] = useState('');

    const [adminName, setAdminName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleCompanyNameChange = (value: string) => {
        setCompanyName(value);
        if (!schemaEdited) {
            setSchemaName(slugify(value));
        }
    };

    const handleSchemaNameChange = (value: string) => {
        setSchemaEdited(true);
        setSchemaName(slugify(value));
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (adminPassword !== adminPasswordConfirm) {
            setError('Passwords do not match.');
            return;
        }

        if (!schemaName) {
            setError('Company code could not be generated. Please set one manually.');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyName,
                    schemaName,
                    officeAddress,
                    contactNumber,
                    companyEmail,
                    adminName,
                    adminEmail,
                    adminPassword,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess(true);
            } else {
                setError(data.error || 'Unable to create company. Please try again.');
            }
        } catch (err) {
            setError('A network error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
                <Card className="w-full max-w-md shadow-lg border-primary/20">
                    <CardHeader className="text-center space-y-4">
                        <div className="flex justify-center">
                            <CheckCircle2 className="h-12 w-12 text-green-600" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-bold tracking-tight">
                                Company registered
                            </CardTitle>
                            <CardDescription className="mt-2">
                                <span className="font-mono font-medium">{schemaName}</span> is on the list. You&apos;ll be able to sign in once your workspace is set up.
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Link href="/login">
                            <Button variant="outline" className="w-full h-11 text-base font-semibold">
                                Back to sign in
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4 py-10">
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
                            Create your company
                        </CardTitle>
                        <CardDescription className="mt-2">
                            Sets up a dedicated workspace and your admin account
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

                    <form onSubmit={handleSignup} className="space-y-5">
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Company</Label>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="companyName">Company Name</Label>
                            <Input
                                id="companyName"
                                type="text"
                                value={companyName}
                                onChange={(e) => handleCompanyNameChange(e.target.value)}
                                placeholder="Company Name"
                                required
                                disabled={loading}
                                className="h-11"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="schemaName">Company Code</Label>
                            <Input
                                id="schemaName"
                                type="text"
                                value={schemaName}
                                onChange={(e) => handleSchemaNameChange(e.target.value)}
                                placeholder="companyname"
                                required
                                disabled={loading}
                                className="h-11 font-mono"
                                autoCapitalize="none"
                                autoCorrect="off"
                            />
                            <p className="text-xs text-muted-foreground">
                                Used to sign in. Lowercase letters, numbers and underscores only.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="officeAddress">Office Address</Label>
                            <Input
                                id="officeAddress"
                                type="text"
                                value={officeAddress}
                                onChange={(e) => setOfficeAddress(e.target.value)}
                                placeholder="Office, Address"
                                required
                                disabled={loading}
                                className="h-11"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="contactNumber">Contact Number</Label>
                            <Input
                                id="contactNumber"
                                type="tel"
                                value={contactNumber}
                                onChange={(e) => setContactNumber(e.target.value)}
                                placeholder="9999999999"
                                required
                                disabled={loading}
                                className="h-11"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="companyEmail">Company Email (optional)</Label>
                            <Input
                                id="companyEmail"
                                type="email"
                                value={companyEmail}
                                onChange={(e) => setCompanyEmail(e.target.value)}
                                placeholder="hello@company.com"
                                disabled={loading}
                                className="h-11"
                            />
                        </div>

                        <div className="space-y-2 pt-2">
                            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Admin account</Label>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="adminName">Your Name</Label>
                            <Input
                                id="adminName"
                                type="text"
                                value={adminName}
                                onChange={(e) => setAdminName(e.target.value)}
                                placeholder="Full name"
                                required
                                disabled={loading}
                                className="h-11"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="adminEmail">Your Email</Label>
                            <Input
                                id="adminEmail"
                                type="email"
                                value={adminEmail}
                                onChange={(e) => setAdminEmail(e.target.value)}
                                placeholder="you@company.com"
                                required
                                disabled={loading}
                                className="h-11"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="adminPassword">Password</Label>
                            <Input
                                id="adminPassword"
                                type="password"
                                value={adminPassword}
                                onChange={(e) => setAdminPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={6}
                                disabled={loading}
                                className="h-11"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="adminPasswordConfirm">Confirm Password</Label>
                            <Input
                                id="adminPasswordConfirm"
                                type="password"
                                value={adminPasswordConfirm}
                                onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={6}
                                disabled={loading}
                                className="h-11"
                            />
                        </div>

                        <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
                            {loading ? (
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                <Rocket className="mr-2 h-5 w-5" />
                            )}
                            {loading ? 'Setting up your company...' : 'Create company'}
                        </Button>
                    </form>

                    <p className="mt-6 text-center text-sm text-muted-foreground">
                        Already have a company?{' '}
                        <Link href="/login" className="font-medium text-primary hover:underline">
                            Sign in
                        </Link>
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}