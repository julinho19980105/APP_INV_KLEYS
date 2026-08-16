
"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Phone, MapPin, ChevronRight } from "lucide-react"

const CUSTOMERS = [
  { id: "CL-001", name: "Ana Maria Garcia", phone: "+51 987 654 321", location: "Lima, PE", status: "active", quoteCount: 12 },
  { id: "CL-002", name: "Carlos Roberto", phone: "+51 912 345 678", location: "Cusco, PE", status: "sent", quoteCount: 5 },
  { id: "CL-003", name: "Beatriz Mendoza", phone: "+51 955 443 221", location: "Arequipa, PE", status: "annulled", quoteCount: 2 },
]

export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Clientes</h1>
          <p className="text-muted-foreground">Gestión y segmentación de cartera de clientes.</p>
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente..." className="pl-9" />
          </div>
          <Button className="bg-primary text-primary-foreground">
            Nuevo Cliente
          </Button>
        </div>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="bg-muted/50 w-full md:w-auto">
          <TabsTrigger value="active" className="flex-1 md:flex-none">Activos</TabsTrigger>
          <TabsTrigger value="sent" className="flex-1 md:flex-none">Enviados</TabsTrigger>
          <TabsTrigger value="annulled" className="flex-1 md:flex-none">Anulados</TabsTrigger>
        </TabsList>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CUSTOMERS.map((c) => (
            <Card key={c.id} className="hover:border-primary/50 transition-colors cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-headline font-bold shrink-0">
                      {c.name.charAt(0)}
                    </div>
                    <div className="space-y-1">
                      <div className="font-headline font-bold text-lg group-hover:text-primary transition-colors">{c.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{c.id}</div>
                    </div>
                  </div>
                  <Badge variant={c.status === 'active' ? 'default' : c.status === 'sent' ? 'secondary' : 'destructive'} className="text-[9px] uppercase tracking-widest px-1.5 py-0">
                    {c.status}
                  </Badge>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    {c.phone}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    {c.location}
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t flex justify-between items-center">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-bold text-foreground">{c.quoteCount}</span> cotizaciones
                  </div>
                  <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10">
                    Ver Perfil <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Tabs>
    </div>
  )
}
