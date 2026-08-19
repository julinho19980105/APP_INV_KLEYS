
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
  ShoppingBag
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
  useSidebar
} from "@/components/ui/sidebar"

const navItems = [
  { name: "Inventario", href: "/inventory", icon: Package },
  { name: "Registrar", href: "/registry", icon: PlusCircle },
  { name: "Cotización", href: "/quotes", icon: FileText },
  { name: "Ventas", href: "/sales", icon: ShoppingBag },
  { name: "Clientes", href: "/customers", icon: Users },
  { name: "Logística", href: "/shipping", icon: Truck },
  { name: "Ajustes", href: "/settings", icon: Settings },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-background overflow-hidden">
        <AppSidebar pathname={pathname} />
        <SidebarInset className="flex-1 overflow-auto">
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
  const [settings, setSettings] = React.useState({
    companyName: "StiloStack",
    companyLogo: ""
  })

  React.useEffect(() => {
    const loadSettings = () => {
      const saved = localStorage.getItem('diva_settings')
      if (saved) setSettings(JSON.parse(saved))
    }
    loadSettings()
    window.addEventListener('storage', loadSettings)
    return () => window.removeEventListener('storage', loadSettings)
  }, [])

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border shadow-2xl">
      <SidebarHeader className="h-20 flex items-center px-4 border-b border-sidebar-border bg-white">
        <div 
          className="flex items-center gap-3 overflow-hidden cursor-pointer w-full" 
          onClick={toggleSidebar}
        >
          <div className="w-10 h-10 rounded-2xl bg-black flex items-center justify-center shrink-0 shadow-lg overflow-hidden">
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
      <SidebarContent className="py-6 px-2">
        <SidebarMenu>
          {navItems.map((item, index) => (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton 
                asChild 
                isActive={pathname === item.href}
                tooltip={item.name}
                className={cn(
                  "h-12 px-4 rounded-xl transition-all duration-300 mb-1",
                  pathname === item.href 
                    ? "bg-black text-white shadow-lg scale-105" 
                    : "hover:bg-black/5 hover:text-black"
                )}
              >
                <Link href={item.href}>
                  <item.icon className={cn("w-5 h-5", pathname === item.href ? "text-white" : "text-black")} />
                  <span className="font-black uppercase flex items-center gap-2">
                    <span className="opacity-30 text-[9px]">{index + 1}.</span>
                    {item.name}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4 bg-black/5">
        <div className="flex items-center gap-3 p-2 rounded-2xl border border-black/10 bg-white shadow-sm group-data-[collapsible=icon]:justify-center">
          <div className="w-8 h-8 rounded-full bg-black border-2 border-white shrink-0 flex items-center justify-center">
             <span className="text-[8px] font-black text-white">D</span>
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-[10px] font-black text-black uppercase tracking-tighter">ADMI</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
