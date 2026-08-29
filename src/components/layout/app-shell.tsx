
"use client"

import * as React from "react"
import { 
  Package, 
  ShoppingBag,
  Settings,
  BookOpen,
  Truck
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
  { name: "Inventario", href: "/inventory", icon: Package },
  { name: "Cliente / Envio", href: "/shipping", icon: Truck },
  { name: "Catálogos", href: "/catalogo", icon: BookOpen },
  { name: "Ajustes", href: "/settings", icon: Settings },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const getPageTitle = () => {
    if (pathname.includes('/sales')) return 'VENTAS'
    if (pathname.includes('/inventory')) return 'INVENTARIO'
    if (pathname.includes('/shipping')) return 'ENVÍOS'
    if (pathname.includes('/catalogo')) return 'CATÁLOGO'
    if (pathname.includes('/settings')) return 'AJUSTES'
    return 'INDUSTRIAL'
  }

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-background overflow-hidden">
        <AppSidebar pathname={pathname} />
        <SidebarInset className="flex-1 overflow-auto bg-background">
          <header className="flex items-center justify-between p-4 bg-white border-b border-primary/20 sticky top-0 z-50 shadow-sm">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-10 w-10 border border-primary/20 rounded-xl flex items-center justify-center bg-white text-primary active:scale-95" />
              <span className="font-headline font-black text-xl tracking-tighter uppercase text-primary">
                {getPageTitle()}
              </span>
            </div>
          </header>
          <main className="p-2 md:p-4 max-w-[1600px] mx-auto w-full pt-2">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

function AppSidebar({ pathname }: { pathname: string }) {
  const { toggleSidebar, isMobile, setOpenMobile } = useSidebar()
  const db = useFirestore()
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: companySettings } = useDoc(configDocRef)

  const settings = {
    companyName: companySettings?.companyName || "STILOSTACK",
    companyLogo: companySettings?.companyLogo || "",
    brandColor: companySettings?.brandColor || "#0296FF"
  }

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-primary/10 shadow-xl bg-white">
      <SidebarHeader className="h-24 flex items-center px-4 bg-white">
        <div 
          className="flex items-center gap-3 overflow-hidden cursor-pointer w-full group" 
          onClick={toggleSidebar}
        >
          <div 
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg overflow-hidden border-2 border-white transition-transform group-hover:scale-110"
            style={{ backgroundColor: settings.brandColor }}
          >
            {settings.companyLogo ? (
              <img src={settings.companyLogo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-6 h-6 text-white" />
              </div>
            )}
          </div>
          <span className="font-headline font-black text-2xl tracking-tighter text-foreground group-data-[collapsible=icon]:hidden uppercase truncate">
            {settings.companyName}
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent className="py-6 px-3 bg-white">
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton 
                asChild 
                isActive={pathname.startsWith(item.href)}
                tooltip={item.name}
                className={cn(
                  "h-12 px-4 rounded-2xl transition-all duration-300 mb-2 border border-transparent",
                  pathname.startsWith(item.href) 
                    ? "bg-primary text-white shadow-lg shadow-primary/30 scale-105 border-primary/10" 
                    : "hover:bg-primary/5 hover:text-primary"
                )}
              >
                <Link href={item.href} onClick={handleLinkClick}>
                  <item.icon 
                    className={cn("w-5 h-5")} 
                    style={{ color: pathname.startsWith(item.href) ? '#FFFFFF' : settings.brandColor }} 
                  />
                  <span className="font-black uppercase flex items-center gap-2 text-[11px] tracking-wide">
                    {item.name}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-4 bg-secondary/50 border-t border-primary/5">
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-white shadow-sm border border-primary/10 group-data-[collapsible=icon]:justify-center">
          <div 
            className="w-8 h-8 rounded-full border-2 border-white shrink-0 flex items-center justify-center shadow-sm"
            style={{ backgroundColor: settings.brandColor }}
          >
             <span className="text-[8px] font-black text-white">AD</span>
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden overflow-hidden">
            <span className="text-[10px] font-black text-foreground uppercase tracking-tight">Panel de Control</span>
            <span className="text-[8px] text-muted-foreground uppercase">Sistema Industrial</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
