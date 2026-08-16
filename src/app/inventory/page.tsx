
"use client"

import * as React from "react"
import { AppShell } from "@/components/layout/app-shell"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Filter, Eye, Edit2 } from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"

const MOCK_PRODUCTS = [
  { id: "1", code: "STK-0021", name: "Saco Velvet Premium", category: "Sacos", collection: "Winter 24", stock: 24, priceMayor: 120, img: "https://picsum.photos/seed/p1/200/200" },
  { id: "2", code: "STK-0022", name: "Pantalón Slim Fit", category: "Pantalones", collection: "Winter 24", stock: 48, priceMayor: 85, img: "https://picsum.photos/seed/p2/200/200" },
  { id: "3", code: "STK-0023", name: "Blusa Seda Gala", category: "Blusas", collection: "Summer 25", stock: 0, priceMayor: 65, img: "https://picsum.photos/seed/p3/200/200" },
  { id: "4", code: "STK-0024", name: "Vestido Noche Largo", category: "Vestidos", collection: "Winter 24", stock: 12, priceMayor: 210, img: "https://picsum.photos/seed/p4/200/200" },
]

export default function InventoryPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold">Inventario</h1>
            <p className="text-muted-foreground">Catálogo maestro y gestión de stock en tiempo real.</p>
          </div>
          <div className="flex w-full md:w-auto gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nombre o código..." className="pl-9" />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="all">Todo</TabsTrigger>
            <TabsTrigger value="categories">Por Categoría</TabsTrigger>
            <TabsTrigger value="collections">Por Colección</TabsTrigger>
            <TabsTrigger value="out">Sin Stock</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="mt-6 border rounded-xl overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[80px]">Foto</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Mayor</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_PRODUCTS.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="w-10 h-10 rounded border overflow-hidden bg-muted relative">
                        <Image 
                          src={p.img} 
                          alt={p.name} 
                          fill
                          className="object-cover"
                          data-ai-hint="fashion product"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.code}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal text-[10px] uppercase tracking-wider">{p.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">S/ {p.priceMayor}</TableCell>
                    <TableCell className="text-center">
                      <span className={cn(
                        "font-bold text-sm",
                        p.stock === 0 ? "text-destructive" : p.stock < 10 ? "text-orange-400" : "text-green-400"
                      )}>
                        {p.stock}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary"><Edit2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
          
          <TabsContent value="categories" className="mt-6">
            <div className="flex items-center justify-center h-40 border-2 border-dashed rounded-xl text-muted-foreground">
              Segmentación por categorías en desarrollo...
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
