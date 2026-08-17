// src/app/home/page.tsx (Server Component)
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import Link from 'next/link';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { 
    Users, 
    MapPin, 
    BarChart3,
    ArrowRight 
} from 'lucide-react';
import { verifySession } from '@/lib/auth';
import DashboardPage from '../dashboard/page';

// 1. The Static Shell
export default function SignedInHomePage() {
    return (
        <Suspense fallback={<p className="text-muted-foreground mt-4 text-center">Loading your dashboard...</p>}>
            <HomeContent />
        </Suspense>
    );
}

// 2. The Dynamic Content
async function HomeContent() {
    await connection();

    // Read your custom cookie
    const session = await verifySession();

    // Redirect to landing page if not signed in
    if (!session || !session.userId) {
        redirect('/');
    }

    return (
        // <div className="min-h-screen bg-background">
        //     {/* Navigation Header */}
        //     <nav className="border-b border-border">
        //         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        //             <div className="flex justify-between h-16 items-center">
        //                 <div className="flex items-center space-x-2">
        //                     <span className="text-xl font-bold text-foreground">Best Cement CMS</span>
        //                 </div>
        //             </div>
        //         </div>
        //     </nav>

        //     {/* Main Content */}
        //     <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                
        //         {/* Header Section */}
        //         <div className="mb-10">
        //             <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
        //                 Welcome
        //             </h1>
        //         </div>

        //         {/*Quick Navigate Cards */}
        //         <div>
        //             <h2 className="text-xl font-semibold tracking-tight mb-4">Quick Navigate</h2>
        //             <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-6">
                        
        //                 {/* User Management Card */}
        //                 <Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary/50 cursor-pointer flex flex-col">
        //                     <Link href="/dashboard/usersAndTeam" className="flex-1 flex flex-col p-6">
        //                         <div className="w-14 h-14 bg-linear-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-md">
        //                             <Users className="w-7 h-7 text-white" />
        //                         </div>
        //                         <div className="flex-1">
        //                             <CardTitle className="text-2xl mb-2 group-hover:text-primary transition-colors">User Management</CardTitle>
        //                             <CardDescription className="text-base">
        //                                 Manage your team's roles, access permissions, and overall company hierarchy.
        //                             </CardDescription>
        //                         </div>
        //                         <div className="mt-6 flex items-center text-sm font-semibold text-primary group-hover:translate-x-1 transition-transform">
        //                             Manage Users <ArrowRight className="ml-2 w-4 h-4" />
        //                         </div>
        //                     </Link>
        //                 </Card>

        //                 {/* User Live Locations Card - Added query param ?tab=salesmanLiveLocation */}
        //                 <Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary/50 cursor-pointer flex flex-col">
        //                     <Link href="/dashboard/slmGeotracking?tab=salesmanLiveLocation" className="flex-1 flex flex-col p-6">
        //                         <div className="w-14 h-14 bg-linear-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-md">
        //                             <MapPin className="w-7 h-7 text-white" />
        //                         </div>
        //                         <div className="flex-1">
        //                             <CardTitle className="text-2xl mb-2 group-hover:text-primary transition-colors">User Live Locations</CardTitle>
        //                             <CardDescription className="text-base">
        //                                 Track real-time geolocations, view active paths, and monitor on-field staff presence.
        //                             </CardDescription>
        //                         </div>
        //                         <div className="mt-6 flex items-center text-sm font-semibold text-primary group-hover:translate-x-1 transition-transform">
        //                             View Map <ArrowRight className="ml-2 w-4 h-4" />
        //                         </div>
        //                     </Link>
        //                 </Card>

        //                 {/* Sales Orders & Insights Card - Added query param ?tab=salesOrders */}
        //                 <Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary/50 cursor-pointer flex flex-col">
        //                     <Link href="/dashboard/ordersPayments?tab=salesOrders" className="flex-1 flex flex-col p-6">
        //                         <div className="w-14 h-14 bg-linear-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-md">
        //                             <BarChart3 className="w-7 h-7 text-white" />
        //                         </div>
        //                         <div className="flex-1">
        //                             <CardTitle className="text-2xl mb-2 group-hover:text-primary transition-colors">Sales Orders & Insights</CardTitle>
        //                             <CardDescription className="text-base">
        //                                 Analyze sales metrics, review recent orders, and check comprehensive performance reports.
        //                             </CardDescription>
        //                         </div>
        //                         <div className="mt-6 flex items-center text-sm font-semibold text-primary group-hover:translate-x-1 transition-transform">
        //                             View Reports <ArrowRight className="ml-2 w-4 h-4" />
        //                         </div>
        //                     </Link>
        //                 </Card>

        //             </div>
        //         </div>

        //         <footer className="border-t border-border py-8 mt-auto">
        //             <div className="text-center">
        //                 <p className="text-sm text-muted-foreground">© 2026 Made By Brixta</p>
        //             </div>
        //         </footer>
        //     </div>
        // </div>
        <DashboardPage/>
    );
}