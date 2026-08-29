
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
      <div className="flex min-h-screen w-full bg-white overflow-hidden selection:bg-primary/10">
        <AppSidebar pathname={pathname} />
        <SidebarInset className="flex-1 overflow-auto bg-white">
          <header className="flex items-center justify-between p-4 bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50 shadow-[0_1px_2px_rgb(0,0,0,0.02)]">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="h-10 w-10 border border-slate-200/60 rounded-xl flex items-center justify-center bg-white text-slate-800 active:scale-95 shadow-sm" />
              <span className="font-headline font-black text-[22px] tracking-[-0.03em] uppercase text-slate-900">
                {getPageTitle()}
              </span>
            </div>
          </header>
          <main className="p-2.5 md:p-6 max-w-[1600px] mx-auto w-full pt-2">
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
    <Sidebar collapsible="icon" className="border-r border-slate-100 shadow-xl bg-white">
      <SidebarHeader className="h-24 flex items-center px-5 bg-white">
        <div 
          className="flex items-center gap-4 overflow-hidden cursor-pointer w-full group" 
          onClick={toggleSidebar}
        >
          <div 
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md overflow-hidden border border-slate-100 transition-transform group-hover:scale-105"
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
          <span className="font-headline font-black text-2xl tracking-tighter text-slate-900 group-data-[collapsible=icon]:hidden uppercase truncate leading-none">
            {settings.companyName}
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent className="py-8 px-3.5 bg-white">
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
                    ? "bg-[#1e293b] text-white shadow-lg shadow-slate-200 scale-105" 
                    : "hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Link href={item.href} onClick={handleLinkClick}>
                  <item.icon 
                    className={cn("w-5 h-5")} 
                    style={{ color: pathname.startsWith(item.href) ? '#FFFFFF' : settings.brandColor }} 
                  />
                  <span className="font-black uppercase flex items-center gap-2 text-[10px] tracking-[0.1em]">
                    {item.name}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-5 bg-slate-50/50 border-t border-slate-100">
        <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-white shadow-sm border border-slate-100 group-data-[collapsible=icon]:justify-center">
          <div 
            className="w-8 h-8 rounded-full border-2 border-white shrink-0 flex items-center justify-center shadow-sm"
            style={{ backgroundColor: settings.brandColor }}
          >
             <span className="text-[9px] font-black text-white">SS</span>
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden overflow-hidden">
            <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight leading-none">Industrial v1</span>
            <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 tracking-widest">Enterprise UI</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
