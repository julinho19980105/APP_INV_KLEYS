
"use client"

import * as React from "react"
import { 
  Package, 
  ShoppingBag,
  Settings,
  BookOpen,
  Truck,
  Menu
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
import { Badge } from "@/components/ui/badge"

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
    return 'INICIO'
  }

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-white overflow-hidden selection:bg-primary/10 font-body">
        <AppSidebar pathname={pathname} />
        <SidebarInset className="flex-1 overflow-auto bg-white">
          <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 sticky top-0 z-50">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="h-9 w-9 border border-slate-200 rounded-lg flex items-center justify-center bg-white text-slate-500 shadow-sm" />
              <div className="h-5 w-[1px] bg-slate-200 mx-1" />
              <span className="font-medium text-[13px] tracking-widest uppercase text-primary/80">
                {getPageTitle()}
              </span>
            </div>
            <div className="hidden md:flex items-center">
              <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 font-bold text-[8px] uppercase px-3 py-1 gap-2 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Datos Enlazados
              </Badge>
            </div>
          </header>
          <main className="p-0 max-w-[1600px] mx-auto w-full">
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
    <Sidebar collapsible="icon" className="border-r border-slate-200 shadow-xl bg-white">
      <SidebarHeader className="h-20 flex items-center px-5 bg-white">
        <div 
          className="flex items-center gap-4 overflow-hidden cursor-pointer w-full" 
          onClick={toggleSidebar}
        >
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-100"
            style={{ backgroundColor: settings.brandColor }}
          >
            {settings.companyLogo ? (
              <img src={settings.companyLogo} alt="Logo" className="w-full h-full object-cover rounded-xl" />
            ) : (
              <Package className="w-5 h-5 text-white" />
            )}
          </div>
          <span className="font-headline font-black text-xl tracking-tighter text-slate-900 group-data-[collapsible=icon]:hidden uppercase truncate">
            {settings.companyName}
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent className="py-4 px-3.5 bg-white">
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton 
                asChild 
                isActive={pathname.startsWith(item.href)}
                tooltip={item.name}
                className={cn(
                  "h-11 px-4 rounded-xl transition-all mb-1 border border-transparent",
                  pathname.startsWith(item.href) 
                    ? "bg-slate-900 text-white shadow-md" 
                    : "hover:bg-slate-50 text-slate-500"
                )}
              >
                <Link href={item.href} onClick={handleLinkClick}>
                  <item.icon className="w-4 h-4" style={{ color: pathname.startsWith(item.href) ? '#FFFFFF' : settings.brandColor }} />
                  <span className="font-medium uppercase text-[9px] tracking-widest">
                    {item.name}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-5 bg-slate-50/50 border-t border-slate-200">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-white shadow-sm border border-slate-200 group-data-[collapsible=icon]:justify-center">
          <div 
            className="w-7 h-7 rounded-full border border-white shrink-0 flex items-center justify-center shadow-sm"
            style={{ backgroundColor: settings.brandColor }}
          >
             <span className="text-[8px] font-black text-white">SS</span>
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden overflow-hidden">
            <span className="text-[9px] font-bold text-slate-900 uppercase">Industrial v1</span>
            <span className="text-[7px] font-medium text-slate-400 uppercase tracking-widest">Enterprise UI</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
