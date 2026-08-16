"use client"

import * as React from "react"
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
import { Search, Filter, Eye, Edit2, History, ArrowDownRight, ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"

const MOCK_PRODUCTS = [
  { id: "1", code: "STK-0021", name: "Saco Velvet Premium", category: "Sacos", collection: "Winter 24", stock: 24, priceMayor: 120, img: "https://picsum.photos/seed/p1/200/200" },
  { id: "2", code: "STK-0022", name: "Pantalón Slim Fit", category: "Pantalones", collection: "Winter 24", stock: 48, priceMayor: 85, img: "https://picsum.photos/seed/p2/200/200" },
  { id: "3", code: "STK-0023", name: "Blusa Seda Gala", category: "Blusas", collection: "Summer 25", stock: 0, priceMayor: 65, img: "https://picsum.photos/seed/p3/200/200" },
  { id: "4", code: "STK-0024", name: "Vestido Noche Largo", category: "Vestidos", collection: "Winter 24", stock: 12, priceMayor: 210, img: "https://picsum.photos/seed/p4/200/200" },
]

const MOCK_MOVEMENTS = [
  { id: "m1", date: "2024-05-20", code: "STK-0021", type: "out", qty: 5, reason: "Venta B-102" },
  { id: "m2", date: "2024-05-19", code: "STK-0022", type: "in", qty: 20, reason: "Ingreso Taller" },
  { id: "m3", date: "2024-05-18", code: "STK-0021", type: "in", qty: 2, reason: "Anulación B-098" },
]

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Inventario Diva</h1>
          <p className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">Gestión de Stock y Movimientos</p>
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-accent" />
            <Input placeholder="Buscar prenda..." className="pl-9 rounded-xl border-accent/20" />
          </div>
          <Button variant="outline" size="icon" className="rounded-xl border-accent text-accent">
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-muted/50 p-1 rounded-2xl mb-6">
          <TabsTrigger value="all" className="rounded-xl px-6">Stock Actual</TabsTrigger>
          <TabsTrigger value="movements" className="rounded-xl px-6">Movimientos (Kardex)</TabsTrigger>
          <TabsTrigger value="out" className="rounded-xl px-6">Sin Stock</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="border rounded-[2rem] overflow-hidden bg-card shadow-xl border-none">
          <Table>
            <TableHeader>
              <TableRow className="bg-accent/5 hover:bg-accent/5">
                <TableHead className="w-[80px] font-black uppercase text-[10px] text-accent">Foto</TableHead>
                <TableHead className="font-black uppercase text-[10px] text-accent">Código</TableHead>
                <TableHead className="font-black uppercase text-[10px] text-accent">Nombre</TableHead>
                <TableHead className="font-black uppercase text-[10px] text-accent">Categoría</TableHead>
                <TableHead className="text-right font-black uppercase text-[10px] text-accent">Precio Mayor</TableHead>
                <TableHead className="text-center font-black uppercase text-[10px] text-accent">Stock</TableHead>
                <TableHead className="text-right font-black uppercase text-[10px] text-accent">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_PRODUCTS.map((p) => (
                <TableRow key={p.id} className="group transition-colors hover:bg-primary/5">
                  <TableCell>
                    <div className="w-12 h-12 rounded-2xl border border-accent/10 overflow-hidden bg-muted relative shadow-sm">
                      <Image 
                        src={p.img} 
                        alt={p.name} 
                        fill
                        className="object-cover"
                        data-ai-hint="fashion item"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-accent">{p.code}</TableCell>
                  <TableCell className="font-bold text-primary">{p.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-black text-[9px] uppercase tracking-widest bg-accent/10 text-accent border-none">{p.category}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-black text-primary">S/ {p.priceMayor}</TableCell>
                  <TableCell className="text-center">
                    <span className={cn(
                      "font-black text-base px-3 py-1 rounded-full",
                      p.stock === 0 ? "bg-destructive/10 text-destructive" : p.stock < 10 ? "bg-orange-100 text-orange-500" : "bg-green-100 text-green-600"
                    )}>
                      {p.stock}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-accent hover:bg-accent/10 rounded-xl"><Eye className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10 rounded-xl"><Edit2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
        
        <TabsContent value="movements" className="space-y-4">
          <div className="border rounded-[2rem] overflow-hidden bg-card shadow-xl border-none">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/5 hover:bg-primary/5">
                  <TableHead className="font-black uppercase text-[10px] text-primary">Fecha</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-primary">Prenda</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-primary">Tipo</TableHead>
                  <TableHead className="text-center font-black uppercase text-[10px] text-primary">Cantidad</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-primary">Motivo / Referencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_MOVEMENTS.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs font-medium text-muted-foreground">{m.date}</TableCell>
                    <TableCell className="font-bold text-accent font-mono">{m.code}</TableCell>
                    <TableCell>
                      {m.type === 'in' ? (
                        <div className="flex items-center gap-1 text-green-600 font-bold text-xs">
                          <ArrowUpRight className="w-3 h-3" /> INGRESO
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-destructive font-bold text-xs">
                          <ArrowDownRight className="w-3 h-3" /> SALIDA
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-black text-lg">
                      {m.type === 'in' ? '+' : '-'}{m.qty}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{m.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}