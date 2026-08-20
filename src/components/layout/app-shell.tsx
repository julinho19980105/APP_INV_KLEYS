
"use client"

import * as React from "react"
import { 
  Package, 
  PlusCircle, 
  FileText, 
  Users, 
  Truck, 
  Settings,
  Sparkles,
  ShoppingBag,
  BookOpen
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { 
  Sidebar, 
  SidebarContent, 
  SidebarFooter, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem, 
  SidebarProvider,
  SidebarInset,
  useSidebar,
  SidebarTrigger
} from "@/components/ui/sidebar"
import { useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"

const navItems = [
  { name: "Ventas", href: "/sales", icon: ShoppingBag },
  { name: "Cotización", href: "/quotes", icon: FileText },
  { name: "Inventario", href: "/inventory", icon: Package },
  { name: "Registrar", href: "/registry", icon: PlusCircle },
  { name: "Clientes", href: "/customers", icon: Users },
  { name: "Logística", href: "/shipping", icon: Truck },
  { name: "PDF Catálogo", href: "/catalogo", icon: BookOpen },
  { name: "Ajustes", href: "/settings", icon: Settings },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-background overflow-hidden">
        <AppSidebar pathname={pathname} />
        <SidebarInset className="flex-1 overflow-auto bg-background">
          <header className="md:hidden flex items-center justify-between p-4 bg-white border-b-2 border-black sticky top-0 z-50 shadow-sm">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-10 w-10 border-2 border-black rounded-xl flex items-center justify-center bg-white text-black active:scale-95" />
              <span className="font-headline font-black text-xl tracking-tighter uppercase text-black">Diva Industrial</span>
            </div>
          </header>
          <main className="p-4 max-w-[1600px] mx-auto w-full pt-2">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

function AppSidebar({ pathname }: { pathname: string }) {
  const { toggleSidebar } = useSidebar()
  const db = useFirestore()
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: companySettings } = useDoc(configDocRef)

  const settings = {
    companyName: companySettings?.companyName || "StiloStack",
    companyLogo: companySettings?.companyLogo || "",
    brandColor: companySettings?.brandColor || "#FF3399"
  }

  return (
    <Sidebar collapsible="icon" className="border-r-2 border-black shadow-2xl bg-white">
      <SidebarHeader className="h-20 flex items-center px-4 border-b-2 border-black bg-white">
        <div 
          className="flex items-center gap-3 overflow-hidden cursor-pointer w-full" 
          onClick={toggleSidebar}
        >
          <div className="w-10 h-10 rounded-2xl bg-black flex items-center justify-center shrink-0 shadow-lg overflow-hidden border-2 border-white">
            {settings.companyLogo ? (
              <img src={settings.companyLogo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Sparkles className="w-5 h-5 text-white fill-current" />
            )}
          </div>
          <span className="font-headline font-black text-2xl tracking-tighter text-black group-data-[collapsible=icon]:hidden uppercase truncate">
            {settings.companyName}
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent className="py-6 px-2 bg-white">
        <SidebarMenu>
          {navItems.map((item, index) => (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton 
                asChild 
                isActive={pathname === item.href}
                tooltip={item.name}
                className={cn(
                  "h-12 px-4 rounded-xl transition-all duration-300 mb-1 border-2 border-transparent",
                  pathname === item.href 
                    ? "bg-black text-white shadow-xl scale-105 border-black" 
                    : "hover:bg-black/5 hover:text-black hover:border-black/10"
                )}
              >
                <Link href={item.href}>
                  <item.icon 
                    className={cn("w-5 h-5")} 
                    style={{ color: pathname === item.href ? '#FFFFFF' : settings.brandColor }} 
                  />
                  <span className="font-black uppercase flex items-center gap-2">
                    <span className="opacity-30 text-[9px] font-black">{index + 1}.</span>
                    {item.name}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t-2 border-black p-4 bg-black/5">
        <div className="flex items-center gap-3 p-2 rounded-2xl border-2 border-black bg-white shadow-md group-data-[collapsible=icon]:justify-center">
          <div className="w-8 h-8 rounded-full bg-black border-2 border-white shrink-0 flex items-center justify-center">
             <span className="text-[8px] font-black text-white">AD</span>
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-[10px] font-black text-black uppercase tracking-tighter">ADMI</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
