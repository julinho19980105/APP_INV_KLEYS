
"use client"

import * as React from "react"
import { 
  Package, 
  PlusCircle, 
  FileText, 
  Users, 
  Truck, 
  Settings,
  Sparkles
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
  SidebarTrigger,
  SidebarInset
} from "@/components/ui/sidebar"

const navItems = [
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
        <Sidebar collapsible="icon" className="border-r border-sidebar-border shadow-2xl">
          <SidebarHeader className="h-20 flex items-center px-4 border-b border-sidebar-border bg-gradient-to-r from-primary/5 to-accent/5">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/30">
                <Sparkles className="w-6 h-6 text-primary-foreground fill-current" />
              </div>
              <span className="font-headline font-bold text-2xl tracking-tighter text-primary group-data-[collapsible=icon]:hidden">
                StiloStack
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
                        ? "bg-primary text-white shadow-lg shadow-primary/25 scale-105" 
                        : "hover:bg-accent/10 hover:text-accent"
                    )}
                  >
                    <Link href={item.href}>
                      <item.icon className={cn("w-5 h-5", pathname === item.href ? "text-white" : "text-accent")} />
                      <span className="font-medium flex items-center gap-2">
                        <span className="opacity-50 text-[10px]">{index + 1}.</span>
                        {item.name}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="border-t border-sidebar-border p-4 bg-secondary/30">
            <div className="flex items-center gap-3 p-2 rounded-2xl border border-primary/10 bg-white shadow-sm group-data-[collapsible=icon]:justify-center">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-accent border-2 border-white shrink-0" />
              <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                <span className="text-xs font-bold text-primary">Admin Diva</span>
                <span className="text-[9px] text-accent font-black uppercase tracking-widest">Premium Store</span>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="flex-1 overflow-auto">
          <header className="h-16 flex items-center px-6 border-b border-sidebar-border justify-between sticky top-0 bg-white/70 backdrop-blur-xl z-10">
            <SidebarTrigger className="text-primary hover:bg-primary/10" />
            <div className="flex items-center gap-4">
               <div className="text-[10px] font-black uppercase tracking-widest text-accent">
                 Fashion Logistics System
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
