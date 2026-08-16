"use client"

import * as React from "react"
import { 
  LayoutDashboard, 
  Package, 
  PlusCircle, 
  FileText, 
  Users, 
  Truck, 
  Settings,
  Heart
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { 
  Sidebar, 
  SidebarContent, 
  SidebarFooter, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem, 
  SidebarProvider,
  SidebarTrigger,
  SidebarInset
} from "@/components/ui/sidebar"

const navItems = [
  { name: "Resumen", href: "/", icon: LayoutDashboard },
  { name: "Inventario", href: "/inventory", icon: Package },
  { name: "Registrar", href: "/registry", icon: PlusCircle },
  { name: "Cotizaciones", href: "/quotes", icon: FileText },
  { name: "Clientes", href: "/customers", icon: Users },
  { name: "Logística", href: "/shipping", icon: Truck },
  { name: "Ajustes", href: "/settings", icon: Settings },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-background overflow-hidden">
        <Sidebar collapsible="icon" className="border-r border-primary/10 shadow-xl shadow-primary/5">
          <SidebarHeader className="h-20 flex items-center px-4 border-b border-primary/5">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
                <Heart className="w-6 h-6 text-primary-foreground fill-current" />
              </div>
              <span className="font-headline font-bold text-2xl tracking-tighter text-primary group-data-[collapsible=icon]:hidden">
                StiloStack
              </span>
            </div>
          </SidebarHeader>
          <SidebarContent className="py-6">
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={pathname === item.href}
                    tooltip={item.name}
                    className={cn(
                      "h-12 px-4 rounded-xl transition-all duration-200",
                      pathname === item.href ? "bg-primary text-white shadow-md shadow-primary/30" : "hover:bg-primary/10 hover:text-primary"
                    )}
                  >
                    <Link href={item.href}>
                      <item.icon className={cn("w-5 h-5", pathname === item.href ? "text-white" : "text-primary")} />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="border-t border-primary/5 p-4 group-data-[collapsible=icon]:p-2">
            <div className="flex items-center gap-3 p-2 rounded-2xl bg-accent group-data-[collapsible=icon]:justify-center">
              <div className="w-8 h-8 rounded-full bg-primary/20 border-2 border-primary/30 shrink-0" />
              <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                <span className="text-xs font-bold text-primary">Admin Diva</span>
                <span className="text-[9px] text-primary/60 uppercase tracking-widest font-black">Gold Store</span>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="flex-1 overflow-auto bg-background/50">
          <header className="h-16 flex items-center px-6 border-b border-primary/5 justify-between sticky top-0 bg-white/40 backdrop-blur-md z-10">
            <SidebarTrigger className="text-primary" />
            <div className="flex items-center gap-4">
               <div className="text-[10px] font-black uppercase tracking-widest text-primary/40">
                 System v2.1
               </div>
            </div>
          </header>
          <main className="p-8 max-w-[1600px] mx-auto w-full">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
